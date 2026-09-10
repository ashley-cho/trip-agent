/**
 * One scenario, start to finish, with no side effects.
 *
 * Split out of run.ts so it can be imported by things that are not a CLI.
 * run.ts loads .env.local off the filesystem at module scope, which is right
 * for a script and wrong for anything bundled into the app: importing it from
 * a route dragged `fs` and a dynamic path into the build.
 */
import type { AgentDriver, Question, Turn } from "@/lib/agent/types";
import { advance, type FlowAgent, type FlowIO, type FlowRefs, type Stage } from "@/lib/flow";
import { emptyBrief, emptyProfile, type Brief, type Trip, stating } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
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
import type { TravelerProfile, Tag } from "@/lib/types";

/** Is there any unused place with this tag anywhere in the trip's cities? */
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
const FIXED_START = "2026-10-10";   // deterministic: closedDays are weekday-based
const MAX_QUESTIONS = 8;

/**
 * Every driver call this scenario made, in order.
 *
 * `call_economy` needs a count and nothing else, so the wrapper does not touch
 * arguments or results — a recorder that reshapes what it records is a
 * different driver, and then the scorecard is measuring the harness.
 */
type CallLog = { name: string }[];

function recorded(d: AgentDriver, log: CallLog): AgentDriver {
  const wrap = (name: string, fn: unknown) => typeof fn === "function"
    ? (...a: unknown[]) => { log.push({ name }); return (fn as (...x: unknown[]) => unknown).apply(d, a); }
    : undefined;
  const out: Record<string, unknown> = { name: d.name };
  for (const k of Object.keys(d) as (keyof AgentDriver)[]) {
    if (k === "name") continue;
    out[k] = wrap(k, d[k]) ?? d[k];
  }
  return out as unknown as AgentDriver;
}

/**
 * One real turn through lib/flow.ts, with a stubbed model.
 *
 * The stub-and-record shape is scripts/regress-turn.ts's, deliberately: that
 * file is the only other thing in the project that executes advance(), and a
 * second hand-rolled imitation of the turn would drift from it. The stream
 * stub fails once and then answers, which is the case flow.ts's retry was
 * written for and which regress-turn pins; the pack stub never answers, which
 * is the case its own retry was written for. Together they are the worst case
 * a real traveller can hit.
 *
 * It was `researchCalls`, and it returned only a count of model calls for
 * `call_economy`. Two of the four drift metrics need the same thing — a turn
 * that actually ran — so it records what the turn showed and what it caught
 * as well. Everything is recorded verbatim: a recorder that reshapes what it
 * records is a different app, and then the scorecard is measuring the harness.
 */
interface TurnRecord {
  calls: CallLog;
  /** Status labels the turn put on screen, in order. null is "clear it". */
  labels: (string | null)[];
  /** Questions it actually put to her. */
  asked: number;
  /** Everything the drift detectors caught, whatever the turn then did. */
  drift: Drift[];
}

async function turnThrough(
  brief: Brief, over: Record<string, (...a: never[]) => unknown> = {},
): Promise<TurnRecord> {
  const calls: CallLog = [];
  const out: TurnRecord = { calls, labels: [], asked: 0, drift: [] };
  const rec = (name: string, fn: (...a: never[]) => unknown) =>
    (...args: never[]) => { calls.push({ name }); return fn(...args); };
  let streamed = 0;
  const api = {
    question: rec("question", async () => ({ question: null, driver: "rules" })),
    budget: rec("budget", async () => ({ ok: true })),
    suggest: rec("suggest", async () => ({ place: undefined, problem: "no", driver: "rules" })),
    researchStream: rec("researchStream", async () => ++streamed === 1
      ? { problem: "Researching it took longer than this deployment allows.", driver: "rules" }
      : { text: "A verdict.\n\nNotes about the place.", sources: [], driver: "rules" }),
    researchPack: rec("researchPack", async () => ({ pack: undefined, problem: "nothing came back", driver: "rules" })),
    researchPlaces: rec("researchPlaces", async () => ({ places: [] })),
    pitch: rec("pitch", async (r: never) => ({
      pitch: { headline: `Go to ${(r as { destinationId: string }).destinationId}.`, body: "Because." }, driver: "rules" })),
    stays: rec("stays", async () => ({ stays: [], driver: "rules" })),
    ...Object.fromEntries(Object.entries(over).map(([k, fn]) => [k, rec(k, fn)])),
  } as unknown as FlowAgent;
  const io: FlowIO = {
    say: () => {}, ask: () => { out.asked++; }, noteDriver: () => {}, setBrief: () => {}, setTrip: () => {},
    setStage: (_s: Stage) => {}, setQuestion: () => {},
    setResearching: (l) => { out.labels.push(l); },
    noteDrift: (d) => { out.drift.push(d); },
    openStream: () => "s", appendTo: () => () => {}, closeStream: () => {}, rememberSeen: () => {},
  };
  const refs: FlowRefs = {
    history: { current: [] }, pitched: { current: null }, headline: { current: "" },
    failedResearch: { current: null }, gen: { current: 0 },
  };
  await advance(brief, emptyProfile(), io, refs, api);
  return out;
}

export interface ScenarioResult {
  id: string;
  destination: string;
  questions: number;
  scores: Scores;
  mean: number;
  /** For the head-to-head, which needs the plan itself and not only its score. */
  trip: Trip;
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
  const calls: CallLog = [];
  driver = recorded(driver, calls);
  // --- discovery ---
  let brief: Brief = emptyBrief(sc.opening);
  brief = applyPatch(brief, await driver.interpret(sc.opening, brief));
  /*
   * The brief after every message and every edit, for `words_survive`, which
   * asks whether a phrase that was once ON the brief is still there at the
   * end. One final brief cannot answer that: a phrase the parser refused and a
   * phrase that was taken and later deleted look identical in it.
   */
  const snapshots: Brief[] = [brief];

  let questions = 0;
  let ai = 0;
  /*
   * The gate that decides when to stop asking counts the questions in the
   * HISTORY, and this loop was passing none. So `asked` was always 0, the
   * ceiling never tripped, and the only thing that ended discovery was the
   * scenario running out of scripted answers. Give it a traveller who answers
   * everything and it asked eight questions about a trip to Portugal.
   *
   * The app has always passed history. The harness measuring the app was the
   * thing that did not.
   */
  const history: Turn[] = [{ from: "user", text: sc.opening }];
  /*
   * Every question, with the transcript and the brief AS THEY STOOD when it
   * was put. `thread_continuity` asks whether the answer was already in hand
   * at that moment, and the final brief cannot answer that: by the end she has
   * answered everything, so every question would score as drift.
   */
  const asked: { q: Question; history: Turn[]; brief: Brief }[] = [];
  while (questions < MAX_QUESTIONS) {
    const q = await driver.nextQuestion(brief, history);
    if (!q) break;
    asked.push({ q, history: [...history], brief });
    questions++;
    history.push({ from: "agent", text: q.prompt });
    let said: string;
    if (answer) {
      said = await answer(q.prompt);
    } else {
      if (ai >= sc.answers.length) break;
      said = sc.answers[ai++];
    }
    history.push({ from: "user", text: said });
    /*
     * Record what she said before deriving from it, exactly as the app does.
     * The harness applied the patch and never called `stating`, so `stated`
     * was empty here and nowhere else — and anything that asks "did she type
     * this?" (the attribution gate, the "You said" line) was measuring a
     * traveller who had never spoken.
     */
    brief = applyPatch(stating(brief, said, "typed"), await driver.interpret(said, brief));
    snapshots.push(brief);
  }

  /*
   * The sweep pins the destination and runs the same scenario shape at it.
   * Everything upstream is untouched, so what is being measured is the
   * PLANNER against fifteen different catalogues rather than the recommender.
   * The pin has to clear the other three ways a destination can be chosen, or
   * a region or shortlist read earlier still outranks it inside recommend().
   */
  if (opts.at) {
    brief = { ...brief, namedDestination: opts.at, candidates: undefined,
      unknownCandidates: undefined, region: undefined, regionLabel: undefined,
      regionIds: undefined, focusCityId: undefined };
    /*
     * The pin is the HARNESS deleting what she said, not the app. Scoring
     * `words_survive` against it would put a red on every sweep row for a
     * deletion this file performed two lines above, so the pinned brief
     * becomes the new baseline. What the sweep then measures on this metric is
     * the plan-and-edit half of the session, which is the half the sweep is
     * for.
     */
    snapshots.length = 0;
    snapshots.push(brief);
  }

  // --- recommendation + plan ---
  const rec = recommend(brief);
  const pitch = await driver.pitch(rec, brief);
  let profile = emptyProfile();
  let trip: Trip = planTrip(brief, rec, profile, { startDate: FIXED_START });
  /*
   * The same brief, planned a second time, for `idempotence`. Planned before
   * the pitch prose is stamped onto the first one so the two are compared on
   * what the scheduler produced and not on a headline that was assigned.
   */
  const twin: Trip = planTrip(brief, rec, profile, { startDate: FIXED_START });
  /** The brief as it stood when the trip was first planned; edits move `brief`. */
  const brief0: Brief = brief;
  trip.concept.headline = pitch.headline;
  trip.concept.vibe = pitch.body;

  const planScores: Scores = {
    schedule_validity: M.scheduleValidity(trip, brief, profile),
    pace_adherence: M.paceAdherence(trip, brief),
    downtime_presence: M.downtimePresence(trip, brief),
    geographic_efficiency: M.geographicEfficiency(trip),
    budget_adherence: M.budgetAdherence(trip, brief),
    question_economy: M.questionEconomy(questions),
    single_recommendation: M.singleRecommendation(
      `${pitch.headline} ${pitch.body}`, rec.destinationId, rec.confidence),
    reason_coverage: M.reasonCoverage(trip),
    destination_fidelity: M.destinationFidelity(rec.destinationId, sc.expectDestination),
    slop_score: M.slopScore([
      pitch.headline, pitch.body,
      ...trip.days.flatMap((d) => d.items.map((i) => i.reason)),
      ...trip.days.map((d) => d.theme),
    ]),
  };

  // --- edits ---
  const editResults: M.Metric[] = [];
  const honestyResults: M.Metric[] = [];
  const qualifierResults: M.Metric[] = [];
  const clauseResults: M.Metric[] = [];
  const roundTrips: { said: string; back: string; landed: boolean; restored: boolean }[] = [];
  /** Everything the edits said back to her, for `attribution_accuracy`. */
  const summaries: string[] = [];
  for (const e of sc.edits) {
    const before = trip;
    const ops = await driver.parseEdit(e.text, trip);
    const r = applyOps(trip, ops, brief, profile);
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
    snapshots.push(brief);
    summaries.push(...r.summary);
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
   * The third plan, made last, from the same brief the first two were made
   * from. Two plans made back to back can agree because they ran a
   * millisecond apart; this one has a whole scenario's worth of module state
   * — id counters, reason banks, registry writes — between it and the first,
   * which is where a plan that depends on process history actually diverges.
   */
  const bare: Trip = planTrip(brief0, rec, emptyProfile(), { startDate: FIXED_START });

  /*
   * The research turn, for scenarios that name a place the catalogue does not
   * hold. Everything else plans out of the catalogue and its only place-scoped
   * call is the pitch.
   */
  const researchTurn: TurnRecord | undefined = sc.research
    ? await turnThrough({ ...brief, unknownCandidates: [sc.research] })
    : undefined;
  const callLog: CallLog = researchTurn ? researchTurn.calls : calls;
  const places = sc.research ? [sc.research] : [rec.destinationId];

  /*
   * The question gate, run for real.
   *
   * `thread_continuity` cannot be exercised through the rules driver's own
   * questions: `nextQuestionRules` is gated so tightly that it never asks for
   * something the brief already holds, so the metric would read 100% on this
   * scorecard forever while a model driver re-asked the length on every other
   * turn. So a scenario may declare the question a drifting agent WOULD put at
   * this point, and the turn is run with a stub that asks it. What is measured
   * is what lib/flow.ts does with it.
   */
  const reaskTurn: TurnRecord | undefined = sc.reask
    ? await turnThrough(brief0, { question: async () => ({ question: sc.reask, driver: "rules" }) })
    : undefined;

  const scores: Scores = {
    ...planScores,
    edit_responsiveness: editResults.length
      ? {
          score: editResults.reduce((s, m) => s + m.score, 0) / editResults.length,
          raw: editResults.map((m) => m.raw).join("; "),
        }
      : { score: 1, raw: "no edits" },
    // Re-checked AFTER edits: this is where violations actually creep in.
    reply_matches_state: honestyResults.length
      ? {
          score: honestyResults.reduce((s, m) => s + m.score, 0) / honestyResults.length,
          raw: honestyResults.map((m) => m.raw).join("; "),
        }
      : { score: 1, raw: "nothing said" },
    qualifier_fidelity: qualifierResults.length
      ? {
          score: qualifierResults.reduce((s, m) => s + m.score, 0) / qualifierResults.length,
          raw: qualifierResults.map((m) => m.raw).join("; "),
        }
      : { score: 1, raw: "no edits" },
    // After the edits, because an edit is how a covered thing stops being
    // covered while the sentence about it stays on screen.
    claim_accuracy: M.claimAccuracy(trip, brief),
    // Same reason as claim_accuracy: an edit is how a phrase that WAS covered
    // stops being covered while the sentence about it is still on screen.
    noise_rate: M.noiseRate(trip, brief),
    clause_accounting: clauseResults.length
      ? {
          score: clauseResults.reduce((s, m) => s + m.score, 0) / clauseResults.length,
          raw: clauseResults.map((m) => m.raw).join("; "),
        }
      : { score: 1, raw: "no edits" },
    call_economy: M.callEconomy(callLog, places),
    idempotence: M.idempotence({ a: twin, b: bare }, roundTrips),
    /*
     * Read at the END, which is the only place the question means anything:
     * every question, patch, replan and edit has already happened.
     */
    words_survive: M.wordsSurvive(snapshots),
    /*
     * Every surface that puts words in her mouth, in the state she is left
     * looking at: the pitch, the two composed lines under it, the note about
     * what we could not enforce, the planner's own notes, the reason under
     * every item, and whatever the edits said back.
     *
     * `whyLine` is included explicitly rather than read off the concept: the
     * card shows the driver's pitch body when there is one and falls back to
     * `whyLine`, so on this path the line carrying "You said" would otherwise
     * never be scored at all — and it is the line the guard was written for.
     */
    attribution_accuracy: M.attributionAccuracy([
      pitch.headline, pitch.body,
      whyLine(trip, brief), vibeLine(trip, brief), unenforcedNote(brief) ?? "",
      trip.concept.dateNote ?? "", trip.concept.overrideNote ?? "",
      ...summaries,
      ...trip.days.flatMap((d) => d.items.map((i) => i.reason)),
      ...trip.days.map((d) => d.theme),
    ], brief),
    // --- drift ---------------------------------------------------------
    // The four surfaces, scored with the same detectors lib/flow.ts acts on.
    subject_stability: M.subjectStability(brief0, profile, rec.destinationId),
    prose_grounding: M.proseGrounding(`${pitch.headline} ${pitch.body}`, rec, trip),
    thread_continuity: M.threadContinuity(asked, reaskTurn
      ? { asked: reaskTurn.asked, drift: reaskTurn.drift }
      : { asked: 0, drift: [] }),
    label_honesty: M.labelHonesty(researchTurn ?? { labels: [], drift: [] }),
    preference_respect: M.preferenceRespect(trip, brief, profile),
    vibe_fidelity: M.vibeFidelity(trip, brief),
    schedule_validity_post_edit: M.scheduleValidity(trip, brief, profile),
  };

  const vals = Object.values(scores).map((s) => s.score);
  return {
    id: sc.id,
    destination: rec.destinationId,
    questions,
    scores,
    mean: vals.reduce((a, b) => a + b, 0) / vals.length,
    trip,
    headline: pitch.headline,
    why: pitch.body,
    // The opening sentence, plus one message for every question she answered.
    turns: 1 + (answer ? questions : Math.min(questions, sc.answers.length)),
  };
}

