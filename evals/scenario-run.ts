/**
 * One scenario, start to finish, with no side effects.
 *
 * Split out of run.ts so it can be imported by things that are not a CLI.
 * run.ts loads .env.local off the filesystem at module scope, which is right
 * for a script and wrong for anything bundled into the app: importing it from
 * a route dragged `fs` and a dynamic path into the build.
 */
import type { AgentDriver, Turn } from "@/lib/agent/types";
import { emptyBrief, emptyProfile, type Brief, type Trip } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { applyOps } from "@/lib/edit";
import type { Scenario } from "./scenarios";
import * as M from "./metrics";
import type { Scores } from "./metrics";
import { candidatesFor } from "@/lib/select";
import { PACE_ACTIVITIES } from "@/lib/types";
import { inferPace, paceDown } from "@/lib/discovery";
import type { TravelerProfile, Tag } from "@/lib/types";

/** Is there any unused place with this tag anywhere in the trip's cities? */
function hasTag(trip: Trip, tag: string, brief: Brief, profile: TravelerProfile): boolean {
  const used = new Set(trip.days.flatMap((d) => d.items.map((i) => i.placeId).filter(Boolean) as string[]));
  const cities = new Set(trip.days.map((d) => d.cityId));
  for (const c of cities) {
    if (candidatesFor(c, brief, profile).some((x) => !used.has(x.place.id) && x.place.tags.includes(tag as Tag))) {
      return true;
    }
  }
  return false;
}
const FIXED_START = "2026-10-10";   // deterministic: closedDays are weekday-based
const MAX_QUESTIONS = 8;

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
): Promise<ScenarioResult> {
  // --- discovery ---
  let brief: Brief = emptyBrief(sc.opening);
  brief = applyPatch(brief, await driver.interpret(sc.opening, brief));

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
  while (questions < MAX_QUESTIONS) {
    const q = await driver.nextQuestion(brief, history);
    if (!q) break;
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
    brief = applyPatch(brief, await driver.interpret(said, brief));
  }

  // --- recommendation + plan ---
  const rec = recommend(brief);
  const pitch = await driver.pitch(rec, brief);
  let profile = emptyProfile();
  let trip: Trip = planTrip(brief, rec, profile, { startDate: FIXED_START });
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
    editResults.push(M.editResponsiveness(before, trip, e.check, {
      spoke: r.summary.length > 0, available,
    }));
    /*
     * `summary` is what the app will tell her it did. If it is empty she is
     * told nothing changed, so an empty summary next to a moved itinerary is
     * the dog-sledding turn: the plan rebuilt underneath a sentence saying it
     * hadn't.
     */
    honestyResults.push(M.replyMatchesState(before, trip, { claimed: r.summary.length > 0 }));
  }

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

