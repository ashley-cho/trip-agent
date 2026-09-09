import type { Place } from "@/lib/types";
import { toMin } from "@/lib/geo";

/**
 * Is this place open for the whole block, on this weekday?
 *
 * One copy, because there were two and they disagreed the moment either was
 * fixed. The planner and the critic each had their own version of
 * `end > toMin(p.closes)`, and toMin("02:00") is 120, so a place closing after
 * midnight was shut at every minute of every day. Twelve hand-written venues
 * were unschedulable: Golden Gai, Fado at Tasca do Chico, the Euljiro drinking
 * alleys, jazz in Copenhagen, a taco crawl. Zero appearances across 3,600
 * trips, in a product that ships a "city energy" brief.
 *
 * Fixing only the planner made it worse than leaving it alone: the planner
 * scheduled them and the critic then reported every one as a violation, which
 * took schedule validity from 100% to 76%. Two implementations of one rule is
 * the bug; this is the rule.
 */
export function closingMinute(p: { opens?: string; closes?: string }): number | undefined {
  if (!p.closes) return undefined;
  const opensAt = p.opens ? toMin(p.opens) : 0;
  const closesAt = toMin(p.closes);
  // A closing time at or before opening is the next day, not the same morning.
  return closesAt <= opensAt ? closesAt + 1440 : closesAt;
}

export function isOpenFor(p: Place, startMin: number, weekday: number): boolean {
  if (p.closedDays?.includes(weekday)) return false;
  if (p.opens && startMin < toMin(p.opens)) return false;
  const closing = closingMinute(p);
  if (closing !== undefined && startMin + p.durationMin > closing) return false;
  return true;
}

/**
 * The other half of "is this place placeable here": the part of the day.
 *
 * The planner refuses an evening-only place before 15:00 as a rule rather than
 * a score — "a place called 'at sunset' has no business at half past eleven" —
 * and the edit path had no such rule anywhere. So a swap put a sunset wall walk
 * into a 10:11 slot, and "more food" put a brewpub and a sherry bodega into
 * noon slots the planner would have refused. The critic has no check for it,
 * so nothing downstream noticed either.
 *
 * Lives here beside isOpenFor for the same reason that one does: it was held
 * in one place and applied in one place, and the other callers quietly
 * disagreed.
 */
export const EVENING_FROM_MIN = 900;

export function fitsTimeOfDay(p: { bestTime?: string; opens?: string }, startMin: number): boolean {
  if (p.bestTime !== "evening" || startMin >= EVENING_FROM_MIN) return true;
  /*
   * "Evening" means two different things in the catalogue, and reading them
   * the same way costs real trips.
   *
   * A sunset viewpoint or a river park carries no hours at all: there is
   * nothing to be open, and the flag is the only thing saying when to go. That
   * one is a rule.
   *
   * A thermal lagoon open 09:00-22:00 also carries the flag, meaning "nicest
   * after dark" — and reading that as a refusal took "i also want a spa day"
   * from adding one to adding nothing, and stopped "more food" from ever
   * reaching a bodega that opens at noon. Where the place states daytime hours,
   * isOpenFor already answers the question honestly and the flag goes back to
   * being what it says it is: a preference.
   */
  return !!p.opens && toMin(p.opens) < EVENING_FROM_MIN;
}
