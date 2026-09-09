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
