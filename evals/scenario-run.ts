/**
 * One scenario, start to finish, run through the product's own turn.
 *
 * Split out of run.ts so it can be imported by things that are not a CLI.
 * run.ts loads .env.local off the filesystem at module scope, which is right
 * for a script and wrong for anything bundled into the app: importing it from
 * a route dragged `fs` and a dynamic path into the build.
 *
 * WHAT CHANGED, AND WHY IT MATTERED
 *
 * This file used to call `recommend()` and `planTrip()` itself. It walked its
 * own discovery loop, pinned nothing, researched nothing, and then graded the
 * trip it had built. lib/flow.ts `advance()` — the function that runs when she
 * presses enter — was never executed, so none of its guards were: not the
 * destination pin, not the `statedPlaces` gate, not the fidelity gate, not the
 * subject/prose/thread/label detectors in lib/drift.ts, not the question gate.
 *
 * The measured consequence was one row. `unresearched-place` asks for the
 * Faroe Islands, the catalogue does not hold them, the harness's research stub
 * never returns a pack. The product's answer is to say so and stop. The
 * harness's answer was to plan Korea — and then score that Korea trip on
 * schedule validity, pace, budget, reasons, slop, edits, idempotence and the
 * rest. Twenty-odd numbers, every one of them about a trip the product would
 * refuse to build. Only `subject_stability` could see it, and it read 0%.
 *
 * The general consequence is worse than the row: a guard added to advance()
 * could not move the scorecard, and a bug inside advance() could not be caught
 * by it. The eval's whole claim to authority is that it measures the thing
 * that ships.
 *
 * So the session below is the product's session. Every message she sends is
 * one `advance()`, driven the way scripts/regress-turn.ts drives it — a
 * stubbed FlowAgent, a recording FlowIO — and everything the metrics need that
 * used to be a local variable is now read off that turn: the recommendation
 * and the pitch at the `api.pitch` seam, the questions at `io.ask` and
 * `io.setQuestion`, the labels at `io.setResearching`, the drift at
 * `io.noteDrift`, the trip at `io.setTrip`, and the before/after trips around
 * each edit.
 */
import type { AgentDriver, Phase, Question, Recommendation, Turn } from "@/lib/agent/types";
import { advance, type FlowAgent, type FlowIO, type FlowRefs, type Stage } from "@/lib/flow";
import { emptyBrief, emptyProfile, type Brief, type TravelerProfile, type Trip, stating } from "@/lib/types";
import { noModel } from "@/lib/client";
import { rulesDriver } from "@/lib/agent/rules";
import { applyPatch } from "@/lib/brief";
import { planTrip } from "@/lib/planner";
import { recommend } from "@/lib/recommend";
import { applyOps } from "@/lib/edit";
import type { Scenario } from "./scenarios";
import * as M from "./metrics";
import type { Drift } from "@/lib/drift";
import type { Scores } from "./metrics";
import { candidatesFor } from "@/lib/select";
import { whyLine, vibeLine, unenforcedNote } from "@/lib/concept";
import { fitsTimeOfDay, isOpenFor } from "@/lib/hours";
import { toMin } from "@/lib/geo";
import { PACE_ACTIVITIES } from "@/lib/types";
import { inferPace, paceDown } from "@/lib/discovery";
import type { Tag } from "@/lib/types";

/**
 * Is there something with this tag that could actually go into this trip?
 *
 * This asked only whether such a place exists in the catalogue, which is not
 * the same question. On the Korea food scenario the one unused food place left
 * was Makgeolli alley — a drinking alley, evening-only — and the only free
 * block on the Jeonju day was a morning one. The planner refuses an
 * evening-only place before 15:00, so the app declined, correctly and out
 * loud, and was scored zero for it. Scoring an honest decline zero is how you
 * train an agent to pad an itinerary, which is the thing this metric's own
 * comment says it exists to prevent.
 *
 * So: unused, tagged, open at the time, and belonging in that part of the day.
 */
function hasTag(trip: Trip, tag: string, brief: Brief, profile: TravelerProfile): boolean {
  const used = new Set(trip.days.flatMap((d) => d.items.map((i) => i.placeId).filter(Boolean) as string[]));
  for (const day of trip.days) {
    const slots = day.items.filter((i) => i.type === "downtime" && i.durationMin >= 75);
    if (!slots.length) continue;
    const weekday = new Date(day.date + "T00:00:00Z").getUTCDay();
    for (const { place } of candidatesFor(day.cityId, brief, profile)) {
      if (used.has(place.id) || !place.tags.includes(tag as Tag)) continue;
      if (slots.some((slot) => {
        const at = toMin(slot.start);
        return place.durationMin <= slot.durationMin
          && isOpenFor(place, at, weekday) && fitsTimeOfDay(place, at);
      })) return true;
    }
  }
  return false;
}

/**
 * The calendar, held still.
 *
 * planTrip dates an undated trip from `defaultStartDate()`, which reads the
 * clock, and then enforces real weekdays and real opening hours against it. An
 * eval whose numbers move because a month rolled over is an eval nobody
 * trusts, so the harness passes the date through `advance()`'s one optional
 * parameter. The product passes nothing.
 */
const FIXED_START = "2026-10-10";
const PLAN = { plan: { startDate: FIXED_START } };
/** Questions before the scorecard gives up on the conversation converging. */
const MAX_QUESTIONS = 8;
/** A hard stop on the turn loop, so a flow that never settles fails loudly. */
const MAX_TURNS = 12;

/**
 * Every driver call this scenario made, in order.
 *
 * `call_economy` needs a count and nothing else, so the wrapper does not touch
 * arguments or results — a recorder that reshapes what it records is a
 * different driver, and then the scorecard is measuring the harness.
 *
 * Recorded at the FlowAgent seam rather than at the AgentDriver, because that
 * is where the app's calls actually happen: `budget`, `suggest`, `stays` and
 * the two research calls are made by advance() and were invisible to a harness
 * that only wrapped the driver.
 */
type CallLog = { name: string }[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Stubs = Partial<Record<string, (...a: any[]) => any>>;

/**
 * One session: a brief, a profile, and however many turns it takes.
 *
 * The IO below is scripts/regress-turn.ts's recorder, widened. That file is
 * the only other thing in the project that executes advance(), and a second
 * hand-rolled imitation of the turn would drift from it.
 *
 * The model stubs are its stubs too, for the same reason. The stream fails
 * once and then answers, which is the case flow.ts's retry was written for and
 * which regress-turn pins; the pack stub never answers, which is the case its
 * own retry was written for. Together they are the worst case a real traveller
 * can hit, and they are why `unresearched-place` ends in a refusal.
 */
class Session {
  /** Everything the agent said, in order. */
  said: string[] = [];
  /**
   * Every question the turn actually put, with the transcript and the brief AS
   * THEY STOOD when it was put. `thread_continuity` asks whether the answer
   * was already in hand at that moment, and the final brief cannot answer
   * that: by the end she has answered everything, so every question would
   * score as drift.
   */
  offered: { q: Question; history: Turn[]; brief: Brief }[] = [];
  /** Status labels the turn put on screen, in order. null is "clear it". */
  labels: (string | null)[] = [];
  /** Everything the drift detectors caught, whatever the turn then did. */
  drift: Drift[] = [];
  calls: CallLog = [];
  /**
   * The brief after every message and every edit, for `words_survive`, which
   * asks whether a phrase that was once ON the brief is still there at the
   * end. One final brief cannot answer that: a phrase the parser refused and a
   * phrase that was taken and later deleted look identical in it.
   */
  snapshots: Brief[] = [];
  /**
   * Every message she typed, in order, for `words_survive`. Ground truth from
   * the harness rather than read back off `brief.stated`: the metric asks
   * whether what she typed is still reachable, and sourcing the question from
   * the app's own record of it would let a failure to record hide a failure to
   * keep. `stated` is checked separately, by scripts/regress-stated.ts.
   */
  typed: string[] = [];
  /** The recommendation and the paragraph, caught at the `api.pitch` seam. */
  rec?: Recommendation;
  pitch?: { headline: string; body: string };
  /** The brief as it stood when a trip first reached the screen. */
  briefAtPlan?: Brief;
  trip: Trip | null = null;
  stage: Stage = "chat";
  /** What she is being asked right now, if anything. */
  question: Question | null = null;
  profile: TravelerProfile = emptyProfile();
  refs: FlowRefs = freshRefs();
  /** How many user messages it took. */
  sent = 0;
  private streamed = 0;

  constructor(private driver: AgentDriver, public brief: Brief) {
    this.snapshots.push(brief);
  }

  private say = (from: "agent" | "user", text: string) => {
    this.refs.history.current = [...this.refs.history.current, { from, text }].slice(-16);
    if (from === "agent") this.said.push(text);
  };

  private putToHer = (q: Question) => {
    this.offered.push({ q, history: [...this.refs.history.current], brief: this.brief });
    this.question = q;
  };

  private io(): FlowIO {
    return {
      say: this.say,
      ask: (q) => { this.putToHer(q); this.say("agent", q.prompt); },
      noteDriver: () => {},
      setBrief: (b) => { this.brief = b; this.snapshots.push(b); },
      setTrip: (t) => {
        const next = typeof t === "function" ? t(this.trip) : t;
        if (next && !this.briefAtPlan) this.briefAtPlan = this.brief;
        this.trip = next;
      },
      setStage: (s) => { this.stage = s; },
      // The tiebreak is put through here rather than through ask(), and it is
      // still a question she has to answer, so it counts as one.
      setQuestion: (q) => { if (q) this.putToHer(q); else this.question = null; },
      setResearching: (l) => { this.labels.push(l); },
      noteDrift: (d) => { this.drift.push(d); },
      openStream: () => "s", appendTo: () => () => {}, closeStream: () => {},
      // The app remembers what it has already offered, and that memory is what
      // stops a second "surprise me" repeating the first. It changes what the
      // NEXT turn recommends, so the harness carries it too.
      rememberSeen: (id) => {
        this.profile = {
          ...this.profile,
          seenDestinationIds: [...this.profile.seenDestinationIds.filter((x) => x !== id), id].slice(-12),
        };
      },
    };
  }

  private api(over: Stubs): FlowAgent {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (name: string, fn: (...a: any[]) => any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (...args: any[]) => { this.calls.push({ name }); return fn(...args); };
    const d = this.driver;
    const base: Record<string, unknown> = {
      question: rec("question", async (b: Brief, hist: Turn[], phase: Phase) =>
        ({ question: await d.nextQuestion(b, hist, phase), driver: d.name })),
      // Free and always available: the eval is not measuring the rate limiter.
      budget: rec("budget", async () => ({ ok: true, retryAfter: 0 })),
      /*
       * "Where on earth would you send them?" — stubbed, because the rules
       * driver cannot answer it and the product's honest response to no
       * answer is to stop.
       *
       * This is the seam that made the fix worth doing and is also the one
       * place the harness has to stand in for a model, so it is worth being
       * precise about what it stands in for.
       *
       * `suggest` asks the model for a destination with no list attached. The
       * rules driver has no world model and does not implement it, so with a
       * real driver-shaped stub returning nothing, advance() reaches the
       * fidelity gate — "nothing named on the brief; refusing to rank the
       * catalogue" — and eight of the twenty-three scenarios end with no trip.
       * That is the truth about the rules driver, and it is worth knowing;
       * it is not a scorecard.
       *
       * The old harness reached those eight destinations by calling
       * `recommend()` itself, which is the open-field tag ranking the
       * fidelity gate exists to refuse. So the stub answers with exactly that
       * pick — the destination is identical to the one the old harness
       * scored — but it arrives through the model seam, is settled onto the
       * brief by advance(), and then has to get past the pin, the
       * `statedPlaces` gate, `subjectDrift` and `proseDrift` like any other.
       * The choice is unchanged; every guard between the choice and the
       * itinerary is now real.
       *
       * The same reasoning as the research stubs below: a model capability
       * the harness does not stub is a code path the eval never reaches.
       */
      suggest: rec("suggest", async (b: Brief) => {
        if (d.suggest) return { ...(await d.suggest(b)), driver: d.name };
        return { place: recommend(b, this.profile).destinationId, driver: "rules" };
      }),
      researchStream: rec("researchStream", async () => ++this.streamed === 1
        ? { problem: "Researching it took longer than this deployment allows.", driver: "rules" }
        : { text: "A verdict.\n\nNotes about the place.", sources: [], driver: "rules" }),
      researchPack: rec("researchPack", async () =>
        ({ pack: undefined, problem: "nothing came back", driver: "rules" })),
      researchPlaces: rec("researchPlaces", async () => ({ places: [] })),
      /*
       * The one seam that threads the metrics' inputs out of the flow.
       *
       * `single_recommendation`, `destination_fidelity`, `prose_grounding` and
       * `subject_stability` all need the Recommendation, and advance() builds
       * it internally and never hands it back. It does hand it to the pitch,
       * so that is where it is caught — verbatim, alongside the paragraph the
       * driver wrote about it.
       */
      pitch: rec("pitch", async (r: Recommendation, b: Brief) => {
        const p = await d.pitch(r, b);
        this.rec = r;
        this.pitch = p;
        return { pitch: p, driver: d.name };
      }),
      /*
       * The floor under the pitch, which this harness never had.
       *
       * lib/flow.ts calls `api.pitchFloor` when the model's paragraph is
       * refused or the model is gone, and the app wires it to the rules
       * driver's own pitch: no network, no key, no cost. It was missing here,
       * so every eval run that reached that branch would have died on
       * "api.pitchFloor is not a function" — which nothing noticed, because
       * the rules driver never fails its own pitch and so never reached it.
       * A --dead run reaches it on the first scenario.
       */
      pitchFloor: rec("pitchFloor", async (r: Recommendation, b: Brief) => {
        const p = await rulesDriver.pitch!(r, b);
        // Recorded exactly as the model path records it: the metrics read
        // `rec` and `pitch`, and a trip pitched from the floor is still a
        // trip that was pitched.
        this.rec = r;
        this.pitch = p;
        return p;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stays: rec("stays", async (shape: any, b: Brief, id: string) =>
        ({ stays: d.stays ? await d.stays(shape, b, id) : [], driver: d.name })),
    };
    for (const [k, fn] of Object.entries(over)) if (fn) base[k] = rec(k, fn);
    return base as unknown as FlowAgent;
  }

  /** One turn of the real thing. */
  async turn(over: Stubs = {}): Promise<void> {
    await advance(this.brief, this.profile, this.io(), this.refs, this.api(over), PLAN);
    /*
     * The rooms call is fired and forgotten inside advance(), so it lands a
     * microtask after the turn returns. Draining here means the trip the
     * metrics read is the trip she is left looking at, rather than the one
     * that existed a tick earlier.
     */
    await new Promise<void>((r) => setImmediate(r));
  }

  /** One message from her, exactly as app/page.tsx `send` handles it. */
  async send(text: string): Promise<void> {
    this.sent++;
    this.typed.push(text);
    this.say("user", text);
    this.question = null;
    /*
     * Record what she said before deriving from it, exactly as the app does.
     * The harness applied the patch and never called `stating`, so `stated`
     * was empty here and nowhere else — and anything that asks "did she type
     * this?" (the attribution gate, the "You said" line) was measuring a
     * traveller who had never spoken.
     */
    /*
     * A stop is an outcome, not a crash.
     *
     * app/page.tsx catches NoModel around the whole turn and says one
     * sentence; lib/flow.ts does not, because the catch belongs where the
     * turn is driven. This harness drives the turn, so the catch belongs
     * here, or a --dead run dies on its first scenario instead of scoring it.
     * What is recorded is what she would read: her words on the brief, the
     * stop said out loud, and no plan.
     */
    this.brief = stating(this.brief, text, "typed");
    try {
      this.brief = applyPatch(this.brief, await this.driver.interpret(text, this.brief));
    } catch (e) {
      if (!noModel(e)) throw e;
      this.said.push("I'm stopping here: this deployment's Anthropic account is out of credit, so "
        + "there's no model behind me right now. I'd rather stop than answer you with pattern "
        + "matching and let you think it was me.");
      this.snapshots.push(this.brief);
      return;
    }
    this.snapshots.push(this.brief);
    try {
      await this.turn();
    } catch (e) {
      if (!noModel(e)) throw e;
      this.said.push("I'm stopping here: this deployment's Anthropic account is out of credit, so "
        + "there's no model behind me right now. I'd rather stop than answer you with pattern "
        + "matching and let you think it was me.");
    }
  }

  /**
   * The sweep's pin, and a fresh turn at it.
   *
   * The sweep runs the same scenario shapes at every destination we hold, so
   * that what is measured is the PLANNER against fifteen catalogues rather
   * than the recommender. That needs the conversation to happen first — it is
   * what puts a length, a budget and a set of vibes on the brief — and then
   * the destination replaced and the plan made again. Under the old harness
   * those were two straight-line steps in this file; now the conversation is
   * real turns and the pin is one more real turn with the recommendation
   * forced, which is as close to the product as a pinned run can be.
   *
   * The pin has to clear the other three ways a destination can be chosen, or
   * a region or shortlist read earlier still outranks it inside recommend().
   */
  async repin(at: string): Promise<void> {
    this.brief = {
      ...this.brief, namedDestination: at, candidates: undefined,
      unknownCandidates: undefined, region: undefined, regionLabel: undefined,
      regionIds: undefined, focusCityId: undefined,
    };
    /*
     * The pin is the HARNESS deleting what she said, not the app. Scoring
     * `words_survive` against it would put a red on every sweep row for a
     * deletion this file performed two lines above, so the pinned brief
     * becomes the new baseline. What the sweep then measures on this metric is
     * the plan-and-edit half of the session, which is the half the sweep is
     * for.
     */
    this.snapshots.length = 0;
    this.snapshots.push(this.brief);
    /*
     * Same reasoning for the typed messages. She said "portugal" and this file
     * has just overwritten it with "denmark"; scoring her opening against the
     * pinned brief would report a deletion the harness performed, on every one
     * of the fifteen rows.
     */
    this.typed.length = 0;
    /*
     * And so is everything the first half said, showed and caught. A pitch for
     * Portugal in the transcript of a row headed "japan" is the harness's own
     * noise; the questions are kept, because she really was asked them.
     */
    this.said.length = 0;
    this.labels.length = 0;
    this.drift.length = 0;
    this.calls.length = 0;
    this.trip = null;
    this.briefAtPlan = undefined;
    this.rec = undefined;
    this.pitch = undefined;
    this.refs = freshRefs();
    await this.turn();
  }
}

function freshRefs(): FlowRefs {
  return {
    history: { current: [] }, pitched: { current: null }, headline: { current: "" },
    failedResearch: { current: null }, gen: { current: 0 },
  };
}

export interface ScenarioResult {
  id: string;
  destination: string;
  questions: number;
  scores: Scores;
  mean: number;
  /**
   * For the head-to-head, which needs the plan itself and not only its score.
   * Null when the app declined to plan — see `outcome_fidelity`.
   */
  trip: Trip | null;
  headline: string;
  why: string;
  /** User messages it took to reach an itinerary: the opening, plus every answer. */
  turns: number;
}

/**
 * `answer` replaces the scripted replies with something that responds to what
 * was actually asked. The eval proper does not pass it: it wants the same
 * numbers every run. The head-to-head does, because a scripted traveller
 * answering "About a week." to "where are you flying from?" makes whichever
 * side asked the better question look worse.
 */
export async function runScenario(
  driver: AgentDriver, sc: Scenario, answer?: (asked: string) => Promise<string>,
  opts: { at?: string } = {},
): Promise<ScenarioResult> {
  const s = new Session(driver, emptyBrief(sc.opening));

  // --- the conversation, one real turn per message -------------------------
  /*
   * The loop is hers: she says something, the turn runs, and if it comes back
   * with a question she answers it. The old loop drove `driver.nextQuestion`
   * directly and then planned regardless of what the app would have done,
   * which is how a scenario the product refuses got twenty metrics scored
   * against a trip it never built.
   */
  await s.send(sc.opening);
  let ai = 0;
  /*
   * She replies while there is something to reply to.
   *
   * A question is the obvious case. The other one is new, and it is the app's
   * doing: advance() can end a turn with no question and no plan — "I don't
   * have enough from you yet to pick somewhere. Tell me a place, a region, or
   * what you want out of the trip" — and a traveller reads that and says the
   * next thing she came to say. A harness that only answers questions leaves
   * her staring at a prompt with her third scripted sentence unspoken, which
   * is how `stacked-typed-phrases` ended without ever mentioning Portugal.
   *
   * She still does not volunteer over a finished plan: once there is an
   * itinerary the remaining lines go unsaid, exactly as before, so the edits
   * are the only thing that touches it.
   */
  /*
   * And she finishes what she came to say, even over a pitch.
   *
   * Stopping at the first plan left `stacked-typed-phrases` with its third
   * sentence — the one naming Portugal — unspoken, so the scenario asserted a
   * destination the harness never let her ask for. The product does not work
   * that way: a proposal is a proposal, and anything typed at it goes through
   * `interpret` and can repin the destination. A traveller who reads a pitch
   * for Mexico and says "we want portugal for the surfing" is using the app
   * exactly as designed.
   *
   * The line she has not said yet is the thing that keeps her talking, not
   * the app's willingness to hear it. What still stops her is running out of
   * script, questions or turns.
   */
  const stillTalking = () => s.question !== null || s.trip === null;
  while (stillTalking() && s.offered.length < MAX_QUESTIONS && s.sent < MAX_TURNS) {
    let said: string;
    if (answer) {
      // The head-to-head's traveller answers questions; there is nothing to
      // hand her when the turn ended without one.
      if (!s.question) break;
      said = await answer(s.question.prompt);
    } else {
      if (ai >= sc.answers.length) break;
      said = sc.answers[ai++];
    }
    await s.send(said);
  }

  /*
   * Things she says at a finished pitch, unprompted.
   *
   * `answers` are replies to questions, and a scenario listing more of them
   * than the app asks is under-specified: delivering the leftovers to every
   * scenario moved eight trips and cost four points of pace, which is the
   * harness inventing a conversation rather than measuring one. So the thing
   * she volunteers is declared, not inferred.
   *
   * It goes through `advance()`, not `applyOps`, because that is the product:
   * a proposal is a proposal, and a sentence typed at one runs `interpret`
   * and can repin the destination. `edits` cannot do that, which is why
   * `stacked-typed-phrases` asserted a destination the harness never let her
   * ask for.
   */
  for (const line of sc.volunteered ?? []) {
    if (s.sent >= MAX_TURNS) break;
    await s.send(line);
  }

  if (opts.at) await s.repin(opts.at);

  const questions = s.offered.length;
  const trip0 = s.trip;
  const rec = s.rec;
  const pitch = s.pitch;
  const pitchText = pitch ? `${pitch.headline} ${pitch.body}` : "";
  /** The brief as it stood when the trip was first planned; edits move `brief`. */
  const brief0: Brief = s.briefAtPlan ?? s.brief;

  /*
   * A session that ends without an itinerary.
   *
   * This is a real ending, not an error: advance() refuses to rank the
   * catalogue when she named nowhere, refuses to pitch while somewhere she
   * named is unresolved, and stops rather than substitute a country when
   * research fails. Everything below that reads a Trip is marked `na` — see
   * Metric.na for why that is neither a 0 nor a free 100% — and the ending
   * itself is scored by `outcome_fidelity`.
   *
   * Under the sweep the pin forces a plan, so the expectation is a plan
   * whatever the scenario declares.
   */
  const expected: M.Outcome = opts.at ? "plan" : (sc.outcome ?? "plan");
  const delivered: M.Outcome = trip0 ? "plan" : "refusal";
  const lastSaid = s.said[s.said.length - 1] ?? "it said nothing at all";

  const na = (why: string) => M.na(`no plan: ${why}`);
  const NOPLAN = delivered === "refusal";

  let trip: Trip = trip0 ?? ({} as Trip);
  let brief = s.brief;
  let profile = s.profile;

  const planScores: Scores = NOPLAN ? {
    schedule_validity: na("nothing was scheduled"),
    pace_adherence: na("nothing was scheduled"),
    downtime_presence: na("nothing was scheduled"),
    geographic_efficiency: na("nothing was scheduled"),
    budget_adherence: na("nothing was quoted"),
    question_economy: M.questionEconomy(questions),
    single_recommendation: na("nothing was recommended"),
    reason_coverage: na("nothing was scheduled"),
    destination_fidelity: na("it went nowhere"),
    slop_score: na("no prose about a trip"),
  } : {
    schedule_validity: M.scheduleValidity(trip, brief, profile),
    pace_adherence: M.paceAdherence(trip, brief),
    downtime_presence: M.downtimePresence(trip, brief),
    geographic_efficiency: M.geographicEfficiency(trip),
    budget_adherence: M.budgetAdherence(trip, brief),
    question_economy: M.questionEconomy(questions),
    single_recommendation: M.singleRecommendation(
      pitchText, rec!.destinationId, rec!.confidence),
    reason_coverage: M.reasonCoverage(trip),
    destination_fidelity: M.destinationFidelity(rec!.destinationId, sc.expectDestination),
    slop_score: M.slopScore([
      pitch!.headline, pitch!.body,
      ...trip.days.flatMap((d) => d.items.map((i) => i.reason)),
      ...trip.days.map((d) => d.theme),
    ]),
  };

  // --- edits ---------------------------------------------------------------
  const editResults: M.Metric[] = [];
  const honestyResults: M.Metric[] = [];
  const qualifierResults: M.Metric[] = [];
  const clauseResults: M.Metric[] = [];
  const roundTrips: { said: string; back: string; landed: boolean; restored: boolean }[] = [];
  /** Everything the edits said back to her, for `attribution_accuracy`. */
  const summaries: string[] = [];
  /**
   * The clauses lib/edit.ts could not action and named back to her, for
   * `words_survive`: a phrase reported as not done is not a phrase that
   * vanished.
   */
  const unresolvedBack: string[] = [];
  /*
   * An edit she cannot get is a stop, not a crash. parseEdit is one of the
   * four with no floor: reading "less walking, more food" is comprehension,
   * and a regex that guesses at it is the failure the no-floor rule exists to
   * prevent. So under --dead the edits stop here the way they stop on screen,
   * and the trip is left exactly as it was.
   */
  let editsStopped = 0;
  for (const e of NOPLAN ? [] : sc.edits) {
    s.typed.push(e.text);
    const before = trip;
    let ops;
    try {
      ops = await driver.parseEdit(e.text, trip);
    } catch (err) {
      if (!noModel(err)) throw err;
      editsStopped++;
      s.said.push("I'm stopping here: this deployment's Anthropic account is out of credit, so "
        + "there's no model behind me right now. I'd rather stop than answer you with pattern "
        + "matching and let you think it was me.");
      continue;
    }
    // The sentence as well as the ops, exactly as app/page.tsx passes it. A
    // harness that dropped it here would be measuring a different app.
    const r = applyOps(trip, ops, brief, profile, e.text);
    const available = e.check.type === "more_tag"
      ? hasTag(before, e.check.tag, brief, profile)
      : e.check.type === "fewer_activities"
        // Is there anything left to cut? If every day is already at or under
        // the reduced ceiling, declining is the correct answer.
        ? before.days.some((d) =>
            d.items.filter((i) => i.type === "activity").length
            > PACE_ACTIVITIES[paceDown(inferPace(brief))])
        : true;
    trip = r.trip; brief = r.brief; profile = r.profile;
    s.snapshots.push(brief);
    summaries.push(...r.summary);
    unresolvedBack.push(...r.unresolved);
    editResults.push(M.editResponsiveness(before, trip, e.check, {
      spoke: r.summary.length > 0, available,
    }));
    /*
     * `claimed` is whether the sentence she is about to read ASSERTS that the
     * trip moved. It is not the same as having said something: "this is
     * already about as light as it gets" is an honest decline and must not
     * count as a lie, or a real lie is lost in the noise.
     */
    honestyResults.push(M.replyMatchesState(before, trip, { claimed: r.claimed }));
    // Her own qualifier, read off her own sentence. Every other edit metric
    // scores the KIND of change; this one scores WHERE it landed.
    qualifierResults.push(M.qualifierFidelity(before, trip, e.text));
    /*
     * Every clause she typed, either done or named. Scored against the driver
     * under test, so an LLM run measures the model's parse and a rules run
     * measures parseEditRules.
     */
    clauseResults.push(await M.clauseAccounting(
      e.text, (text) => driver.parseEdit(text, before), r.unresolved));
    /*
     * The undo half of `idempotence`, run on a SIDE COPY from the state before
     * this edit. Folding it into the main sequence would mean the scenario's
     * later edits were applied to a trip that had been edited twice more than
     * the scenario says, and every metric after it would be scoring a
     * different trip than the one it names.
     */
    if (e.inverse) {
      const there = applyOps(before, ops, brief, profile);
      const back = applyOps(there.trip, await driver.parseEdit(e.inverse, there.trip),
        there.brief, there.profile);
      /*
       * Only when the forward edit actually landed.
       *
       * "Add more wine." on a Portugal trip with no wine left to add is
       * DECLINED — "I can't fit more wine into these cities without spending
       * the time on travel instead" — so the plan does not move. Scoring the
       * pair as a failed round trip blamed the undo for not restoring a
       * change that was never made, and the honest reading of what followed
       * is that "less wine" is a valid instruction on its own, not the second
       * half of anything. A declined instruction has no inverse.
       *
       * Reported rather than dropped, so this cannot quietly become the
       * reason the metric is green.
       */
      const landed = M.tripSignature(there.trip) !== M.tripSignature(before);
      roundTrips.push({ said: e.text, back: e.inverse, landed,
        restored: M.tripSignature(back.trip) === M.tripSignature(before) });
    }
  }

  /*
   * The same brief, planned twice more, for `idempotence`.
   *
   * `twin` goes with the plan; `bare` is made last, from the same brief, with
   * a whole scenario's worth of module state — id counters, reason banks,
   * registry writes — between it and the first, which is where a plan that
   * depends on process history actually diverges. Both use the brief as it
   * stood when advance() planned, and neither is what she was shown: the trip
   * on screen is the one the turn built.
   */
  const twin: Trip | undefined = rec ? planTrip(brief0, rec, emptyProfile(), { startDate: FIXED_START }) : undefined;
  const bare: Trip | undefined = rec ? planTrip(brief0, rec, emptyProfile(), { startDate: FIXED_START }) : undefined;

  /*
   * The question gate, run for real, on a turn of its own.
   *
   * `thread_continuity` cannot be exercised through the rules driver's own
   * questions: `nextQuestionRules` is gated so tightly that it never asks for
   * something the brief already holds, so the metric would read 100% on this
   * scorecard forever while a model driver re-asked the length on every other
   * turn. So a scenario may declare the question a drifting agent WOULD put at
   * this point, and one more turn is run with a stub that offers it. What is
   * measured is what lib/flow.ts's `put` does with it.
   *
   * A turn of its own, with fresh refs, because the gate under test lives in
   * the discovery branch and that branch is closed once something has been
   * pitched. Folding the probe into the live session would mean either not
   * reaching the gate at all or replanning the trip the edits were applied to.
   */
  if (sc.reask && !opts.at) {
    const probe = new Session(driver, brief0);
    /*
     * Offered once, not on every call. advance() asks the model for a question
     * twice in a turn — once for discovery, once for logistics — and a stub
     * that hands back the same sentence both times is a drifting agent the
     * scenario did not describe, counted twice.
     */
    let put = false;
    await probe.turn({
      question: async () => ({ question: put ? null : ((put = true), sc.reask), driver: "rules" }),
    });
    /*
     * Only the thread events, and only the questions. The probe is a second
     * turn from a brief the session has moved past; anything else it catches
     * belongs to it, not to the run being scored.
     */
    s.drift.push(...probe.drift.filter((x) => x.kind === "thread"));
    s.offered.push(...probe.offered);
  }

  const scores: Scores = {
    ...planScores,
    edit_responsiveness: NOPLAN
      ? na("nothing to edit")
      : editResults.length
        ? {
            score: editResults.reduce((s2, m) => s2 + m.score, 0) / editResults.length,
            raw: editResults.map((m) => m.raw).join("; "),
          }
        : { score: 1, raw: "no edits" },
    // Re-checked AFTER edits: this is where violations actually creep in.
    reply_matches_state: NOPLAN
      ? na("nothing to edit")
      : honestyResults.length
        ? {
            score: honestyResults.reduce((s2, m) => s2 + m.score, 0) / honestyResults.length,
            raw: honestyResults.map((m) => m.raw).join("; "),
          }
        : { score: 1, raw: "nothing said" },
    qualifier_fidelity: NOPLAN
      ? na("nothing to edit")
      : qualifierResults.length
        ? {
            score: qualifierResults.reduce((s2, m) => s2 + m.score, 0) / qualifierResults.length,
            raw: qualifierResults.map((m) => m.raw).join("; "),
          }
        : { score: 1, raw: "no edits" },
    // After the edits, because an edit is how a covered thing stops being
    // covered while the sentence about it stays on screen.
    claim_accuracy: NOPLAN ? na("nothing was claimed about a trip") : M.claimAccuracy(trip, brief),
    // Same reason as claim_accuracy: an edit is how a phrase that WAS covered
    // stops being covered while the sentence about it is still on screen.
    noise_rate: NOPLAN ? na("nothing was reported about a trip") : M.noiseRate(trip, brief),
    clause_accounting: NOPLAN
      ? na("nothing to edit")
      : clauseResults.length
        ? {
            score: clauseResults.reduce((s2, m) => s2 + m.score, 0) / clauseResults.length,
            raw: clauseResults.map((m) => m.raw).join("; "),
          }
        : { score: 1, raw: "no edits" },
    /*
     * Counted over the calls the TURN made, always — there is no longer a
     * separate research turn to count instead. A session that researched
     * somewhere is measured against that place; one that planned out of the
     * catalogue is measured against the destination it planned.
     */
    call_economy: M.callEconomy(s.calls, sc.research
      ? [sc.research]
      : rec ? [rec.destinationId] : []),
    idempotence: twin && bare ? M.idempotence({ a: twin, b: bare }, roundTrips) : na("nothing was planned"),
    /*
     * Read at the END, which is the only place the question means anything:
     * every question, patch, replan and edit has already happened.
     */
    words_survive: M.wordsSurvive(s.snapshots, {
      typed: s.typed,
      /*
       * The itinerary as she can read it: what is IN the plan, not the prose
       * justifying it. A phrase that left the brief but is plainly in the plan
       * in front of her has not vanished.
       *
       * `item.reason` and `item.note` are deliberately not here. Between them
       * they are the great bulk of the text in a trip and both are generic by
       * construction — the reason bank and the catalogue writing about the
       * PLACE, not about her. Including them scored "for work" as recoverable
       * off a wine bar's blurb: "a good room to work out what you actually
       * like before you buy any." That is a false pass, and a false pass here
       * is a deletion nobody hears about. Where a reason does carry her words
       * it carries them as an attribution ("you asked for X"), which is
       * `attribution_accuracy`'s surface and is scored there.
       *
       * Empty on a refusal: there is no plan, so there is nothing in one, and
       * a phrase she typed has to be found on the brief or in what the app
       * said instead.
       */
      plan: NOPLAN ? [] : [
        pitch?.headline ?? "", pitch?.body ?? "",
        trip.concept.headline, trip.concept.vibe, trip.concept.why,
        ...trip.days.map((d) => d.theme),
        ...trip.days.flatMap((d) => d.items.map((i) => i.name)),
      ],
      /*
       * Everything the app told her, including everything it told her it was
       * NOT doing.
       *
       * `s.said` is the real transcript now, so the refusals, the
       * unmatched-activity report and the pitch are in it verbatim rather than
       * reconstructed — the reconstruction was the harness's guess at what the
       * app says, and a guess is exactly what this file was rewritten to stop
       * making. What is added to it is the surfaces that never go through
       * `io.say`: the two composed lines on the card, the note about what we
       * could not enforce, the planner's own notes, the famous things it
       * passed on and why, the edits' replies, and the clauses lib/edit.ts
       * could not action.
       */
      spoken: [
        ...s.said,
        ...(NOPLAN ? [] : [
          whyLine(trip, brief), vibeLine(trip, brief), unenforcedNote(brief) ?? "",
          trip.concept.dateNote ?? "", trip.concept.overrideNote ?? "",
          trip.concept.paceShortfall ?? "",
          ...trip.passedOn.map((p) => `${p.name} ${p.note}`),
        ]),
        ...summaries, ...unresolvedBack,
      ],
    }),
    /*
     * Every surface that puts words in her mouth, in the state she is left
     * looking at: everything the agent said — which is now the real
     * transcript, pitch and gap-reports and refusals alike — plus the composed
     * lines on the card, the note about what we could not enforce, the
     * planner's own notes, the reason under every item, and whatever the edits
     * said back.
     *
     * `whyLine` is included explicitly rather than read off the concept: the
     * card shows the driver's pitch body when there is one and falls back to
     * `whyLine`, so on this path the line carrying "You said" would otherwise
     * never be scored at all — and it is the line the guard was written for.
     */
    attribution_accuracy: M.attributionAccuracy([
      ...s.said,
      ...(NOPLAN ? [] : [
        whyLine(trip, brief), vibeLine(trip, brief), unenforcedNote(brief) ?? "",
        trip.concept.dateNote ?? "", trip.concept.overrideNote ?? "",
        ...summaries,
        ...trip.days.flatMap((d) => d.items.map((i) => i.reason)),
        ...trip.days.map((d) => d.theme),
      ]),
    ], brief),
    // --- drift ---------------------------------------------------------
    // The four surfaces, scored with the same detectors lib/flow.ts acts on —
    // and now, for two of them, against the very events it acted on.
    subject_stability: M.subjectStability(brief0, profile, rec?.destinationId ?? null, s.drift),
    prose_grounding: M.proseGrounding(pitchText, rec, trip0, s.drift),
    thread_continuity: M.threadContinuity(s.offered, { asked: 0, drift: s.drift }),
    label_honesty: M.labelHonesty({ labels: s.labels, drift: s.drift }),
    preference_respect: NOPLAN ? na("nothing was scheduled") : M.preferenceRespect(trip, brief, profile),
    vibe_fidelity: NOPLAN ? na("nothing was scheduled") : M.vibeFidelity(trip, brief),
    schedule_validity_post_edit: NOPLAN
      ? na("nothing was scheduled")
      : M.scheduleValidity(trip, brief, profile),
    outcome_fidelity: M.outcomeFidelity(delivered, expected, lastSaid),
  };

  return {
    id: sc.id,
    destination: rec?.destinationId ?? "(no plan)",
    questions,
    scores,
    mean: M.meanOf(Object.values(scores)),
    trip: trip0 ? trip : null,
    headline: pitch?.headline ?? "",
    why: pitch?.body ?? "",
    turns: s.sent,
  };
}
