import { activityWords } from "@/lib/select";
import type { Brief } from "@/lib/types";
import type { BriefPatch } from "@/lib/agent/types";

/**
 * Her words, kept.
 *
 * `interestEcho` is the traveller's own phrasing of what the trip is FOR, and
 * it used to be last-write-wins. So:
 *
 *   "i wanna go see the northern lights in canad"   -> "northern lights"
 *   "Mix in a city or two as well"                  -> "nature and city"
 *
 * and the aurora was gone. The research was then aimed at nature and city, it
 * came back with Vancouver and Whistler, and the finished trip said in its own
 * copy: don't come expecting northern lights over Whistler village. She never
 * withdrew the northern lights. The second sentence added to the first.
 *
 * So the echo accumulates. A clause that repeats something already there is
 * dropped, and a newer clause that says everything an older one did replaces
 * it rather than sitting beside it. Nothing she said is thrown away.
 */
/**
 * One entry per thing she wants to do, in her words, never shortened.
 *
 * This was mergeEcho, which accumulated prose into one "; "-joined string and
 * capped it at 240 characters by dropping from the middle. It existed because
 * a later message used to overwrite an earlier one and lose the northern
 * lights. A list does that job without the truncation: nothing has to be
 * dropped to make room.
 */
function mergeActivities(had?: string[], said?: string[]): string[] | undefined {
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  /*
   * Containment on whole words only.
   *
   * A bare substring test merged "thing number 1" into "thing number 10", and
   * would merge "hike" into "hiked out of there" or "porto" into "portofino".
   * Padding both sides makes the test "is this phrase, entire, inside that
   * one", which is what "a fuller wording of the same thing" actually means.
   */
  const within = (outer: string, inner: string) => ` ${outer} `.includes(` ${inner} `);
  const out = [...(had ?? [])];
  for (const raw of said ?? []) {
    const t = raw.trim().replace(/[.;\s]+$/, "");
    if (!t) continue;
    const k = key(t);
    const at = out.findIndex((x) => key(x) === k || within(key(x), k) || within(k, key(x)));
    // A fuller wording of something she already said replaces the thinner one.
    if (at === -1) out.push(t);
    else if (t.length > out[at].length) out[at] = t;
  }
  return out.length ? out : undefined;
}

/** Merge a patch into a brief. Additive for lists; last-write-wins for scalars. */
export function applyPatch(brief: Brief, patch: BriefPatch): Brief {
  return {
    ...brief,
    days: patch.days ?? (patch.flexibleDuration ? undefined : brief.days),
    // A restated length replaces the old range rather than keeping it: "1-2
    // weeks" then "actually 9 days" is not a nine-day trip with a fortnight
    // still attached to it.
    daysRange: patch.days !== undefined
      ? patch.daysRange
      : (patch.flexibleDuration ? undefined : brief.daysRange),
    flexibleDuration: patch.days !== undefined ? false : (patch.flexibleDuration ?? brief.flexibleDuration),
    // Additive, because the model's patch carries only what it just heard and
    // must not wipe what was said three turns ago. Removal therefore needs to
    // be explicit: a shorter patch.vibes list was silently unioned back to the
    // same set, so "actually, not museums" changed nothing.
    vibes: subtract(
      patch.vibes ? [...new Set([...brief.vibes, ...patch.vibes])] : brief.vibes,
      patch.removeVibes,
    ),
    pace: patch.pace ?? brief.pace,
    budgetUsd: patch.budgetUsd ?? (patch.flexibleBudget ? undefined : brief.budgetUsd),
    flexibleBudget: patch.budgetUsd !== undefined ? false : (patch.flexibleBudget ?? brief.flexibleBudget),
    budgetInferred: patch.budgetUsd !== undefined ? patch.budgetInferred : brief.budgetInferred,
    constraints: patch.constraints
      ? [...new Set([...brief.constraints, ...patch.constraints])]
      : brief.constraints,
    avoidTags: patch.avoidTags
      ? [...new Set([...brief.avoidTags, ...patch.avoidTags])]
      : brief.avoidTags,
    surpriseMe: patch.surpriseMe ?? brief.surpriseMe,
    wantsWarm: patch.wantsWarm ?? brief.wantsWarm,
    wantsFar: patch.wantsFar ?? brief.wantsFar,
    wantsNear: patch.wantsNear ?? brief.wantsNear,
    namedDestination: patch.namedDestination ?? brief.namedDestination,
    // Naming a different place clears an old city focus; naming the same one
    // again keeps it. Otherwise "make it five days" on an Oaxaca trip would
    // quietly reopen the whole of Mexico.
    focusCityId: patch.namedDestination && patch.namedDestination !== brief.namedDestination
      ? patch.focusCityId
      : (patch.focusCityId ?? brief.focusCityId),
    /*
     * Naming a destination replaces every other answer to "where".
     *
     * Only `unknownDestination` used to be cleared here, and the rest of the
     * where-group merged with `??`, which cannot express "forget this". Two
     * consequences, both live:
     *
     * One: after "Hokkaido didn't come together, name somewhere else if you'd
     * rather", saying "Portugal then" left hokkaido in unknownCandidates
     * forever. The guard that stops substitutions reads that list, so it
     * refused every subsequent message, repeating an offer to switch that it
     * was itself refusing to honour. She could not get out of the
     * conversation.
     *
     * Two: "Italy or France" files both as candidates; "let's do Italy" then
     * hit the shortlist branch of the recommender, which scores the list and
     * can return France, confidently. She picks one of her own two options
     * and gets the other.
     *
     * validatePatch already tried to clear these and its assignments were
     * being silently swallowed by the `??` on the way through.
     */
    unknownAcknowledged: patch.unknownAcknowledged ?? brief.unknownAcknowledged,
    // Only ever grows. Having tried is a fact about the past.
    researchTried: union(brief.researchTried, patch.researchTried),
    // Ruling somewhere out is a fact about her, not a mood. Only grows.
    avoidPlaces: union(brief.avoidPlaces, patch.avoidPlaces),
    // Ruling somewhere out is cumulative and never withdrawn by a later
    // sentence that doesn't mention it, same as avoidPlaces.
    avoidRegions: union(brief.avoidRegions, patch.avoidRegions),
    avoidClimate: union(brief.avoidClimate, patch.avoidClimate) as Brief["avoidClimate"],
    /*
     * A band narrows, never widens: a later "not too busy" tightens the
     * ceiling and must not raise a floor she set earlier.
     */
    crowds: patch.crowds || brief.crowds
      ? {
          min: Math.max(brief.crowds?.min ?? 1, patch.crowds?.min ?? 1),
          max: Math.min(brief.crowds?.max ?? 5, patch.crowds?.max ?? 5),
        }
      : undefined,
    /*
     * Never replaced, never filtered, never cleared.
     *
     * Every other field on this object is derived and may legitimately change.
     * This one is the record of what she actually entered, and a patch has no
     * business shortening it. Written only by stating().
     */
    stated: brief.stated ?? [],
    candidates: patch.namedDestination
      ? patch.candidates
      : (patch.candidates ?? brief.candidates),
    /*
     * Union, not replace.
     *
     * "i want to go to the azores" then "we love hiking and volcanoes"
     * overwrote ["azores"] with the second message's parse and the Azores
     * ceased to exist. Nothing she said leaves the session, so a later message
     * adds to this list; only resolving it (namedDestination) or the flow
     * clearing it deliberately empties it.
     */
    unknownCandidates: patch.namedDestination
      ? patch.unknownCandidates
      : patch.unknownCandidates
        ? union(brief.unknownCandidates, patch.unknownCandidates)
        : brief.unknownCandidates,
    region: patch.region ?? brief.region,
    regionLabel: patch.regionLabel ?? brief.regionLabel,
    regionIds: patch.namedDestination ? patch.regionIds : (patch.regionIds ?? brief.regionIds),
    roadTrip: patch.roadTrip ?? brief.roadTrip,
    wantsInternational: patch.wantsInternational ?? brief.wantsInternational,
    activities: mergeActivities(brief.activities, patch.activities),
    /*
     * Same merge as activities, and for the same reason: a later message adds
     * to what she has already said and a fuller wording replaces a thinner
     * one. Nothing removes.
     */
    asides: mergeActivities(brief.asides, patch.asides),
    // A place you have been is permanent, so these only ever grow.
    visitedIds: union(brief.visitedIds, patch.visitedIds),
    visitedNames: union(brief.visitedNames, patch.visitedNames),
    origin: patch.origin ?? brief.origin,
    dates: patch.dates ?? brief.dates,
    anchorDate: patch.anchorDate ?? brief.anchorDate,
    anchorEvent: patch.anchorEvent ?? brief.anchorEvent,
    month: patch.month ?? brief.month,
  };
}

const subtract = <T,>(list: T[], remove?: T[]) =>
  remove?.length ? list.filter((v) => !remove.includes(v)) : list;

/** Merge two optional lists into one with no repeats, or leave it unset. */
function union(a?: string[], b?: string[]): string[] | undefined {
  if (!a?.length && !b?.length) return a ?? b;
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

/**
 * What this traveller actually asked for, in one line, for a model that has
 * never seen the brief object.
 *
 * Researching a country without this produces the country's default tourist
 * route. "I wanna go to china for hiking" came back as Beijing, Xi'an and
 * Shanghai: the guidebook index, with no hiking anywhere in it. The interest
 * is not a garnish on the destination, it decides which part of the country
 * the destination even is.
 */
export function interestLine(brief: Brief): string {
  const parts: string[] = [];
  // Their own words first. A paraphrase of a paraphrase loses the thing that
  // made it specific.
  if (brief.activities?.length) parts.push(brief.activities.join("; "));
  if (brief.vibes.length) parts.push(`interested in ${brief.vibes.join(", ")}`);
  if (brief.avoidTags?.length) parts.push(`avoid ${brief.avoidTags.join(", ")}`);
  if (brief.visitedNames?.length) parts.push(`already been to ${brief.visitedNames.join(", ")}`);
  if (brief.budgetUsd) parts.push(`about $${brief.budgetUsd} all in`);
  if (brief.roadTrip) parts.push("wants to drive it");
  if (brief.wantsWarm) parts.push("wants warmth");
  return parts.join("; ");
}

/**
 * The entries in `activities` that are safe to quote back at her.
 *
 * `activities` is open vocabulary and it is filled from three places: her own
 * words, a rules parser, and the model, which is asked for "their own words"
 * and given no way to be held to it. Nothing checked. So "You said <that>"
 * could print a model paraphrase, and the reason bank could license "you asked
 * for X" off a word she never used — the one line whose whole job is to prove
 * we listened.
 *
 * Everything stays on the brief: dropping an entry would lose a request, which
 * is the worse failure. This only decides what may be attributed to her, and
 * the test is the plainest one there is — every word of it has to be a word
 * she typed.
 */
export function quotable(b: Brief): string[] {
  const typed = new Set([
    ...activityWords(b.opening ?? ""),
    ...(b.stated ?? []).filter((x) => x.how === "typed").flatMap((x) => activityWords(x.text)),
  ]);
  return (b.activities ?? []).filter((a) => {
    const words = activityWords(a);
    return words.length > 0 && words.every((w) => typed.has(w));
  });
}
