import { flightUsdFrom, type Origin } from "@/lib/origin";
import { isDomestic } from "@/lib/abroad";
import type { Brief, Confidence, Destination, Pace, TravelerProfile, Vibe } from "@/lib/types";
import { ALL_VIBES, PACE_ACTIVITIES } from "@/lib/types";
import { CITIES, DESTINATIONS, cityById, destinationById, isKnownDestination } from "@/data/destinations";
import { isResearched } from "@/data/registry";
import { inTropics, membersOf } from "@/lib/regions";
import { PLACES } from "@/data";
import { contentFit } from "@/lib/select";
import { emptyProfile } from "@/lib/types";
import { effectiveDays, inferPace } from "@/lib/discovery";
import { minimumToPlan, placesNeeded } from "@/lib/research";
import type { Recommendation } from "@/lib/agent/types";

const W = { vibe: 0.32, budget: 0.20, pace: 0.14, duration: 0.06, depth: 0.12, distinct: 0.16 };

/**
 * What "strong at X" has to beat. Being a 5 for food when the field average is
 * 4.5 says almost nothing; being a 5 for nature against an average of 3.4 is a
 * real claim. Without this the scoring rewards generalists, and one
 * destination that is decent at everything wins nearly every brief.
 */
const FIELD_MEAN: Record<Vibe, number> = (() => {
  const out = {} as Record<Vibe, number>;
  for (const v of ALL_VIBES) {
    out[v] = DESTINATIONS.reduce((s, d) => s + d.strengths[v], 0) / DESTINATIONS.length;
  }
  return out;
})();

/** How much this destination stands out on what they asked for, 0..1. */
function distinctiveness(d: Destination, vibes: Vibe[]): number {
  if (vibes.length === 0) return 0.5;
  const lift = vibes.reduce((s, v) => s + (d.strengths[v] - FIELD_MEAN[v]), 0) / vibes.length;
  return Math.max(0, Math.min(1, 0.5 + lift / 3));
}

/**
 * Usable places we hold for this destination, across every one of its cities.
 *
 * `skip` entries are excluded for the same reason lib/research.ts excludes
 * them from a researched pack: they are the things the agent has decided not
 * to schedule, so counting them measures a catalogue we will not plan from.
 */
export function catalogueSize(d: Destination): number {
  const cities = new Set(
    CITIES.filter((c) => c.destinationId === d.id).map((c) => c.id));
  return PLACES.filter((p) => !p.skip && cities.has(p.cityId)).length;
}

/**
 * Of those, the ones that can fill a day rather than feed you during it.
 *
 * The planner schedules meals and drinks into their own slots and they do not
 * count toward the pace the traveller asked for — `paceAdherence` counts items
 * of type `activity` and nothing else. A catalogue of eleven restaurants and
 * three walks is not a catalogue for a busy week, and counting it as fourteen
 * says it is.
 */
export function catalogueActivities(d: Destination): number {
  const cities = new Set(
    CITIES.filter((c) => c.destinationId === d.id).map((c) => c.id));
  return PLACES.filter(
    (p) => !p.skip && cities.has(p.cityId) && p.kind !== "meal" && p.kind !== "drink",
  ).length;
}

/**
 * Things to do that a trip of this length, at this pace, actually needs.
 *
 * Numbers off the app's own shelf and no new one invented here.
 * `PACE_ACTIVITIES` is what the planner schedules against; the first and last
 * days are travel days that neither the planner fills nor `paceAdherence`
 * scores; and that metric counts a day adherent at one BELOW target, which is
 * the band this has to clear.
 *
 * One below target, not target, and the difference is the whole calibration.
 * At the full number a busy eight-day city trip wants thirty distinct things
 * and exactly one catalogue in fifteen has them — so "eat my way through a
 * city for a week and a bit" got answered with Portugal, and the food brief
 * went to the wrong country with a straight face. Refusing to plan Korea is
 * not an improvement on planning Korea a little under pace; it is a different
 * and worse answer. This is a floor under the tolerated band, not a target.
 *
 * Nothing is reused across days, so it is a floor on the catalogue rather than
 * a budget. It is deliberately not `placesNeeded`: that number caps at twenty
 * because it answers "should I go and fetch more from the model", where a cap
 * is right. This answers "is what we shipped enough", where a cap is a blind
 * spot — and it was that blind spot that let the southwest through at ten days
 * on twenty-four places and scored 26% on pace adherence for it.
 */
export function activitiesNeeded(days: number, pace: Pace): number {
  return Math.max(1, days - 2) * Math.max(1, PACE_ACTIVITIES[pace] - 1);
}

/**
 * The longest trip this catalogue can carry at this pace, in days.
 *
 * Reported to the traveller, so it is derived from the bar rather than being a
 * second opinion about it.
 */
export function daysSupported(d: Destination, pace: Pace): number {
  let last = 0;
  for (let days = 1; days <= 30; days++) {
    if (!carries(d, days, pace)) break;
    last = days;
  }
  return last;
}

/**
 * Can we plan the trip she asked for here, out of what we actually hold?
 *
 * Both bars, because they catch different thinness. `placesNeeded` is the
 * two-a-day floor lib/research.ts puts on a researched pack and it counts
 * everything, meals included — a week with nowhere to eat is not a week.
 * `activitiesNeeded` is the pace she asked for, and it counts only what can
 * fill a day.
 */
export function carries(d: Destination, days: number, pace: Pace): boolean {
  return catalogueSize(d) >= placesNeeded(days)
    && catalogueActivities(d) >= activitiesNeeded(days, pace);
}

/**
 * The floor below which there is no trip here at all, at any pace.
 *
 * Distinct from `carries` and it has to stay distinct, for the reason
 * lib/research.ts gives at `minimumToPlan`: a week with one real thing a day
 * is a trip, and throwing a country away because the back half of its list is
 * short is how a traveller ends up in Paris asking about the Faroes.
 */
export const cataloguePlannable = (d: Destination, days: number) =>
  catalogueSize(d) >= minimumToPlan(days);

/**
 * Is this too thin for the trip she asked for, given how we came by it?
 *
 * Two bars, and they must stay two, for the reason lib/research.ts gives at
 * `minimumToPlan`.
 *
 * A catalogue we SHIPPED that cannot carry her length is our bug, and there
 * are fourteen others on the shelf: refuse at the full bar and let her pick
 * again. A catalogue we FETCHED at runtime that is short is the world being
 * small, the per-base fill-in has already run, and lib/flow.ts has already
 * applied `plannable` to it — refusing here on a stricter number would throw
 * away a country because the back half of a list didn't arrive, which is the
 * Faroe Islands failure that bar exists to prevent. So it keeps the low one.
 *
 * And the length has to be one SHE chose. With no days on the brief we plan
 * against seven; refusing on a number this app invented is not honesty, it is
 * the same guess wearing a hard hat.
 */
export function tooThinFor(d: Destination, brief: Brief, days: number): boolean {
  if (isResearched(d.id) || brief.days === undefined) {
    return !cataloguePlannable(d, days);
  }
  return !carries(d, days, inferPace(brief));
}

/**
 * What to say when the catalogue is too thin for the length asked for.
 *
 * Phrased to sit inside "The closest is X, and even that ...", which is where
 * lib/agent/rules.ts puts it, and to name the number rather than the
 * machinery — nobody cares that `placesNeeded` returned twenty.
 *
 * This read "and you asked for 7", which `attribution_accuracy` correctly
 * takes as a claim about something she typed — and the 7 is a number this app
 * derived from "about a week". It cost that metric three points across the
 * sweep before anyone had typed a digit. The length is STATED here, not
 * attributed.
 */
export function thinReason(d: Destination, brief: Brief, days: number): string {
  const carriesDays = daysSupported(d, inferPace(brief));
  return carriesDays >= 2
    ? `only has about ${carriesDays} days of material in it, against a trip of ${days}`
    : `doesn't have enough in it for me to plan ${days} days`;
}

/**
 * How well the seeded data can actually sustain a trip of this length here.
 * Recommending a destination we then plan blank days for is worse than not
 * recommending it. Replaced by a real content check once data is live.
 */
export function dataDepth(d: Destination, days: number): number {
  return Math.max(0, Math.min(1, catalogueSize(d) / (days * 2.6)));
}

/**
 * Quick pre-itinerary estimate. The 1.35 factor is the gap between the cheapest
 * credible day and the day this agent would actually plan — without it the
 * recommender proposes trips the planner then can't afford.
 */
export function roughCost(d: Destination, days: number, origin?: Origin | null): number {
  return Math.round(flightFor(d, origin) + days * d.floorPerDayUsd * 1.35);
}

/** Airfare adjusted for where they actually are. */
export function flightFor(d: Destination, origin?: Origin | null): number {
  return flightUsdFrom(d, cityById(d.hubCityId), origin);
}

/** How hard a learned lean pulls when the traveller stated nothing this time. */
const LEAN_WEIGHT = 0.35;

/**
 * Penalise what this traveller has already been shown, hardest for the most
 * recent. Without it "surprise me" is a pure function of the brief: the top
 * four destinations sat within 0.6% of each other and the same one won every
 * single time. Rejections bite harder than mere exposure, and nothing is ever
 * banned outright — the right answer stays the right answer if it is far
 * enough ahead.
 */
function novelty(id: string, p: TravelerProfile): number {
  // "I've already been" is the one rejection that is permanent. Everything
  // else is a weight, because people change their minds and the right answer
  // should still be able to win.
  if ((p.visitedDestinationIds ?? []).includes(id)) return 0;
  let f = 1;
  const seen = p.seenDestinationIds ?? [];
  const i = seen.lastIndexOf(id);
  if (i >= 0) {
    const recency = (i + 1) / seen.length; // 1 = shown most recently
    f *= 1 - (0.10 + 0.45 * recency);
  }
  if ((p.rejectedDestinationIds ?? []).includes(id)) f *= 0.55;
  return Math.max(0.2, f);
}

/** Spread of a strength vector, normalised. High means characterful. */
function character(d: Destination): number {
  const v = Object.values(d.strengths);
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
  return Math.min(1, sd / 1.2);
}

function vibeScore(d: Destination, vibes: Vibe[], leanings?: Partial<Record<Vibe, number>>): number {
  if (vibes.length === 0) {
    // Nothing stated. Ranking by average strength picks whichever destination
    // is blandly good at everything, and picks the same one every time — the
    // exact opposite of "surprise me". Half the weight goes to character, so
    // a place with a strong opinion beats a safe all-rounder.
    const all = Object.values(d.strengths);
    const mean = all.reduce((a, b) => a + b, 0) / all.length / 5;
    const base = mean * 0.5 + character(d) * 0.5;

    // Nothing stated *this time* is not the same as nothing known. Someone who
    // has taken three food-and-nature trips has told us what they like; the
    // fact that they didn't retype it is the whole point of a profile.
    const lean = leanings && Object.keys(leanings).length ? leanings : null;
    if (!lean) return base;
    // Weights are signed. A destination strong in something they've pushed
    // away from scores worse, not merely no better, so "not my kind of place"
    // is a real signal rather than a shrug.
    let num = 0, den = 0;
    for (const [v, w] of Object.entries(lean) as [Vibe, number][]) {
      num += ((d.strengths[v] / 5) * 2 - 1) * w;
      den += Math.abs(w);
    }
    if (den === 0) return base;
    const fit = (num / den + 1) / 2;   // back into 0..1
    return base * (1 - LEAN_WEIGHT) + fit * LEAN_WEIGHT;
  }
  const mean = vibes.reduce((sum, v) => sum + d.strengths[v], 0) / vibes.length / 5;
  // Reward destinations that are strong across ALL requested vibes, not just
  // spiky on one — a trip has to satisfy everything they asked for.
  const worst = Math.min(...vibes.map((v) => d.strengths[v])) / 5;
  // Weighted toward the worst-served vibe: a destination that's superb at food
  // and hopeless at rest is the wrong answer for someone who asked for both.
  return mean * 0.55 + worst * 0.45;
}

function budgetScore(d: Destination, b: Brief, days: number): number {
  if (b.budgetUsd === undefined) return 0.85;
  const est = roughCost(d, days, b.origin);
  const ratio = est / b.budgetUsd;
  // Continuous, not banded: being $9 over an estimate shouldn't cost a third
  // of the score, which is exactly what a cliff at 1.0 did.
  if (ratio <= 0.85) return 1;
  return Math.max(0, 1 - (ratio - 0.85) / 0.55);
}

export interface ScoredDestination {
  id: string;
  score: number;
  parts: { vibe: number; budget: number; pace: number; duration: number; depth: number; distinct: number };
  excluded?: string;
}

/**
 * Does this destination fail a climate she ruled out?
 *
 * `warmth` is 1 to 5 and has been on every destination, hand-written and
 * researched, since the catalogue existed. It was read in exactly one place:
 * a bonus when she asked FOR sun. There was no way to say no to it.
 *
 *   hot    4 and 5. 3 is a shoulder-season country and not what anyone means.
 *   cold   1 and 2, the same line from the other end.
 *   humid  the tropics, by latitude, which is the part of "humid" the data
 *          can actually support — see lib/regions.ts.
 */
function ruledOutByClimate(d: Destination, climate: "hot" | "cold" | "humid"): boolean {
  if (climate === "hot") return d.warmth >= 4;
  if (climate === "cold") return d.warmth <= 2;
  return inTropics(d.id);
}

export function scoreDestinations(brief: Brief, profile?: TravelerProfile): ScoredDestination[] {
  const days = effectiveDays(brief);
  const pace = inferPace(brief);

  // Somewhere they've told us they've already been is out, whether they said
  // it in a sentence or clicked the chip. Not a penalty: out. Recommending
  // Zion to someone who has just said they walked Angel's Landing is the
  // single clearest way to prove nobody was listening.
  const banned = new Set([
    ...(profile?.visitedDestinationIds ?? []),
    ...(brief.visitedIds ?? []),
  ]);

  // If they have been to every single thing we hold, an empty list would crash
  // the caller and, worse, would be a lie by omission. Keep them all and mark
  // them, so the honest "nothing I have fits" path fires instead.
  /*
   * Asking to go abroad is a filter, the same kind as having been somewhere
   * already. She said "i wanna go abroad" to a Utah pitch and was told it
   * didn't settle anything, then shown Utah again. It settles three of the
   * fifteen.
   *
   * A destination we researched at runtime has no country on file, and not
   * knowing is not grounds for exclusion: only a confident domestic match is
   * filtered, or asking to leave the country would quietly delete every place
   * we went and looked up for her.
   */
  /*
   * And the parts of the world she ruled out.
   *
   * This file contained no occurrence of the word "avoid" until now. Every
   * refusal she has ever typed — a region, a climate — was parsed (badly, but
   * parsed) and then read by nobody who chooses where to send her. "Don't
   * want south east asia" ended with Bali at high confidence, and the only
   * reason that is not the worst possible outcome is that the parser managed
   * something worse first and set her shortlist TO Southeast Asia.
   *
   * A refusal is the same kind of filter as having already been somewhere,
   * and the comment eight lines above says why: ignoring it is the clearest
   * way to prove nobody was listening. So it goes in the same set, and it is
   * out rather than penalised. Membership comes from the map, so it covers
   * the sixty-seven researched destinations that appear in no hand-written
   * region list.
   */
  for (const regionId of brief.avoidRegions ?? []) {
    for (const id of membersOf(regionId)) banned.add(id);
  }
  for (const climate of brief.avoidClimate ?? []) {
    for (const d of DESTINATIONS) if (ruledOutByClimate(d, climate)) banned.add(d.id);
  }

  const open = DESTINATIONS.filter((d) => !banned.has(d.id))
    .filter((d) => !brief.wantsInternational || !isDomestic(d.id, brief.origin));
  // Everything we hold is either somewhere they've been or in their own
  // country. Keep the full list and let the honest "nothing fits" path fire
  // rather than returning nothing and crashing the caller.
  const beenEverywhere = open.length === 0;

  return (beenEverywhere ? DESTINATIONS : open).map((d, i) => {
    const parts = {
      vibe: vibeScore(d, brief.vibes, profile?.vibeLeanings),
      budget: budgetScore(d, brief, days),
      // Fitting the requested pace is table stakes; also being able to go
      // genuinely slow is what separates two otherwise-equal destinations
      // when someone has asked for rest.
      pace: (d.paceFit.includes(pace) ? 0.85 : 0.35)
        + (brief.vibes.includes("relaxation") && d.paceFit.includes("relaxed") ? 0.15 : 0),
      duration: days >= d.minDays ? 1 : 0.25,
      depth: dataDepth(d, days),
      distinct: distinctiveness(d, brief.vibes),
    };
    let excluded: string | undefined;
    // Strict, not 80%. The soft gate let Japan through at 7 days — the exact
    // length its own caveat says is too short — while its data depth ruled it
    // out at every length it actually recommends. Offering a trip you've
    // already told the traveller not to take is worse than offering nothing.
    if (days < d.minDays) excluded = `needs at least ${d.minDays} days to be worth the flight`;
    /*
     * And enough in it to fill the days at the pace she asked for. This was
     * `parts.depth < 0.45`, which is 1.17 places a day against a planner
     * scheduling four and a scorecard measuring four; the gap came out as
     * blank afternoons filed as downtime, and southwest scored 26% on pace
     * adherence without anything on the way in saying so.
     */
    if (tooThinFor(d, brief, days)) excluded = thinReason(d, brief, days);
    if (brief.budgetUsd !== undefined && roughCost(d, days, brief.origin) > brief.budgetUsd * 1.35) {
      excluded = "comes in over your budget by more than I can design around";
    }
    const score =
      parts.vibe * W.vibe + parts.budget * W.budget + parts.pace * W.pace
      + parts.duration * W.duration + parts.depth * W.depth + parts.distinct * W.distinct
      // A stable, tiny nudge so identical scores still produce a decision
      // rather than a coin flip the traveller has to resolve.
      + i * 1e-4;
    // A climate request is a gate, not a preference. Somewhere cold is simply
    // the wrong answer to "I want to lie on a beach", however well it scores
    // on everything else.
    let adj = brief.wantsWarm ? score * (0.5 + 0.5 * (d.warmth / 5)) : score;
    // Distance as a proxy for "unlike home". Airfare is a decent stand-in and
    // needs no extra field: a $190 hop is not what they meant.
    if (brief.wantsFar) adj *= 0.7 + 0.3 * Math.min(1, flightFor(d, brief.origin) / 800);
    // They've told us the last one was too far. Same proxy, other direction.
    if (brief.wantsNear) adj *= 1.05 - 0.45 * Math.min(1, flightFor(d, brief.origin) / 900);
    // "Road trip" describes the shape of the trip, not the country. Favour
    // places with more than one base to drive between.
    if (brief.roadTrip) {
      const bases = CITIES.filter((c) => c.destinationId === d.id && !c.dayTripOnly).length;
      const driving = CITIES.some((c) => c.destinationId === d.id && c.scale === "driving");
      adj *= 1 + (bases >= 2 ? 0.06 : -0.05) + (driving ? 0.05 : 0);
    }
    // What it has already shown this person, and what they turned down.
    if (profile) adj *= novelty(d.id, profile);
    if (beenEverywhere) excluded = "is somewhere you've told me you've already been";
    return { id: d.id, score: excluded ? adj * 0.35 : adj, parts, excluded };
  }).sort((a, b) => b.score - a.score);
}

export function recommend(brief: Brief, profile?: TravelerProfile): Recommendation {
  // A region is a hard filter. Someone asking about Europe does not want the
  // best-scoring destination on earth, they want the best one in Europe.
  const inRegion = (brief.regionIds ?? []).filter((id) => DESTINATIONS.some((d) => d.id === id));
  if (inRegion.length && !brief.namedDestination) {
    const scored = scoreDestinations(brief, profile).filter((s) => inRegion.includes(s.id));
    if (scored.length) {
      const [top, second] = scored;
      const gap = top.score - (second?.score ?? 0);
      // Narrowing to a region does not make a thin catalogue thick. If the
      // best thing in Europe still can't carry her fortnight, that is the
      // answer, and the open-field branch below already says so out loud.
      if (top.excluded) {
        return {
          destinationId: top.id,
          confidence: "low",
          noGoodFit: top.excluded,
          alternativeId: second?.id,
          scores: scored.map((s) => ({ id: s.id, score: s.score })),
        };
      }
      return {
        destinationId: top.id,
        confidence: gap > 0.03 || scored.length === 1 ? "high" : "medium",
        alternativeId: gap > 0.03 ? undefined : second?.id,
        scores: scored.map((s) => ({ id: s.id, score: s.score })),
      };
    }
  }

  // A shortlist is a decision to make, not a first match to keep. "Croatia or
  // southern France" means compare the two and say why, which is exactly the
  // case section 7 describes.
  const shortlist = (brief.candidates ?? []).filter((id) => DESTINATIONS.some((d) => d.id === id));
  // A named destination outranks a shortlist she has already narrowed. The
  // region branch above guards on this and the shortlist branch did not, so
  // "let's do Italy" could still be answered with France.
  if (shortlist.length > 1 && !brief.namedDestination) {
    const scored = scoreDestinations(brief, profile).filter((s) => shortlist.includes(s.id));
    // Every place on their own shortlist is one they've already been to, which
    // happens the moment someone lists where they've travelled. Fall through
    // to the open field rather than indexing into nothing.
    if (scored.length) {
    const [top, second] = scored;
    // Her own shortlist, and neither one has the days in it. Picking the least
    // thin of two thin answers and calling it a decision is the degraded mode.
    if (top.excluded) {
      return {
        destinationId: top.id,
        confidence: "low",
        noGoodFit: top.excluded,
        alternativeId: second?.id,
        scores: scored.map((s) => ({ id: s.id, score: s.score })),
      };
    }
    return {
      destinationId: top.id,
      // Between two places they chose themselves, saying which and why is the
      // job. Handing the choice back is the one useless answer.
      confidence: "high",
      alternativeId: second?.id,
      scores: scored.map((s) => ({ id: s.id, score: s.score })),
    };
    }
  }

  /*
   * An explicitly named destination is a decision, not a suggestion.
   *
   * Unless she has since turned it down. Saying no used to be implemented by
   * deleting `namedDestination`, which threw away something she told us in
   * order to record something else she told us. Both are facts; the newer one
   * wins. So the name stays on the brief and the rejection is read here.
   */
  if (brief.namedDestination && !(brief.visitedIds ?? []).includes(brief.namedDestination)
      && !(profile?.visitedDestinationIds ?? []).includes(brief.namedDestination)
      && !(profile?.rejectedDestinationIds ?? []).includes(brief.namedDestination)) {
    const scores = scoreDestinations(brief, profile);
    /*
     * A decision is not a licence to plan a trip that isn't there.
     *
     * Naming a place skips every gate scoreDestinations applies, which is
     * right for taste and wrong for arithmetic: she said "let's do the
     * southwest, ten days", we hold twenty-four places across two parks, and
     * the planner filled the difference with empty afternoons and called them
     * downtime. Pace adherence read 26% and nothing on the way in said a word.
     *
     * So the thinness gate is re-applied here, and it refuses out loud.
     * "No degraded mode at all - just stop."
     *
     * The length has to be one SHE chose. With no days on the brief we plan
     * against seven, and refusing a country on a number this app invented is
     * the Faroe Islands failure again — so an unstated length only refuses
     * when the catalogue is under the floor at which there is no trip here at
     * any pace, which is a much lower bar and is not a number we made up.
     */
    const days = effectiveDays(brief);
    const named = isKnownDestination(brief.namedDestination)
      ? destinationById(brief.namedDestination) : undefined;
    if (named && tooThinFor(named, brief, days)) {
      return {
        destinationId: named.id,
        confidence: "low",
        noGoodFit: thinReason(named, brief, days),
        scores: scores.map((s) => ({ id: s.id, score: s.score })),
      };
    }
    return {
      destinationId: brief.namedDestination,
      confidence: "high",
      scores: scores.map((s) => ({ id: s.id, score: s.score })),
    };
  }

  const all = scoreDestinations(brief, profile);
  // A score of zero means banned outright, not merely unlikely.
  const scored = all.some((s) => s.score > 0) ? all.filter((s) => s.score > 0) : all;
  const [top, second] = scored;

  // Every option was ruled out — too short, too thin, or too expensive. Say so
  // rather than quietly recommending something we already rejected.
  if (top.excluded) {
    return {
      destinationId: top.id,
      confidence: "low",
      noGoodFit: top.excluded,
      alternativeId: second?.id,
      scores: scored.map((s) => ({ id: s.id, score: s.score })),
    };
  }
  // "Surprise me" among near-ties. The top four sat within 0.6% of each other
  // and the stable index nudge handed the win to the same destination every
  // time, for every traveller. Ties get broken by the traveller's own seed
  // instead of by catalogue order. No seed (server, evals) means no change.
  if (brief.surpriseMe && profile?.seed !== undefined) {
    const live = scored.filter((s) => !s.excluded);
    const band = live.filter((s) => s.score >= live[0].score * 0.98);
    if (band.length > 1) {
      const pick = band[(profile.seed + (profile.seenDestinationIds?.length ?? 0)) % band.length];
      const rest = scored.filter((s) => s.id !== pick.id);
      return {
        destinationId: pick.id,
        confidence: "high",
        scores: [pick, ...rest].map((s) => ({ id: s.id, score: s.score })),
      };
    }
  }

  const gap = top.score - (second?.score ?? 0);
  // Recalibrated after the distinctiveness term compressed the spread: the
  // scores now cluster tightly, so the old 0.05 gate asked "which do you
  // prefer?" on half of all briefs. This product exists to decide. A slightly
  // wrong confident pick costs far less than an interrogation, because the
  // pitch explains itself and the whole itinerary is editable — so the bar for
  // asking is a genuine coin flip, not merely a close call.
  let confidence: Confidence = gap > 0.03 ? "high" : gap > 0.012 ? "medium" : "low";

  // "Surprise me" is a promise to choose. Handing back a question is the one
  // answer that fails the request outright, however close the scores are.
  if (brief.surpriseMe || brief.vibes.length === 0) confidence = "high";

  // It can clear every gate on price and dates and still have almost none of
  // what they came for. Better to name that than to let them find out on day two.
  const cities = CITIES.filter((c) => c.destinationId === top.id).map((c) => c.id);
  const fit = contentFit(cities, brief, profile ?? emptyProfile());
  const weakFor = brief.vibes.length && fit < 0.25
    ? brief.vibes.join(" and ")
    : undefined;

  return {
    destinationId: top.id,
    confidence,
    weakFor,
    alternativeId: confidence === "high" ? undefined : second?.id,
    scores: scored.map((s) => ({ id: s.id, score: s.score })),
  };
}

/**
 * Section 7: when the agent isn't sure, it says so and asks ONE question that
 * actually resolves the ambiguity — rather than presenting a list.
 */
export function tiebreakPrompt(rec: Recommendation): string | null {
  if (rec.confidence === "high" || !rec.alternativeId) return null;
  const a = destinationById(rec.destinationId);
  const b = destinationById(rec.alternativeId);
  // Two whole sentences rather than a spliced one — the previous version
  // joined two pitches with a dash and produced a sentence with no verb.
  return [
    `I'm between ${a.name} and ${b.name}.`,
    `${a.name}: ${a.pitch}`,
    `${b.name}: ${b.pitch}`,
    `Which direction sounds more like you?`,
  ].join(" ");
}
