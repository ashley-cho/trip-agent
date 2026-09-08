"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Brief, ItineraryItem, TravelerProfile, Trip } from "@/lib/types";
import { emptyBrief, emptyProfile } from "@/lib/types";
import type { Question, Turn } from "@/lib/agent/types";
import { applyPatch, interestLine } from "@/lib/brief";
import { alreadyInTheTrip, whatTheRebuildDid } from "@/lib/answer";
import { recommend, tiebreakPrompt } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { applyOps } from "@/lib/edit";
import { vibeLine, whyLine } from "@/lib/concept";
import { destinationById } from "@/data/destinations";
import { abortInFlight, agent, isRateLimited, loadProfile, saveProfile, sendFeedback, wasCancelled } from "@/lib/client";
import { detectOrigin } from "@/lib/origin";
import { isResearched, packFor, registerPack } from "@/data/registry";
import { hydratePacks, rememberPack } from "@/lib/packstore";
import { withStays } from "@/lib/stays";
import { Trips } from "@/components/Trips";
import { Account } from "@/components/Account";
import { Install } from "@/components/Install";
import { Theme } from "@/components/Theme";
import { OwnKey } from "@/components/OwnKey";
import { TotalSpend, TripSpend } from "@/components/Spend";
import {
  deleteTrip, forgetCurrent, listTrips, newTripId, rememberCurrent, resumable,
  saveTrip, tripName, type SavedTrip,
} from "@/lib/trips";
import { deleteRemote, pushTrip, tombstone } from "@/lib/sync";
import { billTo } from "@/lib/client";
import { forgetSpend } from "@/lib/spend";
import { enoughToPlan, placesPerCity, plannable, splitVerdict, validatePlaceList, type DestinationPack } from "@/lib/research";
import { pinnedDestination, subjects, toResearch } from "@/lib/subject";
import { resolvePlaceName } from "@/lib/places";
import { readPushback } from "@/lib/pushback";
import { REJECT_REASONS, applyRejection, type RejectReasonId } from "@/lib/reject";
import { effectiveDays, wantsRetry } from "@/lib/discovery";

/**
 * What she reads when the allowance is gone.
 *
 * A real clock time, because "give it a few minutes" is not something anyone
 * can plan around, and the server already knows exactly when the window rolls.
 * No mention of starting a new session: the limit is keyed on IP address, so a
 * new tab, a new trip and cleared storage all change nothing, and offering an
 * escape that doesn't work is worse than naming the wait.
 */
function limitLine(e: { reason?: "visitor" | "daily"; retryAfter: number }): string {
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

const title = (s: string) =>
  s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const hostOf = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};
import { Bubble, Chips, Composer, Thinking, type Msg } from "@/components/Chat";
import { Proposal } from "@/components/Proposal";
import { Itinerary } from "@/components/Itinerary";
import { Feedback } from "@/components/Feedback";

declare const __TRIP_AGENT_STANDALONE__: boolean | undefined;
const STANDALONE =
  typeof __TRIP_AGENT_STANDALONE__ !== "undefined" && __TRIP_AGENT_STANDALONE__;

type Stage = "home" | "chat" | "proposal" | "itinerary";
let mid = 0;
const nextId = () => `m${mid++}`;

/**
 * Examples, shown one at a time in the box itself.
 *
 * These were buttons under the composer: the same three, every time, sitting
 * where options go. On an open text box that reads as "pick one of these"
 * rather than "say anything", which is the opposite of the point. In the
 * placeholder they do the one job they were for — showing the kind of thing
 * you can say — and then get out of the way the moment she types.
 */
const OPENERS = [
  "I need a vacation. Surprise me.",
  "I want to get away somewhere warm.",
  "Somewhere I can eat well and walk a lot.",
  "Ten days, nothing planned, nowhere decided.",
  "I want to go to Oaxaca for the markets.",
  "Northern lights, and I can drive.",
  "Somewhere I've never heard of.",
  "A week off and I'm tired of cities.",
  "I want mountains and a long dinner.",
  "Take me somewhere for the food.",
  "Nothing touristy. Nowhere I have to queue.",
  "I want to go abroad and not think about it.",
];

/**
 * One call per base, in parallel, merged back into the pack.
 *
 * Deliberately forgiving: a base whose call fails or returns nothing keeps
 * whatever the first pass found for it. A thinner trip is a worse trip; no
 * trip is a broken product.
 */
async function fillInBases(
  pack: DestinationPack, days: number, interests: string, notes?: string,
): Promise<DestinationPack> {
  const cities = pack.cities.slice(0, 5);
  if (!cities.length) return pack;

  const perCity = placesPerCity(days, cities.length);
  const ask = async (c: { id: string; name: string }) => {
    try {
      const r = await agent.researchPlaces(
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
function packForTrip(brief: Brief, trip: Trip | null): DestinationPack | undefined {
  const id = trip?.concept.destinationId ?? brief.namedDestination;
  return id && isResearched(id) ? packFor(id) : undefined;
}

export default function Page() {
  const [stage, setStage] = useState<Stage>("home");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [brief, setBrief] = useState<Brief>(emptyBrief());
  const [question, setQuestion] = useState<Question | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [profile, setProfile] = useState<TravelerProfile>(emptyProfile());
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<string[]>([]);
  // Which driver actually answered the last call. "Is it really calling a
  // model?" should be observable, not a matter of faith.
  const [driver, setDriver] = useState<string | null>(null);
  const [driverNote, setDriverNote] = useState<string | null>(null);
  const [researching, setResearching] = useState<string | null>(null);
  const [fellBack, setFellBack] = useState(0);
  // Trips as projects. A conversation used to die with the tab; planning a
  // trip happens over days and usually with two or three ideas alive at once.
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const tripIdRef = useRef<string>(newTripId());
  const endRef = useRef<HTMLDivElement>(null);
  // A ref, not state: advance() runs inside the same tick as the say() calls
  // that precede it, so a state read would be one turn stale.
  const historyRef = useRef<Turn[]>([]);
  const pitchedRef = useRef<string | null>(null);
  const headlineRef = useRef<string>("");
  // The last question actually put to her, and anything worth saying back
  // about the message that didn't answer it. Both exist for the same failure:
  // "Roughly what do you want to spend?", then "i've already been to tulum",
  // then "Roughly what do you want to spend?", then "you gotta update the plan
  // coz i don't wanna go to tulum again", then "Roughly what do you want to
  // spend?" — the same sentence three times, acknowledging nothing. That is
  // the form this product exists to replace, reached by accident.
  //
  // Keyed on the SENTENCE, not the question id. Every model-authored question
  // carries the id "open", so keying on the id treated each new question as a
  // repeat of the last one and stamped "Understood, that just doesn't settle
  // it on its own." onto three perfectly good, entirely different questions in
  // a row. The thing that must never happen twice is the same words.
  const askedRef = useRef<string | null>(null);
  const ackRef = useRef<string | null>(null);
  // Bumped whenever work is called off, so anything still in flight when it
  // lands knows it is answering a question she has already moved on from.
  const genRef = useRef(0);
  // Somewhere she asked for that we couldn't work up, kept so that "try again"
  // is an instruction rather than a sentiment.
  const failedResearchRef = useRef<string | null>(null);
  /*
   * `modify` is declared after `send`, and `send` now hands it anything typed
   * at a finished plan that is not pushback. A ref is the smallest way across
   * that ordering without reshuffling both callbacks.
   */
  const modifyRef = useRef<((text: string, alreadyEchoed?: boolean, fresh?: Brief, replan?: boolean) => Promise<void>) | null>(null);

  useEffect(() => { setProfile(loadProfile()); }, []);
  useEffect(() => { setTrips(listTrips()); }, []);
  /*
   * Everywhere it has looked up before rejoins the catalogue on load, so the
   * second trip to a researched place is instant and free. Before this, the
   * lookup was memory-only: ask about Jerusalem, close the tab, and tomorrow
   * it costs the same four calls and the same minute all over again.
   *
   * Ordered before anything reads DESTINATIONS, and registerPack refuses to
   * shadow a hand-written destination, so the seeded fifteen are safe.
   */
  useEffect(() => { hydratePacks(); }, []);


  /**
   * Autosave. Every message, every plan change. Nothing to remember to press,
   * because nobody presses save on a conversation.
   */
  useEffect(() => {
    if (stage === "home" || msgs.length === 0) return;
    const id = tripIdRef.current;
    const existing = trips.find((t) => t.id === id);
    const record: SavedTrip = {
      id,
      name: tripName(brief, trip, msgs.find((m) => m.from === "user")?.text),
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      stage: stage as SavedTrip["stage"],
      brief, msgs, trip,
      history: historyRef.current,
      // A researched destination exists only in this tab's memory, so the trip
      // has to carry it or it can never be opened again.
      pack: packForTrip(brief, trip),
    };
    saveTrip(record);
    rememberCurrent(id);
    billTo(id);
    void pushTrip(record);
    setTrips(listTrips());
    // `trips` is deliberately not a dependency: saving updates it, and
    // depending on it would save again on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, brief, trip, stage]);

  /** Pick up exactly where it was left, including what the model was told. */
  const openTrip = (id: string) => {
    const t = listTrips().find((x) => x.id === id);
    if (!t) return;
    // Put the researched catalogue back before anything renders off it.
    // Without this the destination resolves to nothing and the render throws,
    // which is not a broken trip, it is a broken app: "This page couldn't
    // load", every trip in the browser gone with it.
    if (t.pack) registerPack(t.pack);
    tripIdRef.current = t.id;
    billTo(t.id);
    historyRef.current = t.history ?? [];
    pitchedRef.current = t.trip?.concept.destinationId ?? null;
    headlineRef.current = t.trip?.concept.headline ?? "";
    askedRef.current = null;
    ackRef.current = null;
    // Restored with the rest, because the transcript she is reading ends with
    // "Say try again and I'll have another go" and that offer is read from
    // this ref. Unrestored, the first "try again" after a reload did nothing.
    failedResearchRef.current = subjects(t.brief)[0] ?? null;
    setBrief(t.brief);
    setMsgs(t.msgs);
    setTrip(t.trip);
    setQuestion(null);
    setStage(t.stage);
  };

  // A reload used to start a new conversation and orphan the old one, which
  // read as the app forking your trip behind your back. Come back to where you
  // were instead; "All trips" is how you deliberately leave it.
  useEffect(() => {
    const t = resumable();
    if (t) openTrip(t.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeTrip = (id: string) => {
    deleteTrip(id);
    forgetSpend(id);
    // Record it, then tell the server. Without the record, the next sync sees
    // the row still sitting there and helpfully brings it back.
    tombstone(id);
    void deleteRemote(id);
    setTrips(listTrips());
  };

  /** A fresh sheet, without wiping what's already saved. */
  const startNew = () => {
    forgetCurrent();
    tripIdRef.current = newTripId();
    billTo(tripIdRef.current);
    historyRef.current = [];
    pitchedRef.current = null;
    headlineRef.current = "";
    askedRef.current = null;
    ackRef.current = null;
    setBrief(emptyBrief());
    setMsgs([]);
    setTrip(null);
    setQuestion(null);
    setFellBack(0);
    setStage("home");
    setTrips(listTrips());
  };
  // Where they're flying from, from the browser's timezone. No permission
  // prompt, no dialog, right to within a few hundred kilometres — which is all
  // a seeded airfare can honestly claim anyway. A typed correction overrides it.
  useEffect(() => {
    const o = detectOrigin();
    if (o) setBrief((b) => (b.origin ? b : { ...b, origin: o }));
  }, []);
  useEffect(() => { saveProfile(profile); }, [profile]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, stage]);

  // Report what answered, not what was configured. "fallback" means a model
  // was set up and this call failed; the reason rides along so a tester can
  // see a bad key or a dropped connection instead of quietly judging regexes.
  const noteDriver = (d: string, reason?: string) => {
    // The pill showed the LAST call's driver, so one green "model" could hide
    // an earlier call in the same turn that quietly fell back to rules. Count
    // them for the session and keep saying so.
    if (d === "fallback") {
      setFellBack((n) => n + 1);
      setDriverNote(reason ?? null);
    }
    setDriver(d);
  };

  // --- what it remembers between trips (§16-18) ----------------------------

  const rememberSeen = (id: string) =>
    setProfile((p) => ({
      ...p,
      seenDestinationIds: [...p.seenDestinationIds.filter((x) => x !== id), id].slice(-12),
    }));

  const rememberRejected = (id: string) =>
    setProfile((p) => ({
      ...p,
      rejectedDestinationIds: [...new Set([...p.rejectedDestinationIds, id])].slice(-12),
    }));

  /**
   * Taking a trip all the way to an itinerary is the strongest signal there is
   * about what this person actually wants. Weaker than an explicit statement,
   * so it only ever counts when they state nothing next time.
   */
  const rememberAccepted = (t: Trip, b: Brief) =>
    setProfile((p) => {
      const lean = { ...p.vibeLeanings };
      for (const v of b.vibes) lean[v] = (lean[v] ?? 0) + 1;
      return { ...p, vibeLeanings: lean, tripsPlanned: p.tripsPlanned + 1 };
    });

  const forget = () => {
    const fresh = { ...emptyProfile(), seed: profile.seed };
    setProfile(fresh);
    saveProfile(fresh);
  };

  const say = (from: Msg["from"], text: string) => {
    historyRef.current = [...historyRef.current, { from, text }].slice(-16);
    setMsgs((m) => [...m, { id: nextId(), from, text }]);
  };

  /**
   * A message that grows as text arrives. Waiting a minute and then dumping a
   * card is the difference between this feeling slow and feeling alive; the
   * words start about a second in.
   */
  const openStream = (): string => {
    const id = nextId();
    setMsgs((m) => [...m, { id, from: "agent", text: "" }]);
    return id;
  };
  const appendTo = (id: string) => (chunk: string) =>
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, text: x.text + chunk } : x)));

  /*
   * A second way of asking the same thing, for when the first one didn't land.
   *
   * Not a rephrasing for its own sake. If she has answered twice and the slot
   * is still empty, then either she doesn't have a number or she doesn't think
   * it's the interesting question, and repeating the chips at her says neither
   * was heard.
   */
  const REASK: Record<string, string> = {
    budget: "I still need a rough number before I can book you anywhere, even a ceiling you'd be annoyed to pass.",
    duration: "I do still need the length though, even roughly. How many days?",
    vibes: "What I still don't have is what you actually want out of this one.",
  };

  /** Put a question to her, without ever putting the identical sentence twice. */
  const ask = useCallback((q: Question) => {
    const key = q.prompt.trim().toLowerCase();
    const again = askedRef.current === key;
    const ack = ackRef.current;
    askedRef.current = key;
    ackRef.current = null;
    setQuestion(q);
    if (!again) { say("agent", ack ? `${ack} ${q.prompt}` : q.prompt); return; }
    say("agent", [
      ack ?? "Understood, that just doesn't settle it on its own.",
      REASK[q.id] ?? q.prompt,
    ].join(" "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- discovery loop ------------------------------------------------------

  const advance = useCallback(async (brief0: Brief, prof: TravelerProfile) => {
    let b = brief0;
    const hist = historyRef.current;
    // Every stage boundary is a chance to notice she has moved on. The long
    // ones are the research calls, which is exactly where she'll press stop.
    const gen = genRef.current;
    const live = () => genRef.current === gen;

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
    if (!pitchedRef.current) {
      const { question: q, driver: dq, reason: rq } = await agent.question(b, hist, "discovery");
      noteDriver(dq, rq);
      if (!live()) return;
      if (q) { ask(q); return; }
    }
    setQuestion(null);

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
      && !b.unknownDestination && !b.region && !pitchedRef.current;
    if (namedNowhere && subjects(b).length === 0) {
      const room = await agent.budget();
      if (!live()) return;
      if (room && room.ok === false) {
        say("agent", limitLine({ reason: room.reason, retryAfter: room.retryAfter }));
        return;
      }
      const { place, problem, driver: ds, reason: rs } = await agent.suggest(b);
      noteDriver(ds, rs);
      if (!live()) return;
      if (place) {
        const held = resolvePlaceName(place);
        b = held
          // Already in the catalogue, whether it shipped that way or was
          // researched on some earlier trip. No distinction: one catalogue.
          ? applyPatch(b, { namedDestination: held.destinationId, focusCityId: held.cityId })
          : { ...b, unknownCandidates: [place], unknownDestination: place };
        setBrief(b);
      } else if (problem) {
        console.warn(`[suggest] ${problem}`);
      }
    }

    const wanted = toResearch(b);

    if (wanted.length) {
      // Ask before starting. Four calls, and running out between the second
      // and the third means she reads a paragraph about somewhere she is then
      // not sent. One free round trip buys a sentence up front instead.
      const room = await agent.budget();
      if (!live()) return;
      if (room && room.ok === false) {
        say("agent", limitLine({ reason: room.reason, retryAfter: room.retryAfter }));
        return;
      }

      const found: string[] = [];
      let failure: string | undefined;
      for (const subject of wanted) {
        setResearching(subject);
        // Record the attempt before making it. Whatever happens next — a good
        // pack, a truncated one, a dropped call, a reload — we have tried,
        // and the gate must not send us round again on the same turn.
        b = applyPatch(b, { researchTried: [subject] });
        try {
          // Two requests, because searching the web and then writing the data
          // pack together outlive a serverless function. The first is streamed
          // straight into the conversation, so she is reading the agent's take
          // on the place while the searches are still running.
          const days = effectiveDays(b);
          const streamId = openStream();
          // The interest is what decides WHICH China she gets. Without it the
          // researcher writes the country's standard tourist route.
          const wants = interestLine(b);
          const notes = await agent.researchStream(
            subject, days, b.origin?.label, appendTo(streamId), wants,
          );
          noteDriver(notes.driver, notes.reason);
          const split = notes.text ? splitVerdict(notes.text) : undefined;
          if (split?.verdict) {
            // Only the verdict was ever on screen; the transcript should match
            // what she actually read.
            historyRef.current = [...historyRef.current, { from: "agent" as const, text: split.verdict }].slice(-16);
          } else {
            setMsgs((m) => m.filter((x) => x.id !== streamId));
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
            ? await agent.researchPack(subject, days, split?.detail || notes.text, notes.sources ?? [], wants)
            : { pack: undefined, problem: notes.problem, driver: notes.driver, reason: notes.reason };
          let { pack, problem, driver: dr, reason: rr } = await structure();
          noteDriver(dr, rr);
          if (!pack && notes.text && live()) {
            setResearching(`${title(subject)}, one more go`);
            ({ pack, problem, driver: dr, reason: rr } = await structure());
            noteDriver(dr, rr);
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
            if (!enoughToPlan(pack, days)) {
              setResearching(`${title(subject)}, filling in the days`);
              filled = await fillInBases(pack, days, wants, split?.detail || notes.text);
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
            if (plannable(filled, days)) {
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
          setResearching(null);
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
          unknownDestination: undefined,
          regionIds: undefined,
          namedDestination: list.length > 1 ? undefined : list[0],
        };
        setBrief(b);
      } else {
        // Still no menu. Say what happened in one line and carry on with the
        // best thing we can actually plan.
        b = applyPatch(b, { unknownAcknowledged: true });
        setBrief(b);
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
        failedResearchRef.current = failure ?? wanted[0];
        const missed = title(failedResearchRef.current ?? "it");
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
        say("agent", `I couldn't work up ${missed} properly just now, and I'm not going to send you somewhere else instead. `
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
    const open = subjects(b)[0];
    if (open) {
      const tried = (b.researchTried ?? []).some(
        (x) => x.trim().toLowerCase() === open.trim().toLowerCase(),
      );
      console.warn(`[subject] reached the recommender with ${open} unresolved (tried=${tried})`);
      failedResearchRef.current = open;
      say("agent", tried
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

    const pinned = pinnedDestination(pitchedRef.current, b, prof);

    const rec = pinned
      // Cleared alongside it: a shortlist or a region is matched before a
      // named destination, so leaving them set would beat the pin.
      ? recommend({ ...b, namedDestination: pinned, candidates: undefined, regionIds: undefined }, prof)
      : recommend(b, prof);

    // Only pitch once per destination. Answering "how long?" after the pitch
    // comes back through here, and hearing the same paragraph twice reads as
    // a bug.
    if (pitchedRef.current !== rec.destinationId) {
      const { pitch } = await agent.pitch(rec, b);
      pitchedRef.current = rec.destinationId;
      headlineRef.current = pitch.headline;
      say("agent", pitch.headline);
      say("agent", pitch.body);
    }

    // Remember what it has already offered. This is what stops "surprise me"
    // returning the same destination on every click, and it is the only reason
    // a second surprise can differ from the first.
    if (!rec.noGoodFit) rememberSeen(rec.destinationId);

    // Nothing fits. Say so and stay in the conversation — free text is right
    // there, so "make it 10 days" or "ok, $2,500" picks straight back up.
    if (rec.noGoodFit) return;

    // Section 7: genuinely torn — ask the one question that settles it.
    if (rec.confidence !== "high" && rec.alternativeId) {
      setQuestion({
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
    const { question: lq, driver: dl, reason: rl } = await agent.question(b, hist, "logistics");
    noteDriver(dl, rl);
    if (!live()) return;
    if (lq) { ask(lq); return; }
    setQuestion(null);

    const t = planTrip(b, rec, prof);
    t.concept.headline = headlineRef.current;
    t.concept.vibe = vibeLine(t, b);
    // The pitch is already in the thread above; the card gets the concrete
    // version rather than the same paragraph twice.
    t.concept.why = whyLine(t, b);
    setTrip(t);
    setStage("proposal");

    // Rooms arrive after the proposal is already on screen. "4 nights in
    // Lisbon" is a placeholder; a name, a price, a reason and the catch is
    // something she can act on. Waiting for it before showing anything would
    // just be another spinner.
    void (async () => {
      try {
        const { stays, driver: ds, reason: rs } = await agent.stays(t.concept.shape, b, rec.destinationId);
        noteDriver(ds, rs);
        if (stays?.length) setTrip((cur) => (cur ? withStays(cur, stays) : cur));
      } catch {
        // Rooms arrive after the proposal is already on screen, so a limit or a
        // cancellation here costs the placeholder wording and nothing else.
        // Unhandled, it was a red error in the console on every stopped trip.
      }
    })();
  }, []);

  /** Call off whatever is running. The next thing she types is the point. */
  const stop = useCallback(() => {
    genRef.current++;
    abortInFlight();
    setBusy(false);
    setResearching(null);
  }, []);

  const send = useCallback(async (text: string) => {
    const gen = ++genRef.current;
    say("user", text);
    setBusy(true);
    setQuestion(null);
    try {
      const { patch, driver: dv, reason: rv } = await agent.interpret(text, brief);
      noteDriver(dv, rv);
      let b = applyPatch(brief, patch);

      /*
       * "Try again" means try again.
       *
       * Research that failed is marked acknowledged so the agent doesn't spend
       * another forty seconds on it every single turn. The cost of that was
       * that the retry it had just offered her in writing was impossible: the
       * gate stayed shut and she got the substitute a second time. Asking for
       * it explicitly reopens exactly that one place, and clears the pin so
       * the recommendation is genuinely made again rather than being the
       * stand-in we already chose.
       */
      if (failedResearchRef.current && wantsRetry(text) && !patch.namedDestination) {
        const again = failedResearchRef.current;
        failedResearchRef.current = null;
        pitchedRef.current = null;
        headlineRef.current = "";
        askedRef.current = null;
        b = {
          ...b,
          unknownAcknowledged: false,
          // "Try again" means try again. Having tried is why the gate is shut,
          // so the record of that attempt is what has to be cleared, or the
          // promise in the retry offer is one the app cannot keep.
          researchTried: (b.researchTried ?? []).filter(
            (x) => x.trim().toLowerCase() !== again.trim().toLowerCase(),
          ),
          unknownCandidates: [again],
          candidates: undefined,
          regionIds: undefined,
          namedDestination: undefined,
        };
        setTrip(null);
        setStage("chat");
        setBrief(b);
        say("agent", `Going back to ${title(again)}.`);
        await advance(b, profile);
        return;
      }

      // What she said that's worth saying back, if the next thing out of my
      // mouth turns out to be a question she has already been asked once.
      // "i've already been to tulum" is a real instruction; hearing the budget
      // chips again is being told it went nowhere.
      const ruledOut = [
        ...(patch.visitedNames ?? []),
        ...(patch.visitedIds ?? []).map((id) => {
          try { return destinationById(id).name; } catch { return id; }
        }),
      ].filter((x, i, a) => a.indexOf(x) === i);
      ackRef.current = ruledOut.length
        ? `Noted, no ${title(ruledOut.slice(0, 2).join(" or "))}.`
        : (patch.constraints?.length || patch.avoidTags?.length ? "Noted." : null);

      // Typing at the proposal is pushback, so it has to be able to change the
      // answer. A named destination is treated as a decision everywhere else,
      // which would have made "somewhere warmer" re-plan the same country.
      // Naming a different place in the same breath still wins.
      let p2 = profile;

      // "I've been there" is permanent, so it outlives this conversation.
      if (patch.visitedIds?.length) {
        p2 = {
          ...p2,
          visitedDestinationIds: [
            ...new Set([...p2.visitedDestinationIds, ...patch.visitedIds]),
          ],
        };
        setProfile(p2);
        // A place they've now ruled out cannot stay the thing we're pitching.
        // Without this, saying "I've already done the Grand Canyon" after the
        // pitch left pitchedRef pointing at it, so the next recommendation was
        // suppressed as a repeat and they got the same paragraph again.
        if (pitchedRef.current && patch.visitedIds.includes(pitchedRef.current)) {
          pitchedRef.current = null;
          headlineRef.current = "";
          setTrip(null);
          setStage("chat");
        }
      }

      /*
       * Every message adds. Nothing is ever taken away.
       *
       * Two rules from Ashley, and they replace what was here:
       *
       *   "it shouldn't remove any context that was given. If the person
       *    wants to start fresh, they'll just start a new session."
       *   "the open text box just assumes one scenario. but honestly no. it's
       *    an input to make the result more optimized and better."
       *
       * What was here did the opposite of both. Any typed message at a plan
       * cleared the destination, cleared the pin, marked the place rejected
       * and re-ran the recommender from a brief that had just been emptied.
       * An LA itinerary for the 2028 Olympics plus "has the la olympics
       * schedule come out yet? i'm just interested in tennis matches" came
       * back as South Korea: her question deleted Los Angeles and then the
       * catalogue was re-scored on tennis and food.
       *
       * My first fix classified the message and only demolished on real
       * pushback. Better, and still the wrong shape: it treated the box as a
       * branch between "keep" and "throw away" when it is neither. It is an
       * input. "I'm just interested in tennis matches" should have made the
       * Los Angeles trip MORE about tennis.
       *
       * So: the patch is already merged into `b` above, which is the adding.
       * Nothing here clears a field. Where she is going changes only when a
       * newer fact says so — she names somewhere else, or she turns this one
       * down — and turning it down is recorded as a fact rather than as an
       * erasure, so the brief still remembers she asked for it.
       */
      if (stage === "proposal" && trip) {
        const current = trip.concept.destinationId;
        const { moveOn, reason } = readPushback(text, patch, b, current);

        if (moveOn && reason === "rejected") {
          /*
           * A no is a new fact, not a deletion. `namedDestination` stays
           * exactly as she said it; the recommender reads the rejection and
           * declines to hand it back. Both things she told us survive, and
           * the newer one wins.
           */
          p2 = {
            ...profile,
            rejectedDestinationIds: [...new Set([...profile.rejectedDestinationIds, current])],
          };
          setProfile(p2);
          pitchedRef.current = null;
          headlineRef.current = "";
          setTrip(null);
          setStage("chat");
        } else if (moveOn) {
          // She named somewhere else, or stated something this place fails.
          // applyPatch already carries the newer answer; nothing to erase.
          console.warn(`[where] leaving ${current}: ${reason}`);
          pitchedRef.current = null;
          headlineRef.current = "";
          setTrip(null);
          setStage("chat");
        } else {
          /*
           * Everything else is an input to this trip. Hand it to the editor,
           * which replans the SAME destination against the fuller brief, so
           * "just interested in tennis matches" tunes Los Angeles rather than
           * being answered with a shrug or with Korea.
           */
          setBrief(b);
          setBusy(false);
          /*
           * `replan` is the difference between the box being a command line
           * and being an input. Anything that changes what a good day looks
           * like — a vibe, an exclusion, a length, a budget, a reason — makes
           * the itinerary rebuild against the fuller brief for the SAME
           * place. "I'm just interested in tennis matches" then tunes Los
           * Angeles instead of being answered with a shrug.
           */
          const replan = [
            patch.vibes, patch.removeVibes, patch.avoidTags, patch.constraints,
            patch.days, patch.budgetUsd, patch.interestEcho, patch.pace,
            patch.wantsWarm, patch.roadTrip, patch.dates, patch.anchorDate,
          ].some((v) => v !== undefined);
          await modifyRef.current?.(text, true, b, replan);
          return;
        }
      }

      if (genRef.current !== gen) return;
      setBrief(b);
      await advance(b, p2);
    } catch (e) {
      // Stopping is not an error, and it has already said its piece.
      if (wasCancelled(e) || genRef.current !== gen) return;
      if (isRateLimited(e)) { say("agent", limitLine(e)); return; }
      say("agent", "Something went wrong on my end. Say that again?");
    } finally {
      if (genRef.current === gen) setBusy(false);
    }
  }, [brief, profile, advance, stage, trip]);

  /** Chip answers are already structured — no need to round-trip the model. */
  const pick = useCallback(async (values: string[], label: string) => {
    setBusy(true);
    const q = question;
    setQuestion(null);
    try {
      // A model-authored chip is natural language, not a slot value, so it
      // goes back through interpret exactly as if she had typed it, which is
      // what lets "A mixture of both" land as two vibes. send() echoes it to
      // the screen; echoing it here as well printed every chip answer twice.
      if (q?.freeform) {
        setBusy(false);
        await send(label);
        return;
      }
      say("user", label);
      let b = brief;
      if (q?.id === "duration") {
        b = values[0] === "flexible"
          ? applyPatch(b, { flexibleDuration: true })
          : applyPatch(b, { days: Number(values[0]) });
      } else if (q?.id === "vibes") {
        const vibes = values.filter((v) => v !== "surprise");
        b = applyPatch(b, vibes.length ? { vibes: vibes as Brief["vibes"] } : { surpriseMe: true });
      } else if (q?.id === "budget") {
        b = values[0] === "flexible"
          ? applyPatch(b, { flexibleBudget: true })
          : applyPatch(b, { budgetUsd: Number(values[0]) });
      } else if (q?.id === "tiebreak" || q?.id === "unknown_place") {
        // Choosing one of two is also a statement about the other.
        if (q.id === "tiebreak") {
          const turnedDown = q.options?.map((o) => o.value).find((v) => v !== values[0]);
          if (turnedDown) rememberRejected(turnedDown);
        }
        // A tiebreak between two catalogue destinations. No unknown place is
        // involved, so there is nothing here to have acknowledged.
        b = applyPatch(b, { namedDestination: values[0] });
      }
      setBrief(b);
      await advance(b, profile);
    } catch (e) {
      if (wasCancelled(e)) return;
      if (isRateLimited(e)) { say("agent", limitLine(e)); return; }
      say("agent", "Something went wrong on my end. Say that again?");
    } finally {
      setBusy(false);
    }
  }, [brief, question, profile, advance, send]);

  /**
   * Turning down a recommendation. The reason has to move something concrete
   * or this is a survey, so applyRejection edits the brief and the profile,
   * the agent says what it changed, and the next pass genuinely can't return
   * the same answer.
   */
  const reject = useCallback(async (reason: RejectReasonId) => {
    if (!trip) return;
    const dest = destinationById(trip.concept.destinationId);
    say("user", REJECT_REASONS.find((r) => r.id === reason)?.label ?? "Not this one");
    setBusy(true);
    setStage("chat");
    setTrip(null);
    try {
      // A pitch is only spoken when the destination CHANGES, so a stale pin
      // did not merely return the rejected place, it returned it in silence.
      pitchedRef.current = null;
      headlineRef.current = "";
      const out = applyRejection(reason, dest, trip.concept.estimateUsd, brief, profile);
      setBrief(out.brief);
      setProfile(out.profile);
      say("agent", out.said);
      await advance(out.brief, out.profile);
    } catch (e) {
      if (wasCancelled(e)) return;
      if (isRateLimited(e)) { say("agent", limitLine(e)); return; }
      say("agent", "Something went wrong on my end. Say that again?");
    } finally {
      setBusy(false);
    }
  }, [trip, brief, profile, advance]);

  // --- editing -------------------------------------------------------------

  const modify = useCallback(async (
    text: string, alreadyEchoed = false, fresh?: Brief, replan = false,
  ) => {
    if (!trip) return;
    if (!alreadyEchoed) say("user", text);
    setEdits((e) => [...e, text]);
    setBusy(true);
    try {
      const { ops, driver: dv, reason: rv } = await agent.parseEdit(text, trip);
      noteDriver(dv, rv);
      const b0 = fresh ?? brief;
      /*
       * Rebuild the same trip against everything she has said, then apply the
       * specific edit on top.
       *
       * Nothing is dropped: same destination, same headline, same pitch. What
       * changes is that the days are built from the fuller brief, so a new
       * interest actually reaches the itinerary rather than sitting in the
       * brief unused while the editor looks for a tag to toggle.
       */
      let base = trip;
      if (replan) {
        const rec = recommend({ ...b0, namedDestination: trip.concept.destinationId }, profile);
        if (rec.destinationId === trip.concept.destinationId) {
          const rebuilt = planTrip(b0, rec, profile, { startDate: trip.concept.startDate });
          base = { ...rebuilt, id: trip.id, concept: {
            ...rebuilt.concept,
            headline: trip.concept.headline,
            why: trip.concept.why,
          } };
        }
      }
      const r = applyOps(base, ops, b0, profile);
      /*
       * The rebuild and the editor have to agree about what happened.
       *
       * "i also really want to do dog sledding" replanned the whole trip —
       * the days changed, the estimate changed — and then said "I didn't
       * change anything, tell me which day is wrong", because the editor
       * found no day-level operation and reported the sentence as
       * unresolved. Two answers in one turn, and both of them false.
       *
       * A rebuild IS the answer to a sentence like that. So when the days
       * actually moved, the reply describes the rebuild and the sentence is
       * not also reported as a failed instruction.
       */
      const rebuilt = replan ? whatTheRebuildDid(trip, r.trip) : undefined;
      const { text: reply } = ops.length || !rebuilt
        ? await agent.describeEdit(ops, r.summary)
        : { text: rebuilt };
      setTrip({ ...r.trip, concept: { ...r.trip.concept, vibe: vibeLine(r.trip, r.brief) } });
      setBrief(r.brief);
      setProfile(r.profile);
      say("agent", reply);
      for (const u of r.unresolved) {
        // Already answered by the rebuild: it was an input, not a command.
        if (rebuilt && u.trim() === text.trim()) continue;
        /*
         * A question is not a failed edit.
         *
         * Anything typed at a plan that isn't pushback now arrives here, and
         * most of it is questions. "I'm not sure what to change" is the wrong
         * sentence for "has the schedule come out yet": nothing was meant to
         * change. Say what is actually true — the plan is untouched and this
         * is outside what I can look up — rather than treating her question
         * as an instruction that failed.
         */
        const isQuestion = /\?\s*$/.test(u.trim())
          || /^\s*(?:what|when|where|which|who|how|why|is|are|do|does|did|can|could|will|would|should|has|have|had)\b/i.test(u);
        /*
         * She asked for something that is already there.
         *
         * Twice in one session: dog sledding, then ice fishing, both already
         * booked on day three of the trip she was looking at, both answered
         * with "tell me which day is wrong". Point at it instead.
         */
        const have = isQuestion ? undefined : alreadyInTheTrip(r.trip, u);
        say("agent", isQuestion
          ? `I don't have a reliable answer to that, and I'd rather say so than guess. Your plan is unchanged. If it should change the trip, tell me how and I'll rework it.`
          : have
            ? `That's already in — ${have.name}, day ${have.day}.`
            : `I've got that in the brief, but nothing I have for ${r.trip.concept.headline} matches it, and I'd rather say so than invent a day around it.`);
      }
    } catch (e) {
      if (wasCancelled(e)) return;
      say("agent", isRateLimited(e) ? limitLine(e) : "That one didn't land. Try saying it a different way?");
    } finally {
      setBusy(false);
    }
  }, [trip, brief, profile]);

  // Kept current so `send` can hand off to it. See modifyRef above.
  useEffect(() => { modifyRef.current = modify; }, [modify]);

  const removeItem = useCallback(async (item: ItineraryItem) => {
    if (!trip) return;
    const r = applyOps(trip, [{ kind: "remove_item", itemId: item.id }], brief, profile);
    setTrip(r.trip); setBrief(r.brief); setProfile(r.profile);
    say("agent", r.summary.join(" ") || `Took ${item.name} out.`);
  }, [trip, brief, profile]);

  // --- screens -------------------------------------------------------------

  if (stage === "home") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <div className="rise space-y-10">
          <div className="flex justify-end">
            <Theme />
          </div>
          <div className="space-y-3">
            <h1 className="font-voice text-[3.1rem] leading-[1.08] tracking-tight sm:text-[3.6rem]">
              Where do you want to go?
            </h1>
            <p className="text-[1.05rem] text-ink-soft">
              Don&apos;t know? Tell me what you need.
            </p>
          </div>

          <Composer
            autoFocus
            placeholder="I need a vacation…"
            placeholders={OPENERS}
            onSend={(t) => { setStage("chat"); void send(t); }}
          />
          <Trips trips={trips} onOpen={openTrip} onDelete={removeTrip} onRestored={() => setTrips(listTrips())} />
          {/*
            * One group, one rhythm.
            *
            * These four are small notes about this browser, not sections of
            * the page, and each carried its own top margin. Inside a
            * space-y-10 stack those margins added to the gap rather than
            * replacing it, so consecutive one-line notes sat six rems apart
            * and read as unrelated blocks. Grouped here with their own tight
            * spacing; the margins come off the components themselves.
            */}
          <div className="space-y-3">
            <Account onSynced={() => setTrips(listTrips())} />
            <Install />
            <OwnKey />
            <TotalSpend />
          </div>
        </div>
        <footer className="mt-20 space-y-1 text-[0.78rem] leading-relaxed text-ink-faint">
          <p>Prototype. Seeded travel data, mocked bookings, nothing charged.</p>
          {/* Say which brain is running. A tester should know whether they're
              judging the product or judging a regex. */}
          <p>
            {STANDALONE
              ? "Running the deterministic planner — scheduling, opening hours and budget are real logic; the language understanding is rules, not a model."
              : "Language understanding runs on the configured agent driver; scheduling, opening hours and budget are deterministic either way."}
          </p>
        </footer>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pb-44 pt-12">
      <div className="mb-8 flex items-center justify-between">
        <button onClick={startNew}
                title="Your trips are saved. This starts a new one."
                className="text-[0.8rem] text-ink-faint transition hover:text-ink">
          ← All trips
        </button>
        <div className="ml-auto flex items-center gap-2">
        <Theme />
        {/* A memory the traveller can see and switch off. Recommendations that
            silently change because of last week's trip are indistinguishable
            from a bug, which is how this one got reported. */}
        {(profile.seenDestinationIds.length > 0 || profile.tripsPlanned > 0) && (
          <span
            title={`I don't re-offer what I've already shown you: ${profile.seenDestinationIds.map((id) => destinationById(id).name).join(", ")}. Click to forget everything.`}
            className="rounded-full border border-paper-edge px-2.5 py-0.5 text-[0.72rem] tracking-wide text-ink-faint">
            remembers {profile.seenDestinationIds.length}
            <button onClick={forget} className="ml-1.5 underline transition hover:text-ink">forget</button>
          </span>
        )}
        {brief.origin && (
          <span
            title={`Flights are priced from ${brief.origin.label}, guessed from your browser's time zone. Wrong? Just say "I'm flying from Chicago".`}
            className="rounded-full border border-paper-edge px-2.5 py-0.5 text-[0.72rem] tracking-wide text-ink-faint">
            from {brief.origin.label}
          </span>
        )}
        {driver && (
          <span
            title={
              driver === "llm"
                ? (fellBack > 0
                    ? `The model answered the last call, but ${fellBack} earlier call${fellBack === 1 ? "" : "s"} failed and rules covered. ${driverNote ?? ""}`.trim()
                    : "Language understanding is coming from a model.")
                : driver === "fallback"
                  ? `A model is configured but the last call failed, so rules answered it. ${driverNote ?? ""}`.trim()
                  : "No API key, so language understanding is pattern matching. Scheduling and costs are deterministic either way."}
            className={`rounded-full border px-2.5 py-0.5 text-[0.72rem] tracking-wide
              ${driver === "llm"
                ? "border-accent bg-accent-soft text-accent"
                : driver === "fallback"
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-700"
                  : "border-paper-edge text-ink-faint"}`}>
            {driver === "llm"
              ? (fellBack > 0 ? `model · ${fellBack} fell back` : "model")
              : driver === "fallback" ? "model failed — rules" : "rules only"}
          </span>
        )}
        </div>
      </div>

      <div className="space-y-5">
        {msgs.map((m) => <Bubble key={m.id} m={m} />)}
        {busy && <Thinking label={researching ? `Reading up on ${title(researching)}…` : undefined} />}
        {question && !busy && <Chips question={question} onPick={pick} />}
      </div>

      {/* Section 28: the chips are a shortcut, not the only way through.
          Free text stays available for the whole conversation. */}
      <OwnKey />

      {stage === "chat" && (
        <div className="mt-7">
          <Composer
            autoFocus={stage === "chat"}
            disabled={busy}
            working={busy}
            onStop={stop}
            placeholder={busy
              ? "\u2026or tell me to go a different way"
              : question ? "\u2026or just tell me" : "Anything else I should know?"}
            onSend={send}
          />
        </div>
      )}

      {stage === "proposal" && trip && (
        <div className="mt-10">
          <Proposal
            trip={trip}
            busy={busy}
            onShow={() => { rememberAccepted(trip, brief); setStage("itinerary"); }}
            onReject={reject}
            onSay={send}
          />
        </div>
      )}

      {stage === "itinerary" && trip && (
        <div className="mt-10 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-voice text-[2rem]">{destinationById(trip.concept.destinationId).name}</h2>
            <span className="text-[0.85rem] text-ink-faint">
              {trip.concept.days} days · about ${trip.concept.estimateUsd.toLocaleString()}
            </span>
          </div>
          <Itinerary trip={trip} profile={profile} onRemove={removeItem} />
          <TripSpend tripId={tripIdRef.current} />
          <Feedback
            onSubmit={(answers, note) =>
              sendFeedback({
                answers, note, edits,
                destination: trip.concept.destinationId,
                brief: { days: brief.days, vibes: brief.vibes, budgetUsd: brief.budgetUsd },
                estimateUsd: trip.concept.estimateUsd,
              })}
          />
        </div>
      )}

      <div ref={endRef} />

      {stage === "itinerary" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-paper-edge bg-paper/92 backdrop-blur">
          <div className="mx-auto max-w-3xl px-6 py-4">
            <Composer placeholder="What should I change?" disabled={busy} onSend={modify} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["This feels too busy", "More wine", "Less touristy", "Add a free afternoon"].map((s) => (
                <button key={s} disabled={busy} onClick={() => void modify(s)}
                        className="rounded-full border border-paper-edge bg-paper-card px-3 py-1 text-[0.8rem] text-ink-soft transition hover:border-ink-faint disabled:opacity-40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
