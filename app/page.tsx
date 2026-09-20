"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Brief, ItineraryItem, TravelerProfile, Trip } from "@/lib/types";
import { emptyBrief, emptyProfile, stating } from "@/lib/types";
import type { Question, Turn } from "@/lib/agent/types";
import { applyPatch, interestLine } from "@/lib/brief";
import { alreadyInTheTrip, whatTheRebuildDid } from "@/lib/answer";
import { transportChoice, legsOfShape, MODE_LABEL, type TransportMode } from "@/lib/transport";
import { recommend, tiebreakPrompt } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { applyOps } from "@/lib/edit";
import { vibeLine, whyLine } from "@/lib/concept";
import { cityById, destinationById } from "@/data/destinations";
import { abortInFlight, agent, isRateLimited, noModel, loadProfile, saveProfile, sendFeedback, wasCancelled } from "@/lib/client";
import { detectOrigin } from "@/lib/origin";
import { recordMiss } from "@/lib/misses";
import { interpretRules } from "@/lib/discovery";
import { statedPlaces } from "@/lib/subject";
import { isResearched, packFor, registerPack } from "@/data/registry";
import { hydratePacks, rememberPack } from "@/lib/packstore";
import { withStays } from "@/lib/stays";
import { advance as flowAdvance, limitLine, title } from "@/lib/flow";
import type { Drift } from "@/lib/drift";
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

import { Bubble, Chips, Composer, Thinking, type Msg } from "@/components/Chat";
import { sendVote } from "@/lib/votes";
import { accountStopped, accountStopSays } from "@/lib/account";
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

function packForTrip(brief: Brief, trip: Trip | null): DestinationPack | undefined {
  const id = trip?.concept.destinationId ?? brief.namedDestination;
  return id && isResearched(id) ? packFor(id) : undefined;
}

/**
 * How do you want to get between them?
 *
 * The app used to decide this silently, and decided it wrong: every leg it
 * had no real data for became a train, including an eleven-hour one to a city
 * with no railway. So it asks. Once, ever: the answer lives on the profile,
 * and this disappears for good the moment it is given.
 *
 * It sits under the finished plan rather than in front of it. A question
 * before the itinerary costs a turn, and turns are the thing this product is
 * trying to spend fewer of; a chip under a plan she is already reading costs
 * nothing, and she can see what the answer would change.
 */
function TransportAsk({ trip, profile, busy, onPick }: {
  trip: Trip; profile: TravelerProfile; busy: boolean;
  onPick: (m: TransportMode) => void;
}) {
  if (profile.transport) return null;
  const choice = transportChoice(legsOfShape(trip.concept.shape, cityById));
  if (!choice) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[0.85rem] text-ink-soft">
      <span>How do you want to get between them?</span>
      {choice.options.map((m) => (
        <button key={m} disabled={busy} onClick={() => onPick(m)}
                className="rounded-full border border-paper-edge bg-paper-card px-3 py-1 transition hover:border-ink-faint hover:text-ink disabled:opacity-50">
          {MODE_LABEL[m]}
        </button>
      ))}
      <span className="text-ink-faint">I&apos;ll remember it.</span>
    </div>
  );
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
  const [researching, setResearching] = useState<string | null>(null);
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
    const saved = saveTrip(record);
    // Trips carry full itineraries and the box is five megabytes. When it
    // fills, the live conversation wins — but she hears about what went.
    if (saved.dropped > 0) {
      say("agent", `Your browser's storage was full, so I've dropped ${saved.dropped} older `
        + `trip${saved.dropped === 1 ? "" : "s"} to keep this one. Export anything you want to keep.`);
    }
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

  /*
   * Report what answered, not what was configured — to the console.
   *
   * This used to drive a header badge reading "model failed — rules", which
   * told the traveller nothing she could act on. A silent fallback still has
   * to be findable, though: a bad key or a dropped connection would otherwise
   * look like the app quietly getting worse. So the fallback and its reason
   * are logged, where the person debugging it is looking.
   */
  /*
   * A ref, not state: nothing renders it, and a vote needs it.
   *
   * The badge this used to feed was build diagnostics on the one screen that
   * should be the plan, and removing it was right. Dropping the VALUE with it
   * was not: the first real thumbs-down from the deployment came back with
   * `driver: null`, and which brain wrote a bad sentence is the first thing
   * you need to know to fix it. A model fabrication and a regex fabrication
   * are different bugs with different fixes, and a queue that cannot tell
   * them apart makes you replay every row by hand to find out.
   */
  const driverRef = useRef<string | null>(null);
  /*
   * An account problem is not a blip, and it must not be silent.
   *
   * A deployment went out with an invalid ANTHROPIC_API_KEY and every call
   * 401'd, fell back to the rules floor, and said nothing at all. The app
   * looked like it was working. Someone could dogfood it for an hour
   * believing they were testing the model and be testing regexes the whole
   * time, and the votes they left would be filed against the wrong half of
   * the product.
   *
   * That was fixed by matching 401. It was the wrong shape of fix, and the
   * bill proved it: the account ran out of credit, Anthropic answered 400
   * invalid_request_error "your credit balance is too low", which matches no
   * part of a 401 pattern, and the app went straight back to answering from
   * regexes without a word. Same failure, same consequence, different status
   * code, and the narrow matcher only ever covered the one I had already
   * seen.
   *
   * So the test is not a status code. It is: will this fix itself, and can
   * the traveller do anything about it? A dropped connection is what the
   * floor is FOR and stays quiet. A rejected key and an empty balance are
   * both permanent until the person running the deployment acts, so both are
   * said once, in plain words, and neither is repeated.
   */
  /*
   * The turn stopped because no model answered it.
   *
   * Distinct from "something went wrong": that sentence invites her to say it
   * again, which is the right advice for a blip and useless advice when the
   * deployment is out of credit — she would retype the same message forever
   * and the app would keep looking broken rather than looking out of credit.
   * The transport has already retried the transient case before this is
   * reached, so by here it is real.
   */
  /*
   * What the miss was about.
   *
   * When the stop happened ON the interpret call — which is the common case,
   * and the one in the screenshot — nothing has been parsed, so the brief
   * holds only the raw sentence. The rules parser is run here to name the
   * subject, and ONLY to name it: nothing this returns reaches her, answers
   * her, or goes on the brief. "No degraded mode" is about what the app says
   * to her, not about how it labels its own log rows, and a table of misses
   * that all read "i wanna climb the himalayas. duration of the trip - i'm
   * flexible" is a table nobody can count.
   */
  const missSubject = (b: Brief): string | undefined => {
    const held = statedPlaces(b)[0] ?? b.namedDestination;
    if (held) return held;
    const last = b.stated.filter((t) => t.how === "typed").at(-1)?.text;
    if (!last) return undefined;
    try {
      const guess = statedPlaces(applyPatch(b, interpretRules(last, b)))[0];
      if (guess) return guess;
    } catch { /* labelling a log row must never become a second failure */ }
    return last;
  };

  const stoppedLine = (e: unknown, about?: Brief) => {
    /*
     * "All give up lines must be logged."
     *
     * This one was not. Three call sites said the sentence and recorded
     * nothing, and it is the give-up that fires most often and carries the
     * most useful fact in the product: "i wanna climb the himalayas" is a
     * place we do not hold, asked for by a real person, at a moment when
     * nobody was watching a console. lib/misses.ts exists precisely so the
     * catalogue stops being chosen by my guesses, and the stop that would
     * have fed it best was the one bypassing it.
     *
     * Recorded here rather than at each site so a fourth caller cannot forget.
     */
    const b = about ?? brief;
    recordMiss({
      why: (e as { why?: string })?.why ?? "no model",
      // Her words for it, in the order they are most likely to be a place.
      // Last resort is the message itself, because a miss with no subject is
      // a row nobody can act on.
      subject: missSubject(b),
      driver: "stopped",
      days: b.days,
    });
    const stop = accountStopped((e as { why?: string })?.why);
    if (stop === "billing") {
      return "I'm stopping here: this deployment's Anthropic account is out of credit, so there's "
        + "no model behind me right now. I'd rather stop than answer you with pattern matching "
        + "and let you think it was me.";
    }
    if (stop === "auth") {
      return "I'm stopping here: the key this deployment is configured with is being rejected, so "
        + "there's no model behind me right now. I'd rather stop than answer you with pattern "
        + "matching and let you think it was me.";
    }
    return "I couldn't reach a model for that, and I tried three times. I'd rather stop than "
      + "answer from pattern matching. Try again in a moment.";
  };

  const accountToldRef = useRef(false);
  const noteDriver = (d: string, reason?: string) => {
    driverRef.current = d;
    if (d !== "fallback") return;
    console.warn(`[driver] fell back to rules${reason ? `: ${reason}` : ""}`);
    const stop = accountStopped(reason);
    if (!stop || accountToldRef.current) return;
    accountToldRef.current = true;
    say("agent", accountStopSays(stop));
  };

  /*
   * Drift, reported where the person fixing it is looking.
   *
   * Deliberately not on screen as a badge. Every one of the four detectors
   * already produces a sentence she reads, or removes something she was about
   * to read wrongly — a second, meta line saying "the agent drifted" would be
   * the app talking about itself instead of about her trip, which is the
   * failure mode half the comments in lib/flow.ts are about.
   */
  const noteDrift = (d: Drift) => {
    console.warn(`[drift/${d.kind}] ${d.says} (${d.evidence})`);
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

  /*
   * One sentence, one verdict, with the context that makes it replayable.
   *
   * The brief and the plan go with it deliberately: a down-vote on "nothing
   * in this trip covers gaudi" is worth nothing without the brief that said
   * gaudi and the itinerary that had the Sagrada Familia in it. That pair is
   * what turns a complaint into a scenario, which is the whole point of
   * collecting these.
   */
  const vote = (verdict: "up" | "down", said: string, turnIndex: number) => {
    return sendVote({
      sessionId: tripIdRef.current,
      tripId: trip?.id,
      verdict, said, turnIndex,
      brief, trip,
      destinationId: trip?.concept.destinationId,
      driver: driverRef.current ?? undefined,
    });
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

  /*
   * The turn itself lives in lib/flow.ts now.
   *
   * It was 380 lines inside this component, which meant nothing could run it
   * but a browser and a person, and the eval graded a reimplementation of it
   * instead. What is left here is the wiring: React's setters and refs handed
   * in, so the flow can be imported and tested.
   */
  const advance = useCallback(async (brief0: Brief, prof: TravelerProfile) => {
    await flowAdvance(brief0, prof, {
      say, ask, noteDriver, noteDrift, setBrief, setTrip, setStage, setQuestion, setResearching,
      openStream, appendTo,
      closeStream: (id: string) => setMsgs((m) => m.filter((x) => x.id !== id)),
      rememberSeen,
    }, {
      history: historyRef, pitched: pitchedRef, headline: headlineRef,
      failedResearch: failedResearchRef, gen: genRef,
    });
  }, []);

  /** Call off whatever is running. The next thing she types is the point. */
  const stop = useCallback(() => {
    genRef.current++;
    abortInFlight();
    setBusy(false);
    setResearching(null);
  }, []);

  /*
   * `how` says who wrote the words, and it is not a formality.
   *
   * A freeform chip is written by the model and clicked by her, and this path
   * filed it as "typed" — so a chip reading "Mostly food and wine" licensed
   * "You asked for wine" in the reason bank. The fixed chips were already
   * excluded as our taxonomy; the model-authored ones are ours too.
   */
  const send = useCallback(async (text: string, how: "typed" | "picked" = "typed") => {
    const gen = ++genRef.current;
    say("user", text);
    setBusy(true);
    setQuestion(null);
    // What she typed, on the brief, before the call that may not come back —
    // so a stop still knows what it was about. See stoppedLine.
    let said: Brief = stating(brief, text, how);
    try {
      const { patch, driver: dv, reason: rv } = await agent.interpret(text, brief);
      noteDriver(dv, rv);
      // Recorded before anything is derived from it, so a parse that misses
      // still leaves what she typed on the brief.
      let b = applyPatch(said, patch);
      said = b;

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
          // Derived, so these may be reset; `stated` still holds every word of
          // hers, which is what the rule protects.
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
            patch.days, patch.budgetUsd, patch.activities, patch.pace,
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
      if (noModel(e)) { say("agent", stoppedLine(e, said)); return; }
      say("agent", "Something went wrong on my end. Say that again?");
    } finally {
      if (genRef.current === gen) setBusy(false);
    }
  }, [brief, profile, advance, stage, trip]);

  /**
   * She said how she wants to travel. Keep it, and rebuild this trip with it.
   *
   * Kept on the profile rather than the brief: it is a fact about her, not
   * about this trip, and asking again next time would be the app forgetting
   * something she has already told it.
   */
  const chooseTransport = useCallback((mode: TransportMode) => {
    const p2 = { ...profile, transport: mode };
    setProfile(p2);
    if (!trip) return;
    const rec = recommend({ ...brief, namedDestination: trip.concept.destinationId }, p2);
    if (rec.destinationId !== trip.concept.destinationId) return;
    const rebuilt = planTrip(brief, rec, p2, { startDate: trip.concept.startDate });
    setTrip({ ...rebuilt, id: trip.id, concept: {
      ...rebuilt.concept, headline: trip.concept.headline, why: trip.concept.why,
    } });
  }, [profile, trip, brief]);

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
        await send(label, "picked");
        return;
      }
      say("user", label);
      let b = stating(brief, label, "picked");
      if (q?.id === "duration") {
        // Each option's value is the range its label states, "min-max".
        const [lo, hi] = String(values[0]).split("-").map(Number);
        b = values[0] === "flexible"
          ? applyPatch(b, { flexibleDuration: true })
          : applyPatch(b, hi
            ? { daysRange: { min: lo, max: hi }, days: Math.round((lo + hi) / 2) }
            : { days: lo });
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
      if (noModel(e)) { say("agent", stoppedLine(e)); return; }
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
      if (noModel(e)) { say("agent", stoppedLine(e)); return; }
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
      /*
       * The sentence itself, not only the ops it parsed into. At the itinerary
       * stage this composer is the only way in, and until now nothing on this
       * path recorded what she typed. See applyOps.
       */
      const r = applyOps(base, ops, b0, profile, text);
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
            {/* The memory control, moved off the plan header. It belongs with
                the other notes about this browser, where someone is already
                looking for switches rather than looking at their trip. */}
            {/* Gated on ANY memory, not just the list it names: `forget` also
                clears what she said she'd already visited, her learned
                preferences and rejected places. Gated on `seen` alone, a
                first message like "I've already been to Iceland" left Iceland
                scored to zero with no control on screen to undo it. */}
            {(profile.seenDestinationIds.length > 0 || profile.visitedDestinationIds.length > 0
              || profile.preferences.length > 0 || profile.rejectedPlaceIds.length > 0) && (
              <p className="text-[0.78rem] leading-relaxed text-ink-faint">
                I remember what I&apos;ve shown you, where you said you&apos;ve been, and what you
                turned down{profile.seenDestinationIds.length > 0
                  ? `, so far: ${profile.seenDestinationIds.map((id) => destinationById(id).name).join(", ")}`
                  : ""}.{" "}
                <button onClick={forget} className="underline transition hover:text-ink">Forget all of it</button>.
              </p>
            )}
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

  /*
   * The question it actually asked, as the prompt over the input.
   *
   * The box said "What should I change?" under a message that had just asked
   * her something specific — "Tell me if it's the point of the trip" — so the
   * screen put two prompts in front of her and answered neither. Its own last
   * question wins when it asked one recently and it is short enough to read
   * as a prompt; otherwise the generic line stands.
   */
  const lastAsk = (() => {
    const last = [...msgs].reverse().find((m) => m.from === "agent");
    // Only when the message ENDS on its question. A question in the middle is
    // not the thing it is waiting on, and lifting it out leaves the operative
    // half behind: "Should I drop the wine bar? I've cleared day 3 instead."
    if (!last || !last.text.trim().endsWith("?")) return null;
    /*
     * Split only where a sentence really ends: a terminator, whitespace, then
     * a capital. Splitting on any terminator broke on abbreviations — "Want
     * to swap Mt. Fuji?" cut at "Mt. " and offered her the prompt "Fuji?".
     * The length floor is the other half of that guard, and it also keeps
     * error-recovery lines ("Say that again?") out of the box, where they
     * would sit as a permanent prompt long after the error.
     */
    const q = last.text.trim().split(/(?<=[.?!])\s+(?=[A-Z])/).pop()?.trim();
    return q && q.length >= 20 && q.length <= 80 ? q : null;
  })();

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
        {/*
          * Three chips used to sit here: "remembers 4 / forget", "from San
          * Francisco", and a driver badge reading "model failed — rules".
          *
          * None of them was for the traveller. The driver badge is build
          * diagnostics; the origin is already correctable by saying "I'm
          * flying from Chicago"; and the memory count only meant anything
          * next to a control, which now lives on the home screen where the
          * other notes about this browser are. A header the user cannot act
          * on is decoration on the one screen that should be the plan.
          */}
        </div>
      </div>

      <div className="space-y-5">
        {msgs.map((m, i) => <Bubble key={m.id} m={m} onVote={(v, said) => vote(v, said, i)} />)}
        {/* The place is title-cased; a note after the pipe is not. Passing
            "Bend, Oregon, one more go" through title() read as a place called
            "One More Go". */}
        {busy && <Thinking label={researching
          ? `Reading up on ${title(researching.split("|")[0])}${researching.includes("|") ? `, ${researching.split("|")[1]}` : ""}…`
          : undefined} />}
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
        <div className="mt-10 space-y-4">
          <Proposal
            trip={trip}
            busy={busy}
            onShow={() => { rememberAccepted(trip, brief); setStage("itinerary"); }}
            onReject={reject}
            onSay={send}
          />
          <TransportAsk trip={trip} profile={profile} busy={busy} onPick={chooseTransport} />
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
                sessionId: tripIdRef.current,
                tripId: trip.id,
                destination: trip.concept.destinationId,
                // The whole brief, not three fields of it. The point of a row
                // in this table is that it can be replayed, and it cannot be
                // replayed from days/vibes/budget alone.
                brief,
                estimateUsd: trip.concept.estimateUsd,
              })}
          />
        </div>
      )}

      <div ref={endRef} />

      {stage === "itinerary" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-paper-edge bg-paper/92 backdrop-blur">
          <div className="mx-auto max-w-3xl px-6 py-4">
            {/*
              * Four canned chips used to sit under this box: "This feels too
              * busy", "More wine", "Less touristy", "Add a free afternoon".
              * They were hardcoded, so a fishing trip in the Newberry Caldera
              * was offered more wine. A suggestion that ignores the plan on
              * screen is worse than no suggestion.
              *
              * And the box asked "What should I change?" while the agent had
              * just asked her something specific in the thread. Its own
              * question is the prompt; the generic one only competes with it.
              */}
            <Composer placeholder={lastAsk ?? "What should I change?"} disabled={busy} onSend={modify} />
          </div>
        </div>
      )}
    </main>
  );
}
