/**
 * The turn. Everything that happens between her pressing enter and the screen
 * changing.
 *
 * This lived inside app/page.tsx, 380 lines deep in a React component, which
 * meant nothing could run it but a browser and a person. Every bug found in a
 * single evening of hand-testing lived in here: the wrong country, the reason
 * for the trip quietly dropped, the plan rebuilt while the reply said it
 * hadn't. The eval sat at 95% throughout, because the eval reimplemented this
 * flow in evals/scenario-run.ts and graded the copy.
 *
 * Step one of getting out of that: lift it, unchanged. The body below is the
 * body that was in the component, with exactly fourteen mechanical
 * substitutions — five refs and nine React setters, now passed in. Nothing
 * else moved, and the transformation round-trips, so a diff proves it.
 *
 * `io` is React for now. It becomes a returned list of effects in step three,
 * once there are tests to catch what that changes.
 */
import type { Brief, TravelerProfile, Trip } from "@/lib/types";
import type { Question, Turn } from "@/lib/agent/types";
import { applyPatch, interestLine } from "@/lib/brief";
import { recommend, tiebreakPrompt } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { vibeLine, whyLine } from "@/lib/concept";
import { destinationById } from "@/data/destinations";
import { agent, isRateLimited, wasCancelled } from "@/lib/client";
import { isResearched, packFor, registerPack } from "@/data/registry";
import { rememberPack } from "@/lib/packstore";
import { enoughToPlan, placesPerCity, plannable, splitVerdict, validatePlaceList, type DestinationPack } from "@/lib/research";
import { heldPlaces, namesSomewhere, pinnedDestination, statedPlaces, subjects, toResearch } from "@/lib/subject";
import { effectiveDays } from "@/lib/discovery";
import { withStays } from "@/lib/stays";
import { unserved } from "@/lib/select";
import { placeById, placesInCity } from "@/data";
import { resolvePlaceName } from "@/lib/places";

export type Stage = "home" | "chat" | "proposal" | "itinerary";

/** Everything the turn needs to tell the screen. React supplies these today. */
export interface FlowIO {
  say: (from: "agent" | "user", text: string) => void;
  ask: (q: Question) => void;
  noteDriver: (d: string, r?: string) => void;
  setBrief: (b: Brief) => void;
  setTrip: (t: Trip | null | ((cur: Trip | null) => Trip | null)) => void;
  setStage: (s: Stage) => void;
  setQuestion: (q: Question | null) => void;
  setResearching: (s: string | null) => void;
  /** A streamed agent message: open one, then append to it as text arrives. */
  openStream: () => string;
  appendTo: (id: string) => (chunk: string) => void;
  closeStream: (id: string) => void;
  rememberSeen: (id: string) => void;
}

/**
 * The mutable bits the turn carries between calls.
 *
 * Refs rather than state, deliberately and for now: they are read live, in the
 * middle of a turn, after an await. `gen` is the cancellation token, `pitched`
 * is the pin that stops the recommender drifting off what it just pitched.
 * Turning these into values is step three, and it is the part that can break
 * things quietly, which is why it waits for tests.
 */
export interface FlowRefs {
  history: { current: Turn[] };
  pitched: { current: string | null };
  headline: { current: string };
  failedResearch: { current: string | null };
  gen: { current: number };
}
/**
 * What she reads when the allowance is gone.
 *
 * A real clock time, because "give it a few minutes" is not something anyone
 * can plan around, and the server already knows exactly when the window rolls.
 * No mention of starting a new session: the limit is keyed on IP address, so a
 * new tab, a new trip and cleared storage all change nothing, and offering an
 * escape that doesn't work is worse than naming the wait.
 */
export function limitLine(e: { reason?: "visitor" | "daily"; retryAfter: number }): string {
  if (e.reason === "daily") {
    const hours = Math.max(1, Math.round(e.retryAfter / 3600));
    return `That's this app's model budget for the whole day, gone. It comes back in about ${hours} hour${hours === 1 ? "" : "s"}. `
      + `I'd rather stop than hand you something I put together without it. If you want to carry on now, put your own Anthropic key in below.`;
  }
  const back = new Date(Date.now() + e.retryAfter * 1000)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `That's my limit for the hour. It comes back at ${back}. `
    + `I'd rather stop there than plan you something worse without saying so. If you don't want to wait, put your own Anthropic key in below and we'll carry on.`;
}

export const title = (s: string) =>
  s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/**
 * One call per base, in parallel, merged back into the pack.
 *
 * Deliberately forgiving: a base whose call fails or returns nothing keeps
 * whatever the first pass found for it. A thinner trip is a worse trip; no
 * trip is a broken product.
 */
async function fillInBases(
  pack: DestinationPack, days: number, interests: string, notes: string | undefined,
  api: FlowAgent,
): Promise<DestinationPack> {
  const cities = pack.cities.slice(0, 5);
  if (!cities.length) return pack;

  const perCity = placesPerCity(days, cities.length);
  const ask = async (c: { id: string; name: string }) => {
    try {
      const r = await api.researchPlaces(
        pack.destination.name, c.id, c.name, perCity, interests, notes,
      );
      return r.places;
    } catch {
      return undefined;
    }
  };

  let places = pack.places;
  const absorb = (raw: unknown) => {
    if (!raw) return 0;
    // Same validation as the first pass, and it knows what we already hold, so
    // the same restaurant coming back twice is dropped rather than scheduled
    // twice.
    const { places: extra } = validatePlaceList(raw, pack.destination.id, pack.cities, places);
    places = [...places, ...extra];
    return extra.length;
  };

  const first = await Promise.all(cities.map(ask));
  const empty = cities.filter((c, i) => absorb(first[i]) === 0);

  /*
   * Ask again for the bases that came back with nothing.
   *
   * These calls used to fail silently: a base that returned nothing simply got
   * no places, and a week in the Faroes came out as five things across seven
   * days with Tórshavn showing "A day off" twice in a row and ten hours free.
   * One of the three calls had failed and nobody asked it again.
   *
   * Only the empty ones, all at once, and only once. In the good case this
   * costs nothing at all, because there is nothing to retry.
   */
  if (empty.length) {
    const second = await Promise.all(empty.map(ask));
    second.forEach(absorb);
  }
  return { ...pack, places };
}

/** The researched pack a trip depends on, if it depends on one. */

/**
 * Everything advance() asks of the outside world.
 *
 * It took `agent` straight off the module singleton, which is the only reason
 * the 636 lines below have never been executed by a test. The whole suite
 * reads this file with readFileSync and regex-matches it: six scripts assert
 * that a source line exists and none of them assert that a turn does the right
 * thing, and the eval reimplements the turn rather than calling it. That is
 * how a green suite kept coexisting with a broken product, and how I kept
 * reporting fixes that were not fixed.
 *
 * One optional parameter, defaulted, so no caller changes.
 */
export type FlowAgent = Pick<
  typeof agent,
  "question" | "budget" | "suggest" | "researchStream" | "researchPack"
  | "researchPlaces" | "pitch" | "stays"
>;

export async function advance(
  brief0: Brief, prof: TravelerProfile, io: FlowIO, refs: FlowRefs,
  api: FlowAgent = agent,
): Promise<void> {
    let b = brief0;
    const hist = refs.history.current;
    // Every stage boundary is a chance to notice she has moved on. The long
    // ones are the research calls, which is exactly where she'll press stop.
    const gen = refs.gen.current;
    const live = () => refs.gen.current === gen;

    // Phase one: the conversation. Somewhere we don't hold yet is NOT a
    // problem to announce — "I don't cover Africa, here's a menu of fifteen
    // countries" is an implementation detail leaking into someone's holiday.
    // React to what they said, ask what you need, research later when you know
    // enough to research well.
    // Discovery decides WHERE, so it closes the moment a destination has been
    // pitched. Every answer re-enters advance() from the top, and without this
    // the model got another turn each time: it recommended Thailand, then
    // asked about diving, then about early starts, and the itinerary never
    // arrived. Answering a question cannot reopen a decision already made.
    if (!refs.pitched.current) {
      const { question: q, driver: dq, reason: rq } = await api.question(b, hist, "discovery");
      io.noteDriver(dq, rq);
      if (!live()) return;
      if (q) { io.ask(q); return; }
    }
    io.setQuestion(null);

    // Now, with a length and a sense of what they want, go and get anywhere
    // they named that isn't in the catalogue. Doing this first meant a
    // thirty-second silence before the agent had said anything at all.
    // The gate lives in lib/subject.ts, as a pure function, because this
    // branch decides whether she goes where she asked or somewhere else and
    // it was previously an inline condition no test could reach.
    /*
     * Nothing named. Ask where on earth, not which of fifteen.
     *
     * The recommender scores the catalogue, and the catalogue was the world:
     * the model's own suggestions were filtered against it and anything else
     * dropped. So "surprise me" could only ever return one of the entries we
     * already held, and Oregon, Florida and Alaska were unreachable unless
     * she named them herself. Growing the list by hand would never have fixed
     * that; it would only have moved the wall.
     *
     * Two rules, both hers:
     *
     * 1. It must not wander. This runs ONLY when she has named nowhere at
     *    all — no destination, no city, no shortlist, no region, nothing to
     *    research. A place or a region she named still decides it outright,
     *    and everything from tonight about not substituting still applies.
     *
     * 2. Better to say there isn't room than to produce something worse
     *    without saying so. A suggestion we cannot then research is a worse
     *    trip presented as a real one, so the allowance is checked BEFORE
     *    asking, and running out stops the turn with the limit message
     *    rather than quietly falling back to the fifteen.
     *
     * What comes back is a name. If we hold it, it plans instantly. If we
     * don't, it goes through the same research path as a place she named,
     * and joins the catalogue for good.
     */
    const namedNowhere = !b.namedDestination && !b.focusCityId
      && !(b.candidates?.length) && !(b.unknownCandidates?.length)
      && !(b.unknownCandidates?.length) && !b.region && !refs.pitched.current;
    if (namedNowhere && subjects(b).length === 0) {
      const room = await api.budget();
      if (!live()) return;
      if (room && room.ok === false) {
        io.say("agent", limitLine({ reason: room.reason, retryAfter: room.retryAfter }));
        return;
      }
      const { place, problem, driver: ds, reason: rs } = await api.suggest(b);
      io.noteDriver(ds, rs);
      if (!live()) return;
      if (place) {
        const held = resolvePlaceName(place);
        b = held
          // Already in the catalogue, whether it shipped that way or was
          // researched on some earlier trip. No distinction: one catalogue.
          ? applyPatch(b, { namedDestination: held.destinationId, focusCityId: held.cityId })
          : { ...b, unknownCandidates: [place] };
        io.setBrief(b);
      } else if (problem) {
        console.warn(`[suggest] ${problem}`);
      }
    }

    /*
     * A place she named that we already hold is the answer, not a gap.
     *
     * It used to be neither. The interpret step files a named place as
     * `unknownDestination`; `subjects()` then drops it because we hold it;
     * `suggest` is gated on `!b.unknownDestination` so it never runs; and the
     * gate before the recommender reads `subjects()`, so it has nothing to
     * defend. Every good path is off and the tag scorer is what is left. She
     * said "hm i wanna go to patagonia", with Patagonia already remembered
     * from an earlier session, and was pitched Utah.
     *
     * Knowing a place better must never make it easier to lose.
     */
    const held = heldPlaces(b);
    if (held.length) {
      b = {
        ...b,
        namedDestination: held.length === 1 ? held[0].trim().toLowerCase() : b.namedDestination,
        candidates: held.length > 1
          ? [...new Set([...(b.candidates ?? []), ...held.map((h) => h.trim().toLowerCase())])]
          : b.candidates,
        unknownCandidates: (b.unknownCandidates ?? [])
          .filter((c) => !held.some((h) => h.trim().toLowerCase() === c.trim().toLowerCase())),
        /*
         * The region goes too, and the first test ever to RUN this function
         * found out why.
         *
         * "hm i wanna go to patagonia" sets unknownCandidates AND a region of
         * South America with no ids in it. Settling cleared the first and left
         * the second, so subjects() still had "South America" to research, the
         * research failed, and she was told "I couldn't work up South America
         * properly just now" about a destination we hold and had just pinned.
         *
         * A place she named outranks the continent it is on. recommend() has
         * said so for months; this is the same rule one layer up.
         */
        region: undefined,
        regionLabel: undefined,
        regionIds: undefined,
      };
      io.setBrief(b);
    }

    const wanted = toResearch(b);

    if (wanted.length) {
      // Ask before starting. Four calls, and running out between the second
      // and the third means she reads a paragraph about somewhere she is then
      // not sent. One free round trip buys a sentence up front instead.
      const room = await api.budget();
      if (!live()) return;
      if (room && room.ok === false) {
        io.say("agent", limitLine({ reason: room.reason, retryAfter: room.retryAfter }));
        return;
      }

      const found: string[] = [];
      let failure: string | undefined;
      for (const subject of wanted) {
        io.setResearching(subject);
        // Record the attempt before making it. Whatever happens next — a good
        // pack, a truncated one, a dropped call, a reload — we have tried,
        // and the gate must not send us round again on the same turn.
        b = applyPatch(b, { researchTried: [subject] });
        try {
          // Two requests, because searching the web and then writing the data
          // pack together outlive a serverless function. The first is streamed
          // straight into the conversation, so she is reading the agent's take
          // on the place while the searches are still running.
          // What she SAID, which may be nothing. effectiveDays' 7 is a
          // planning default; handed to the researcher it comes back out of
          // the model's mouth as "seven days door to door", quoted at someone
          // who never gave a length, and used to rule out the trek she asked
          // for. The pack call still gets a number, because the scheduler
          // needs one to do arithmetic with.
          const days = b.days;
          const planDays = effectiveDays(b);
          const streamId = io.openStream();
          // The interest is what decides WHICH China she gets. Without it the
          // researcher writes the country's standard tourist route.
          const wants = interestLine(b);
          const notes = await api.researchStream(
            subject, days, b.origin?.label, io.appendTo(streamId), wants, b.avoidPlaces,
          );
          io.noteDriver(notes.driver, notes.reason);
          const split = notes.text ? splitVerdict(notes.text) : undefined;
          if (split?.verdict) {
            // Only the verdict was ever on screen; the transcript should match
            // what she actually read.
            refs.history.current = [...refs.history.current, { from: "agent" as const, text: split.verdict }].slice(-16);
          } else {
            io.closeStream(streamId);
          }
          /*
           * Ask twice before giving up on somewhere she named.
           *
           * This call turns the research into data, and when it comes back
           * short the traveller doesn't get a thinner trip, she gets a
           * different country. That is an enormous consequence for one flaky
           * call, and there was no retry at all: one attempt, then New
           * Zealand. The notes are already in hand, so a second attempt costs
           * one call rather than the whole research pass.
           */
          const structure = async () => notes.text
            ? await api.researchPack(subject, planDays, split?.detail || notes.text, notes.sources ?? [], wants)
            : { pack: undefined, problem: notes.problem, driver: notes.driver, reason: notes.reason };
          let { pack, problem, driver: dr, reason: rr } = await structure();
          io.noteDriver(dr, rr);
          if (!pack && notes.text && live()) {
            io.setResearching(`${title(subject)}, one more go`);
            ({ pack, problem, driver: dr, reason: rr } = await structure());
            io.noteDriver(dr, rr);
          }
          if (pack) {
            // Fill each base in properly, all at once.
            //
            // The destination call establishes the shape and comes back with a
            // spine of ten or twelve places. That was the whole trip, and over
            // twelve days across three bases it worked out at one thing a day.
            // Asking that one call for forty doesn't work: output tokens are
            // what caps it, and fifteen places already ran to nearly a minute.
            // So each base gets its own call and they all run together, which
            // costs about the wall-clock of one and returns three times as
            // much.
            // A long weekend in one town is often already covered by the
            // spine, and another round of calls to find out is thirty seconds
            // she spends watching a spinner for nothing.
            let filled = pack;
            if (!enoughToPlan(pack, planDays)) {
              io.setResearching(`${title(subject)}, filling in the days`);
              filled = await fillInBases(pack, planDays, wants, split?.detail || notes.text, api);
            }
            if (!live()) return;
            // Two different bars, and they must stay different.
            //
            // enoughToPlan decided whether to go and fetch more, above. This
            // decides whether to give up, and giving up means she goes to a
            // different country. Seven days in the Faroes came back with a
            // real three-base shape, lost two of its three fill-in calls, fell
            // short of the comfortable number, and got replaced with Paris.
            // A week with a thing a day is a trip. Downtime is a feature here.
            /*
             * A place that needs longer than she has is a question, not a
             * refusal, when she never said how long she had.
             *
             * minDays is the researcher's own "below this it isn't worth the
             * flight". With no stated length we plan against seven, so a
             * fourteen-day place would otherwise be crammed into a week or
             * argued out of, on a number we invented. She asked for a
             * multi-day remote trek and was told she couldn't have one.
             *
             * If she gave a length, this does not fire: refusing on a number
             * she actually chose is honest, and the pitch's caveat says it.
             */
            const needs = filled.destination.minDays;
            if (b.days === undefined && !b.flexibleDuration && needs > planDays) {
              registerPack(filled);
              rememberPack(filled);
              /*
               * Settle the subject before asking, or the question is a trap.
               *
               * This used to set candidates and return, leaving the place in
               * unknownCandidates while researchTried already held it. So her
               * next message, including the answer to this very question, hit
               * the statedPlaces guard below and was told the place "still
               * isn't coming together" -- about a pack that had just been
               * researched successfully and registered. Answering the question
               * was the one thing that could not get past it.
               *
               * The research worked. Record that it worked, exactly as the
               * success path does, and then ask.
               */
              b = applyPatch(b, { candidates: [filled.destination.id] });
              b = {
                ...b,
                unknownCandidates: undefined,
                regionIds: undefined,
                region: undefined,
                namedDestination: filled.destination.id,
              };
              io.setBrief(b);
              io.say("agent", `${title(subject)} wants ${needs} days at a minimum, and you haven't told me how long you've got. `
                + `Tell me and I'll build it properly, or say you're flexible and I'll plan it at ${needs}.`);
              return;
            }
            if (plannable(filled, planDays)) {
              registerPack(filled);
              // Keep it. Four model calls and the better part of a minute
              // went into this, and until now it was thrown away when the
              // tab closed.
              rememberPack(filled);
              found.push(filled.destination.id);
            } else {
              failure = subject;
            }
          } else {
            failure = subject;
            // Her problem is that she isn't going to Indian Wells. How many
            // rows came back is mine.
            if (problem) console.warn(`[research] ${subject}: ${problem}`);
          }
        } finally {
          io.setResearching(null);
        }
      }

      if (found.length) {
        const list = [...new Set([...(b.candidates ?? []), ...found])];
        // Not "acknowledged": the research WORKED. Nothing was un-covered and
        // nothing was said, so setting the flag here was a claim about a
        // conversation that never happened.
        b = applyPatch(b, { candidates: list });
        // The place is in the catalogue now, so it stops being an unknown and
        // stops being a region guess. Thailand researched is Thailand, not
        // "somewhere in Southeast Asia", and certainly not Bali.
        b = {
          ...b,
          unknownCandidates: undefined,
          regionIds: undefined,
          namedDestination: list.length > 1 ? undefined : list[0],
        };
        io.setBrief(b);
      } else {
        // Still no menu. Say what happened in one line and carry on with the
        // best thing we can actually plan.
        b = applyPatch(b, { unknownAcknowledged: true });
        io.setBrief(b);
        // Two rules here, both learned the hard way.
        //
        // One: never quote the machinery. "Only 7 usable places came back, not
        // enough to plan a trip" is a sentence about my data, glued to the next
        // sentence without so much as a full stop, and she read it on her
        // phone.
        //
        // Two: say that it is a different place. What follows is a real
        // recommendation, but it is not the one she asked for, and the pitch
        // must not be the first she hears of that.
        // Remember it, because the next sentence promises her a retry and
        // that promise has to be keepable. It wasn't: "say the word and I'll
        // try Faroe Islands again" was offered by an app with no way to try
        // again, so saying the word did nothing at all.
        refs.failedResearch.current = failure ?? wanted[0];
        const missed = title(refs.failedResearch.current ?? "it");
        /*
         * She named a place. We do not go looking anywhere else.
         *
         * This used to fall through to the recommender, which scored the whole
         * catalogue and pitched whatever won: a week in the Faroe Islands came
         * back as New Zealand, and a Lisbon brief came back as Mexico City.
         * The model was never the problem, it was handed a different
         * destination and faithfully argued for it.
         *
         * So the conversation stays on the subject. The three things actually
         * on the table are another attempt, fewer days, or her naming
         * somewhere else herself. Wandering off is not one of them.
         */
        io.say("agent", `I couldn't work up ${missed} properly just now, and I'm not going to send you somewhere else instead. `
          + `Say "try again" and I'll have another go, tell me a shorter trip and I'll see if that lands, or name somewhere else if you'd rather.`);
        return;
      }
    }

    /*
     * A destination that has been pitched is the decision, and stays the
     * decision until they reject it or name somewhere else.
     *
     * The recommender was re-run from scratch on every message, and the
     * novelty penalty — which exists so that asking to be surprised twice
     * gives two different answers — applies to the destination we just
     * pitched. So the thing we recommended started losing to the runner-up,
     * and any message at all could move you. Someone asked for more detail on
     * New Orleans and was told to go to Paris.
     *
     * Naming a different place still wins, and rejecting still clears the pin,
     * because both of those are the traveller actually changing their mind
     * rather than the scoring drifting underneath them.
     */
    /*
     * The last line of defence, and the only one that does not depend on a
     * flag being right.
     *
     * Her rule: "if you're on a convo about one specific region or country,
     * you should not search elsewhere, period."
     *
     * Every previous attempt to hold that line lived inside the research
     * block, so it only fired when research ran and failed. "i want to go to
     * hokkaido for 10 days" never got that far: a stale flag skipped the
     * block entirely, and the guard sat inside the thing that was skipped.
     * The pitch that came back was Portugal.
     *
     * So this asks the question at the point the decision is actually made,
     * about the brief rather than about the bookkeeping: is there a place on
     * the table that nobody has tried to look up? If so, no pitch. There is
     * no combination of flags that gets past it, because it reads no flags.
     */
    const open = statedPlaces(b)[0];
    if (open) {
      const tried = (b.researchTried ?? []).some(
        (x) => x.trim().toLowerCase() === open.trim().toLowerCase(),
      );
      console.warn(`[subject] reached the recommender with ${open} unresolved (tried=${tried})`);
      refs.failedResearch.current = open;
      io.say("agent", tried
        // Tried and it didn't come together. She has heard this once already;
        // saying it again is still better than a different country. A week in
        // the Faroes came back as Paris on the SECOND message, after the
        // honest line on the first, because nothing held the line past the
        // turn that printed it.
        ? `${title(open)} still isn't coming together for me, and I'd rather say that than quietly send you somewhere else. `
          + `Say "try again" for another go, tell me a shorter trip, or name somewhere else and I'll switch.`
        : `I haven't actually looked ${title(open)} up yet, and I'm not going to pitch you somewhere else while that's true. `
          + `Say "try again" and I'll go and do it properly.`);
      return;
    }

    const pinned = pinnedDestination(refs.pitched.current, b, prof);

    /*
     * "It must stay faithful to the user's input. That tops everything."
     *
     * Below this line the open-field branch of recommend() ranks the entire
     * catalogue on seven internal tags: nature, exploration, food, relaxation,
     * culture, adventure, city. Run against real briefs, "hike a national
     * park", "scuba dive coral reefs" and "safari, see big animals" return an
     * identical ranking, and so does a brief with no words in it at all.
     * recommend.ts reads neither `opening` nor `interestEcho`. So the pitch
     * that comes out is confident, specific prose about a decision that could
     * not have been reflecting anything she typed.
     *
     * The model picks destinations, in `suggest`, and it picks from the whole
     * world rather than a list. If that did not run or did not land, the
     * honest answer is to say so. Ranking tags is not a fallback, it is a
     * different product answering a question she did not ask.
     */
    if (!pinned && !namesSomewhere(b)) {
      console.warn("[fidelity] nothing named on the brief; refusing to rank the catalogue");
      io.say("agent", `I don't have enough from you yet to pick somewhere, and I'd rather say that than guess. `
        + `Tell me a place, a region, or what you want out of the trip, and I'll go and work it up.`);
      return;
    }

    const rec = pinned
      // Cleared alongside it: a shortlist or a region is matched before a
      // named destination, so leaving them set would beat the pin.
      ? recommend({ ...b, namedDestination: pinned, candidates: undefined, regionIds: undefined }, prof)
      : recommend(b, prof);

    // Only pitch once per destination. Answering "how long?" after the pitch
    // comes back through here, and hearing the same paragraph twice reads as
    // a bug.
    if (refs.pitched.current !== rec.destinationId) {
      const { pitch } = await api.pitch(rec, b);
      refs.pitched.current = rec.destinationId;
      refs.headline.current = pitch.headline;
      io.say("agent", pitch.headline);
      io.say("agent", pitch.body);
    }

    // Remember what it has already offered. This is what stops "surprise me"
    // returning the same destination on every click, and it is the only reason
    // a second surprise can differ from the first.
    if (!rec.noGoodFit) io.rememberSeen(rec.destinationId);

    // Nothing fits. Say so and stay in the conversation — free text is right
    // there, so "make it 10 days" or "ok, $2,500" picks straight back up.
    if (rec.noGoodFit) return;

    // Section 7: genuinely torn — ask the one question that settles it.
    if (rec.confidence !== "high" && rec.alternativeId) {
      io.setQuestion({
        id: "tiebreak", kind: "single",
        prompt: tiebreakPrompt(rec) ?? "Which of these two?",
        options: [
          { value: rec.destinationId, label: destinationById(rec.destinationId).name },
          { value: rec.alternativeId, label: destinationById(rec.alternativeId).name },
        ],
      });
      return;
    }

    // Phase two: what's left before it can be planned.
    const { question: lq, driver: dl, reason: rl } = await api.question(b, hist, "logistics");
    io.noteDriver(dl, rl);
    if (!live()) return;
    if (lq) { io.ask(lq); return; }
    io.setQuestion(null);

    const t = planTrip(b, rec, prof);

    /*
     * Say what the trip does not do.
     *
     * "i wanna go to portugal for surfing" returned Alfama, Sao Jorge Castle
     * and a cliff walk, and said nothing. Portugal is held, so no research
     * runs and the catalogue is the whole universe; the catalogue has no surf
     * in it; and until activities existed there was nothing that could ask.
     *
     * The trip still goes on screen, because it is a real Portugal trip and
     * she asked for one. What changes is that the gap is named rather than
     * papered over, which is her rule for thin destinations: leave honest gaps
     * and say what they are.
     */
    const scheduled = t.days.flatMap((d) => d.items
      .map((i) => ("placeId" in i && i.placeId ? placeById(i.placeId) : undefined))
      .filter((x): x is NonNullable<typeof x> => !!x));
    /*
     * Three answers, not one.
     *
     * This asserted a CATALOGUE fact from a SCHEDULING outcome: on a three-day
     * Copenhagen trip it said "Nothing I have for Copenhagen does that" about
     * jazz, with a jazz club sitting in the very city it had scheduled, and
     * then offered to go and research a place we already hold. The two cases
     * need different sentences, and the third needs none.
     */
    /*
     * Day-trip cities count.
     *
     * This read l.cityId only, and a shape leg can carry a dayTrip alongside
     * it. So "i wanna go to portugal for cliffs" was told "Nothing I have for
     * Portugal does that. I'll go and look properly" on a plan that had
     * already scheduled the Praia da Ursa cliff walk, out at Sintra. Same
     * shape as the bug this message was written to fix, moved one field over.
     */
    const available = t.concept.shape.flatMap((l) =>
      [...placesInCity(l.cityId),
       ...(l.dayTrip ? placesInCity(l.dayTrip) : []),
       ...(l.extraDayTrip ? placesInCity(l.extraDayTrip) : [])]);
    const nowhere = unserved(available, b.activities);
    const notToday = unserved(scheduled, b.activities).filter((a) => !nowhere.includes(a));
    const list = (xs: string[]) =>
      xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
    if (nowhere.length) {
      console.warn(`[unserved] not in catalogue: ${nowhere.join(", ")} (${rec.destinationId})`);
      io.say("agent", `${nowhere.length === 1 ? "One thing" : `${nowhere.length} things`} this doesn't cover: `
        + `${list(nowhere)}. Nothing I have for ${destinationById(rec.destinationId).name} does that, so `
        + `I've left ${nowhere.length === 1 ? "it" : "them"} out rather than pretend. `
        + `Tell me if it's the point of the trip and I'll go and look properly.`);
    }
    if (notToday.length) {
      console.warn(`[unserved] held but unscheduled: ${notToday.join(", ")}`);
      io.say("agent", `I have something for ${list(notToday)} here, but ${notToday.length === 1 ? "it" : "they"} `
        + `didn't fit in ${t.days.length} days. Say the word and I'll make room.`);
    }

    t.concept.headline = refs.headline.current;
    t.concept.vibe = vibeLine(t, b);
    // The pitch is already in the thread above; the card gets the concrete
    // version rather than the same paragraph twice.
    t.concept.why = whyLine(t, b);
    io.setTrip(t);
    io.setStage("proposal");

    // Rooms arrive after the proposal is already on screen. "4 nights in
    // Lisbon" is a placeholder; a name, a price, a reason and the catch is
    // something she can act on. Waiting for it before showing anything would
    // just be another spinner.
    void (async () => {
      try {
        const { stays, driver: ds, reason: rs } = await api.stays(t.concept.shape, b, rec.destinationId);
        /*
         * The only await in this turn that had no generation guard.
         *
         * Every other one is followed by `if (!live()) return;`. This one runs
         * after the turn has handed control back, so a second turn started
         * while the rooms were in flight got them anyway: Memmo Alfama and
         * Memmo Príncipe Real named in the Sleep panel of a Tokyo itinerary,
         * with the Hotels row still showing the Japanese number, because no
         * cityId matched and withStays writes concept.stays regardless.
         */
        if (!live()) return;
        io.noteDriver(ds, rs);
        // And only onto the trip they were asked for: setTrip's callback can
        // still be handed a later trip by React even inside a live turn.
        if (stays?.length) {
          io.setTrip((cur) => (cur && cur.id === t.id ? withStays(cur, stays) : cur));
        }
      } catch {
        // Rooms arrive after the proposal is already on screen, so a limit or a
        // cancellation here costs the placeholder wording and nothing else.
        // Unhandled, it was a red error in the console on every stopped trip.
      }
    })();
}
