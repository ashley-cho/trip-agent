/**
 * What is this conversation about, and has anyone actually gone and looked?
 *
 * Written after "i want to go to hokkaido for 10 days. food, onsen and
 * driving." came back as "Go to Portugal instead." Hokkaido was never
 * researched and never failed. The rules parser matched "onsen" in its
 * interest table, decided that meant Japan, and set unknownAcknowledged —
 * a flag whose documented meaning is "we tried and told her". Nobody had
 * tried. The model got it right and its answer was overruled by a regex.
 *
 * The bug was possible because the most consequential branch in the product —
 * do we go and look this up, or do we pitch something else? — was an inline
 * condition in a React event handler:
 *
 *     if (toResearch.length && !b.unknownAcknowledged)
 *
 * No test could reach it, so no test caught it, and the guard that was
 * supposed to stop a substitution lived INSIDE the branch that got skipped.
 *
 * So the decision lives here now, as a pure function over the brief, and it
 * asks a question that cannot be poisoned by a driver that never did any
 * work: which subjects have we not yet attempted? Attempted is recorded when
 * an attempt happens, not when a parser feels confident.
 */
import type { Brief } from "@/lib/types";
import { isKnownDestination } from "@/data/destinations";
import { isDomestic } from "@/lib/abroad";

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Everywhere she named that we do not hold data for, plus a region we hold
 * nothing inside.
 *
 * Reading only `unknownCandidates` was the second hole in the same area: the
 * rules parser files a single named place as `unknownDestination` and nothing
 * else, so a one-place message — the most common message there is — produced
 * an empty research list and fell straight through to the recommender.
 */
export function subjects(b: Brief): string[] {
  const named = [...(b.unknownCandidates ?? [])];
  const region = b.region && !(b.regionIds ?? []).length
    ? [b.regionLabel ?? b.region]
    : [];
  return [...named, ...region]
    .map((s) => s.trim())
    .filter(Boolean)
    // A place we already hold is not a research subject; it is a destination.
    .filter((s) => !isKnownDestination(norm(s)))
    .filter((s, i, a) => a.findIndex((x) => norm(x) === norm(s)) === i);
}

/**
 * Every place she has named, whether or not we hold data for it.
 *
 * subjects() filters out places already in the catalogue, which is right for
 * "what do we need to research" and catastrophic for "what is this
 * conversation about". She said "hm i wanna go to patagonia" with a Patagonia
 * pack already remembered from an earlier session, so isKnownDestination was
 * true, subjects() came back empty, the gate before the recommender had
 * nothing to defend, and she was pitched Utah. The better we know a place, the
 * more completely it disappeared.
 */
export function statedPlaces(b: Brief): string[] {
  const named = [...(b.unknownCandidates ?? [])];
  const region = b.region && !(b.regionIds ?? []).length
    ? [b.regionLabel ?? b.region]
    : [];
  return [...named, ...region]
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, i, a) => a.findIndex((x) => norm(x) === norm(s)) === i);
}

/**
 * Places she named that we already hold. These are not research subjects and
 * they are not gaps: they are the answer, and they belong on the brief as
 * namedDestination rather than sitting in an "unknown" field forever.
 */
export function heldPlaces(b: Brief): string[] {
  return statedPlaces(b).filter((s) => isKnownDestination(norm(s)));
}

/**
 * Does this brief pin somewhere, by any route?
 *
 * Her rule, in her words: "it must stay faithful to the user's input. that
 * tops everything." When this is false there is nothing of hers to be
 * faithful TO, and ranking the catalogue on seven internal tags is not an
 * answer, it is an invention wearing a confidence score. "hike a national
 * park", "scuba dive coral reefs" and "safari" all score identically, so the
 * ranking cannot be reflecting anything she said.
 */
export function namesSomewhere(b: Brief): boolean {
  return Boolean(
    b.namedDestination || b.focusCityId
    || (b.candidates?.length) || (b.regionIds?.length)
    || statedPlaces(b).length,
  );
}

/**
 * The subjects we have not yet had a go at.
 *
 * Two calls a turn is the ceiling: four research calls outlive the patience
 * of anyone watching a spinner, and running out of budget between the second
 * and the third means she reads a paragraph about somewhere she is then not
 * sent.
 */
export function toResearch(b: Brief): string[] {
  const tried = new Set((b.researchTried ?? []).map(norm));
  return subjects(b).filter((s) => !tried.has(norm(s))).slice(0, 2);
}

/**
 * Is there a place on the table that we have neither looked up nor admitted
 * we couldn't look up?
 *
 * This is the invariant behind her rule — "if you're on a convo about one
 * specific region or country, you should not search elsewhere, period." If
 * this is true, pitching anywhere else is a bug, whatever the flags say.
 */
export function unsettledSubject(b: Brief): string | undefined {
  const tried = new Set((b.researchTried ?? []).map(norm));
  return subjects(b).find((s) => !tried.has(norm(s)));
}

/**
 * A subject that was attempted and did not come together. She has been told,
 * or is about to be. Either way we do not wander off to a different country.
 */
export function failedSubject(b: Brief): string | undefined {
  const tried = new Set((b.researchTried ?? []).map(norm));
  return subjects(b).find((s) => tried.has(norm(s)));
}

/**
 * Does the destination we already pitched still stand?
 *
 * Extracted from an inline expression in the React handler, because it made
 * a decision nothing could test and it was wrong. A pitch is pinned so that
 * ordinary conversation ("make it five days") can't drift the recommendation
 * onto the runner-up. But the pin was also read after a REJECTION, which
 * clears `namedDestination` precisely so the next pass is free to choose
 * again. The pin then filled the hole it had just made, handed back the
 * rejected destination, and because a pitch is only spoken when the
 * destination CHANGES, handed it back in silence.
 *
 * So rejecting has to clear the pin, and this function only answers the
 * narrower question it was written for.
 */
export function pinnedDestination(
  pitched: string | null | undefined,
  b: Brief,
  profile?: { rejectedDestinationIds?: string[] },
): string | undefined {
  if (!pitched) return undefined;
  if (b.namedDestination && b.namedDestination !== pitched) return undefined;
  /*
   * Turning it down is not a decision to keep it.
   *
   * Rejecting clears `namedDestination` so the next pass is free to choose
   * again, and the pin was read exactly when that field was empty, so it
   * filled the hole the rejection had just made. Reading the rejection
   * itself is the fix that does not depend on a ref being cleared in the
   * right order somewhere else.
   */
  if ((profile?.rejectedDestinationIds ?? []).includes(pitched)) return undefined;
  /*
   * A constraint she states after the pitch outranks the pitch.
   *
   * The pin exists so ordinary conversation can't drift the recommendation
   * onto the runner-up. It was never meant to survive her ruling the pitched
   * destination out: "i wanna go abroad" on a Utah pitch kept Utah, because
   * the pin is read before anything looks at what she just said.
   */
  if (b.wantsInternational && isDomestic(pitched, b.origin)) return undefined;
  return pitched;
}
