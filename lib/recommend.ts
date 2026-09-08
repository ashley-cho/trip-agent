import { flightUsdFrom, type Origin } from "@/lib/origin";
import { isDomestic } from "@/lib/abroad";
import type { Brief, Confidence, Destination, TravelerProfile, Vibe } from "@/lib/types";
import { ALL_VIBES } from "@/lib/types";
import { CITIES, DESTINATIONS, cityById, destinationById } from "@/data/destinations";
import { PLACES } from "@/data";
import { contentFit } from "@/lib/select";
import { emptyProfile } from "@/lib/types";
import { effectiveDays, inferPace } from "@/lib/discovery";
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
 * How well the seeded data can actually sustain a trip of this length here.
 * Recommending a destination we then plan blank days for is worse than not
 * recommending it. Replaced by a real content check once data is live.
 */
export function dataDepth(d: Destination, days: number): number {
  const count = PLACES.filter((p) => !p.skip)
    .filter((p) => CITIES.some((c) => c.id === p.cityId && c.destinationId === d.id)).length;
  return Math.max(0, Math.min(1, count / (days * 2.6)));
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
    if (parts.depth < 0.45) excluded = `doesn't have enough in it to fill ${days} days well`;
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
