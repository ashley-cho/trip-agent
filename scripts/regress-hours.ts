/**
 * Regression: a Friday-only market scheduled on a Monday.
 *
 * Ten days in Slovenia. Day 3, Monday 26 October, one item on it: Odprta
 * Kuhna, the open-air food market in Ljubljana. Its own note, printed on the
 * card underneath it, read "Fridays only, roughly March to October, 10am-9pm."
 *
 * Nothing was broken in the scheduler. Place carries closedDays, the day
 * builder checks it, the critic checks it. The researcher simply never filled
 * it in: asked for "opening hours where you are confident" it gives the hours
 * of the day and puts the weekday constraint in prose, and an empty closedDays
 * means "open every day" to everything downstream.
 *
 * So the fact was on the screen, in the one field nothing can schedule
 * against. The model supplies facts; the arithmetic is ours.
 */
import { closedDaysFromNote, validatePlaceList } from "@/lib/research";
import type { Brief, City } from "@/lib/types";
import { emptyBrief, emptyProfile } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { applyOps, parseEditRules } from "@/lib/edit";
import { placeById } from "@/data";
import { DESTINATIONS } from "@/data/destinations";
import { toMin } from "@/lib/geo";
import { fitsTimeOfDay } from "@/lib/hours";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};
const same = (a: number[] | undefined, b: number[]) =>
  !!a && a.length === b.length && a.every((x, i) => x === b[i]);

console.log("\n\x1b[1mA FRIDAY MARKET IS SHUT ON MONDAY\x1b[0m\n");

// Her exact note.
check("\"Fridays only\" closes the other six days",
  same(closedDaysFromNote("Fridays only, roughly March to October, 10am-9pm. Great lunch but plan your week around the day it runs."), [0, 1, 2, 3, 4, 6]),
  String(closedDaysFromNote("Fridays only, roughly March to October, 10am-9pm.")));

for (const [note, want] of [
  ["Closed Mondays, as most museums here are.", [1]],
  ["Closed on Sunday and Monday.", [0, 1]],
  ["Weekends only, and it gets busy by ten.", [1, 2, 3, 4, 5]],
  ["Weekdays only — the office crowd is the point.", [0, 6]],
  ["Only on Saturdays, from the harbour.", [0, 1, 2, 3, 4, 5]],
] as [string, number[]][]) {
  check(`"${note.slice(0, 34)}…" → ${JSON.stringify(want)}`,
    same(closedDaysFromNote(note), want), JSON.stringify(closedDaysFromNote(note)));
}

// Conservative: a sentence that doesn't state a weekday rule changes nothing.
for (const note of [
  "Worth an hour, and the coffee is the best on the square.",
  "Open late, which is rare around here.",
  "Book ahead in summer; the only table left will be at six.",
  "Midday is the worst time to go.",
  "A holiday crowd forms by noon.",
]) {
  check(`"${note.slice(0, 34)}…" leaves it alone`, closedDaysFromNote(note) === undefined,
    JSON.stringify(closedDaysFromNote(note)));
}

// End to end, through validation.
{
  const cities = [{ id: "slovenia-ljubljana", name: "Ljubljana", destinationId: "slovenia",
    lat: 46.05, lng: 14.5, nightlyUsd: 105, minNights: 2, maxNights: 5, base: "Center." }] as City[];
  const raw = [{
    id: "odprta-kuhna", cityId: "slovenia-ljubljana", name: "Odprta Kuhna", kind: "meal",
    tags: ["food", "market"], neighborhood: "Center", lat: 46.0512, lng: 14.5065,
    durationMin: 90, costUsd: 15, bestTime: "midday", touristy: 2,
    note: "Fridays only, roughly March to October, 10am-9pm. Great lunch but plan your week around it.",
  }];
  const { places } = validatePlaceList(raw, "slovenia", cities);
  check("the market comes out of validation shut six days a week",
    same(places[0]?.closedDays, [0, 1, 2, 3, 4, 6]), JSON.stringify(places[0]?.closedDays));
  check("and Monday is one of them", !!places[0]?.closedDays?.includes(1));
}

// An explicit field still wins over the prose.
{
  const cities = [{ id: "x-y", name: "Y", destinationId: "x", lat: 1, lng: 1,
    nightlyUsd: 100, minNights: 1, maxNights: 3, base: "" }] as City[];
  const { places } = validatePlaceList([{
    id: "p", cityId: "x-y", name: "P", kind: "sight", tags: ["art"], neighborhood: "N",
    lat: 1, lng: 1, durationMin: 60, costUsd: 5, bestTime: "any", touristy: 2,
    closedDays: [2], note: "Closed Mondays.",
  }], "x", cities);
  check("an explicit closedDays is not overwritten by the note",
    same(places[0]?.closedDays, [2]), JSON.stringify(places[0]?.closedDays));
}


// --- a sunset walk at 10:11 -----------------------------------------------
/*
 * The planner refuses an evening-only place before 15:00 as a rule, not a
 * score: "a place called 'at sunset' has no business at half past eleven."
 * The edit path's replacement picker filtered on touristy, kind, opening hours
 * and duration, and never on that — so "less touristy please" in Korea put the
 * Naksan Park wall walk, an evening view, into a 10:11 slot. The critic has no
 * rule about it, so nothing downstream caught it either.
 *
 * Same class as the opening-hours bug this file was written for: one guard,
 * held in two places, applied in one.
 */
{
  /*
   * Swept across vibe sets, not just the default one. The first version of
   * this used one brief per destination, and with the guard deliberately
   * removed it still passed: the swap and the insert only reach an
   * evening-only place for certain briefs. A guard test that never reaches
   * the guard is decoration.
   */
  const MSGS = ["less touristy please", "i don't care about museums", "more food"];
  const VIBE_SETS = [
    ["exploration", "food", "culture"], ["nature", "adventure"],
    ["city", "culture"], ["relaxation"], [],
  ];
  let early = 0, checked = 0;
  for (const d of DESTINATIONS) for (const vibes of VIBE_SETS) {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: d.id, days: 7, month: "October", vibes: vibes as Brief["vibes"],
    }) as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    for (const msg of MSGS) {
      checked++;
      const out = applyOps(trip, parseEditRules(msg, trip), brief, emptyProfile()).trip;
      for (const day of out.days) {
        for (const i of day.items) {
          const p = "placeId" in i && i.placeId ? placeById(i.placeId) : undefined;
          // Evening-only: the flag is all there is. A place that states daytime
          // hours is "nicest after dark", and isOpenFor already governs it.
          if (p && !fitsTimeOfDay(p, toMin(i.start))) {
            early++;
            if (early === 1) console.log(`        ${d.id} "${msg}" → ${i.name} at ${i.start}`);
          }
        }
      }
    }
  }
  check("no edit puts an evening-only place in the morning", early === 0,
    `${early} across ${checked} edits`);

  /*
   * And the two readings of the flag stay apart: a sunset viewpoint with no
   * hours is refused in the morning; a lagoon that opens at nine is not.
   * Collapsing them either way is a bug that has happened in both directions.
   */
  check("a place with no hours and an evening flag is a morning refusal",
    !fitsTimeOfDay({ bestTime: "evening" }, 660));
  check("but one that opens in the morning is not",
    fitsTimeOfDay({ bestTime: "evening", opens: "09:00" }, 660));
  check("and after 15:00 the flag stops mattering",
    fitsTimeOfDay({ bestTime: "evening" }, 1020));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
