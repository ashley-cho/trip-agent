import type { Brief, ItineraryDay, TravelerProfile, Trip } from "@/lib/types";
import { PACE_ACTIVITIES } from "@/lib/types";
import { placeById } from "@/data";
import { cityById } from "@/data/destinations";
import { isRuledOut } from "@/lib/planner";
import { inferPace } from "@/lib/discovery";
import { avoidedTags } from "@/lib/select";
import { haversineKm, toMin, travelMinutes } from "@/lib/geo";
import { closingMinute } from "@/lib/hours";

export type Severity = "error" | "warn";

export interface Issue {
  code:
    | "overlap" | "closed_venue" | "pace" | "no_downtime" | "geography"
    | "over_budget" | "avoid_violation" | "monotony" | "unreasonable_hours";
  severity: Severity;
  day?: number;
  itemId?: string;
  message: string;
}

/**
 * Section 32. This runs on structured data after every plan and every edit,
 * and its output is both a UI signal and an eval metric. Nothing here depends
 * on a language model — that is deliberate.
 */
export function critique(trip: Trip, brief: Brief, profile: TravelerProfile): Issue[] {
  const issues: Issue[] = [];
  const pace = inferPace(brief);
  const target = PACE_ACTIVITIES[pace];
  const avoid = avoidedTags(brief, profile);
  const rejected = new Set(profile.rejectedPlaceIds);

  for (const day of trip.days) {
    const weekday = new Date(day.date + "T00:00:00Z").getUTCDay();

    // 1 & 2: timing and opening hours
    for (let i = 0; i < day.items.length; i++) {
      const it = day.items[i];
      const end = toMin(it.start) + it.durationMin;

      if (it.placeId) {
        const p = placeById(it.placeId);
        if (p) {
          if (p.closedDays?.includes(weekday)) {
            issues.push({ code: "closed_venue", severity: "error", day: day.index, itemId: it.id,
              message: `${p.name} is closed on ${DAY_NAMES[weekday]}.` });
          } else if (p.opens && toMin(it.start) < toMin(p.opens)) {
            issues.push({ code: "closed_venue", severity: "error", day: day.index, itemId: it.id,
              message: `${p.name} doesn't open until ${p.opens}.` });
          } else if (closingMinute(p) !== undefined && end > closingMinute(p)!) {
            issues.push({ code: "closed_venue", severity: "error", day: day.index, itemId: it.id,
              message: `${p.name} closes at ${p.closes}, before this block ends.` });
          }
          if (p.tags.some((t) => avoid.has(t))) {
            issues.push({ code: "avoid_violation", severity: "error", day: day.index, itemId: it.id,
              message: `${p.name} matches something you asked to avoid.` });
          }
          if (rejected.has(p.id)) {
            issues.push({ code: "avoid_violation", severity: "error", day: day.index, itemId: it.id,
              message: `${p.name} was already removed once.` });
          }
        }
      }

      const next = day.items[i + 1];
      if (next) {
        const hop = it.lat != null && next.lat != null
          ? travelMinutes({ lat: it.lat, lng: it.lng! }, { lat: next.lat, lng: next.lng! })
          : 0;
        // A transit item already accounts for the movement on one side of it,
        // so don't charge for the hop twice.
        const spent = it.type === "transit" || next.type === "transit";
        const needed = end + (spent ? 0 : hop);
        if (toMin(next.start) < needed) {
          issues.push({ code: "overlap", severity: "error", day: day.index, itemId: next.id,
            message: `${next.name} starts at ${next.start} but you can't be there before ${fmt(needed)}.` });
        }
      }
    }

    // 3: pace
    const acts = day.items.filter((i) => i.type === "activity").length;
    const isEdge = day.index === 1 || day.index === trip.days.length;
    if (!isEdge && acts > target + 1) {
      issues.push({ code: "pace", severity: "warn", day: day.index,
        message: `${acts} activities on day ${day.index} against a target of ${target} for a ${pace} pace.` });
    }

    // 4: downtime is a feature
    const restMin = day.items.filter((i) => i.type === "downtime").reduce((s, i) => s + i.durationMin, 0);
    if (!isEdge && day.items.length > 3 && restMin < 60 && pace !== "busy") {
      issues.push({ code: "no_downtime", severity: "warn", day: day.index,
        message: `Day ${day.index} has no real unscheduled block.` });
    }

    // 5: geography. A day trip by car or fast train is *supposed* to cover
    // ground; the thing worth flagging is criss-crossing one city.
    const km = intraDayKm(day);
    const isRoadDay = day.items.some(
      (i) => i.type === "transit" && /^(Train|Drive) (to|back)/.test(i.name));
    const driving = cityById(day.cityId)?.scale === "driving";
    if (km > (isRoadDay ? 320 : driving ? 160 : 45)) {
      issues.push({ code: "geography", severity: "warn", day: day.index,
        message: `Day ${day.index} covers ${Math.round(km)}km of back-and-forth.` });
    }

    // 8: monotony
    let run = 1;
    for (let i = 1; i < day.items.length; i++) {
      const a = day.items[i - 1], b = day.items[i];
      const ka = a.placeId ? placeById(a.placeId)?.kind : undefined;
      const kb = b.placeId ? placeById(b.placeId)?.kind : undefined;
      if (ka && ka === kb) { run++; } else { run = 1; }
      if (run >= 3) {
        issues.push({ code: "monotony", severity: "warn", day: day.index, itemId: b.id,
          message: `Three ${kb}s in a row on day ${day.index}.` });
        run = 1;
      }
    }

    // 9: humane hours
    const last = day.items[day.items.length - 1];
    if (last && toMin(last.start) + last.durationMin > 1440 + 60) {
      issues.push({ code: "unreasonable_hours", severity: "warn", day: day.index,
        message: `Day ${day.index} runs past 1am.` });
    }
  }

  /*
   * 6: budget.
   *
   * One threshold, not three. The planner re-cut at 1.02, the card and the
   * spoken line warned at 1.00, and this errored at 1.05 — so on 23 of 165
   * (destination, budget) pairs the panel told her the trip was over while the
   * critic, the thing that decides whether a plan is shippable, said nothing.
   * The card is what she reads, so the card's threshold wins.
   */
  if (brief.budgetUsd !== undefined && trip.concept.estimateUsd > brief.budgetUsd) {
    issues.push({ code: "over_budget", severity: "error",
      message: `Estimated $${trip.concept.estimateUsd.toLocaleString()} against a budget of $${brief.budgetUsd.toLocaleString()}.` });
  }

  /*
   * 7: places she ruled out, and places she has already been.
   *
   * The one check that runs after every plan and every edit was blind to the
   * two hardest constraints in the brief. "denmark but not copenhagen" came
   * back sleeping in Copenhagen and `critique` had nothing to say; a plan
   * routed through two towns she had told us she had already seen was clean.
   * The planner's own comment has said this was missing since it was written.
   *
   * A warn, not an error: `repair` deletes what it is handed, and deleting a
   * base is not a repair. This is the sentence the UI and the eval need.
   */
  // One matcher, shared with buildShape and the override note. Three copies
  // meant "not copenhagen please" got an override note and no warning here.
  const ruledOut = brief.avoidPlaces ?? [];
  const seen = brief.visitedNames ?? [];
  const visiting = [...new Set(trip.concept.shape.flatMap((l) =>
    [l.cityId, ...(l.dayTrip ? [l.dayTrip] : []), ...(l.extraDayTrip ? [l.extraDayTrip] : [])]))];
  for (const id of visiting) {
    const name = cityById(id).name;
    if (isRuledOut(name, ruledOut)) {
      issues.push({ code: "avoid_violation", severity: "warn",
        message: `The trip goes to ${name}, which you ruled out.` });
    } else if (isRuledOut(name, seen)) {
      issues.push({ code: "avoid_violation", severity: "warn",
        message: `The trip goes to ${name}, which you've already been to.` });
    }
  }

  return issues;
}

export function intraDayKm(day: ItineraryDay): number {
  const pts = day.items.filter((i) => i.lat != null) as (typeof day.items[number] & { lat: number; lng: number })[];
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
  return km;
}

/** Drop items that make a day impossible. Warnings are left for the agent to
 *  talk about rather than silently "fixed". */
export function repair(trip: Trip, issues: Issue[]): { trip: Trip; removed: number } {
  const bad = new Set(
    issues.filter((i) => i.severity === "error" && i.itemId).map((i) => i.itemId!),
  );
  if (bad.size === 0) return { trip, removed: 0 };
  const days = trip.days.map((d) => ({ ...d, items: d.items.filter((i) => !bad.has(i.id)) }));
  return { trip: { ...trip, days }, removed: bad.size };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
