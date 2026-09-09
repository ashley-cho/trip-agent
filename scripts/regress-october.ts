/**
 * Regression: a month is not a country.
 *
 * She typed "portugal, 9 days in october, history and food, budget 2500".
 * The "days in X" cue captured **october** as a place, so `unknownDestination`
 * became "October". Three questions later the model call fell through to the
 * rules driver, the app went off to research a destination called October, and
 * the answer that came back was three nights in Kyoto, two in Takayama and two
 * in Tokyo. On a Portugal brief.
 *
 * Two floors, tested here:
 *   1. the parser never captures a time word as a place, and
 *   2. even if something upstream hands one over, it never becomes a research
 *      target.
 */
import { detectNamedPlaces, detectNamedPlace, interpretRules } from "@/lib/discovery";
import { emptyBrief, emptyProfile, unknownHead } from "@/lib/types";
import type { Brief } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { monthName, startOfStatedMonth } from "@/lib/dates";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA MONTH IS NOT A COUNTRY\x1b[0m\n");

const her = "portugal, 9 days in october, history and food, budget 2500";
const got = detectNamedPlaces(her);
check("her actual message finds Portugal", got.known.includes("portugal"), got.known.join(", ") || "nothing");
check("and nothing to go and research", got.unknown.length === 0, got.unknown.join(", ") || "none");

const patch = interpretRules(her, emptyBrief());
check("so no unknown destination is set", !patch.unknownCandidates?.[0], String(patch.unknownCandidates?.[0]));
check("and the length still parses", patch.days === 9, String(patch.days));

for (const text of [
  "10 days in october",
  "a week in august",
  "two weeks in the summer",
  "travelling in winter",
  "trip in december",
  "5 nights in early may",
  "holiday in spring",
]) {
  const r = detectNamedPlaces(text);
  check(`"${text}" names no place`, r.unknown.length === 0 && r.known.length === 0, r.unknown.join(", "));
}

check(
  "the singular parser agrees",
  !detectNamedPlace("9 days in october").unknown,
  String(detectNamedPlace("9 days in october").unknown),
);

// The guard must not have made the parser deaf to real places.
for (const [text, want] of [
  ["10 days in vietnam", "vietnam"],
  ["road trip in montenegro", "montenegro"],
  ["two weeks in patagonia", "patagonia"],
] as const) {
  const r = detectNamedPlaces(text);
  const found = r.known.includes(want) || r.unknown.some((u) => u.toLowerCase().includes(want));
  check(`"${text}" still finds ${want}`, found, [...r.known, ...r.unknown].join(", ") || "nothing");
}

console.log("\n\x1b[1m...BUT IT IS STILL A MONTH\x1b[0m\n");
/*
 * This file proved October was not mistaken for a country and stopped there,
 * which left the other half untested: October never reached the plan either.
 * `parseDateRange` returns null unless it finds two dates and `month` was only
 * ever set from a parsed range, so "9 days in march" was planned for 24
 * October — 45 days out, next Saturday — and then printed real weekdays and
 * enforced opening hours against them. Fifteen destinations of fifteen, by
 * construction, and this test happened to use the one month where the default
 * made it invisible.
 */
{
  const TODAY = new Date("2026-09-09T00:00:00Z");
  const plan = (text: string) => {
    const b0 = emptyBrief(text);
    const b = applyPatch(b0, interpretRules(text, b0)) as Brief;
    return { brief: b, trip: planTrip(b, recommend(b), emptyProfile(), { today: TODAY }) };
  };

  for (const [text, month] of [
    ["portugal, 9 days in march, history and food", "March"],
    ["i want to go to japan for 10 days in april", "April"],
    ["southern spain for a week in august", "August"],
  ] as const) {
    const { brief, trip } = plan(text);
    check(`"${text.slice(0, 34)}…" keeps ${month} in the brief`, brief.month === month, String(brief.month));
    check(`  and the plan is actually in ${month}`,
      monthName(trip.concept.startDate) === month
        && monthName(trip.days[trip.days.length - 1].date) === month,
      `${trip.concept.startDate} .. ${trip.days[trip.days.length - 1].date}`);
    check("  and it says the date was ours, not hers",
      !!trip.concept.dateNote && trip.concept.dateNote.includes(month), trip.concept.dateNote ?? "(nothing)");
  }

  /*
   * A lone departure date is the only carrier of the month when no duration is
   * given, and nothing tested that: `singleDate` setting `month` was
   * load-bearing and uncovered.
   */
  {
    const { brief } = plan("iceland, flying out on october 12");
    check("a lone date sets the month even with no length",
      brief.month === "October", String(brief.month));
  }

  // A departure with no return is still the day the trip starts.
  {
    const { brief, trip } = plan("iceland, 8 days, flying out on october 12");
    check("a lone departure date is the start date",
      brief.dates?.start === "2026-10-12" && trip.concept.startDate.startsWith("2026-10-1"),
      `${brief.dates?.start} → ${trip.concept.startDate}`);
  }

  // Dates she actually gave still win, and get no note.
  {
    const { brief, trip } = plan("flying out on 10/12 and back on 10/21 to portugal");
    check("her real dates still beat everything", brief.dates?.start === "2026-10-12", String(brief.dates?.start));
    check("and a date she gave us is never explained back to her",
      trip.concept.dateNote === undefined, trip.concept.dateNote ?? "");
  }

  /*
   * A month she ruled out is not the month she is going.
   *
   * "portugal for 9 days, not august, too hot" planned the whole trip inside
   * August and told her "You said August" — the fidelity rule broken twice in
   * one sentence.
   */
  for (const text of ["portugal for 9 days, not august, too hot",
    "iceland 8 days, we can't go in july", "japan 10 days, anywhere but december"]) {
    check(`"${text.slice(0, 38)}…" does not plan the refused month`,
      plan(text).brief.month === undefined, String(plan(text).brief.month));
  }
  /*
   * The refusal window was 15 characters, so anything with words between the
   * negator and the month sailed through: "we definitely do not want to travel
   * in august" planned all nine days in August and told her "You said August".
   */
  for (const text of ["portugal 9 days, we definitely do not want to travel in august",
    "portugal 9 days, i would really prefer not to be there in august"]) {
    check(`"…${text.slice(-34)}" does not plan the refused month`,
      plan(text).brief.month === undefined, String(plan(text).brief.month));
  }

  /*
   * A month she is remembering is not a month she is going. "we were in june
   * last year", "june was brutal", "june nearly killed us" all planned June.
   */
  for (const [text, month] of [
    ["portugal 9 days, we were in june last year, this time october", "October"],
    ["portugal 9 days, june was brutal, let's do october", "October"],
    ["portugal 9 days, june nearly killed us; october please", "October"],
  ] as const) {
    check(`"…${text.slice(-30)}" plans ${month}`,
      plan(text).brief.month === month, String(plan(text).brief.month));
  }

  /*
   * An end-of-clause comma is not a date cue: "we want to march, then relax"
   * and "jan, my sister, is coming too" both became months on the punctuation.
   */
  for (const text of ["portugal 9 days, we want to march, then relax",
    "portugal 9 days. jan, my sister, is coming too"]) {
    check(`"…${text.slice(-28)}" is not a month`,
      plan(text).brief.month === undefined, String(plan(text).brief.month));
  }

  /*
   * And the date it picks is plannable. A week's notice is the floor — a
   * departure the day after tomorrow is not what "September" means — but it
   * must not be further away than saying nothing at all, which buys six weeks.
   */
  for (const on of ["2026-09-01", "2026-09-09", "2026-09-22"]) {
    const got = startOfStatedMonth("September", new Date(on + "T00:00:00Z"))!;
    const lead = (Date.parse(got) - Date.parse(on)) / 86_400_000;
    check(`"September" said on ${on} gives a week's notice, this year`,
      got.startsWith("2026-09") && lead >= 7, `${got} (${lead} days)`);
  }

  // The month she wants, not the first one in the sentence.
  check("a refused month before a wanted one loses",
    plan("i've never been in august but let's go in december, 9 days").brief.month === "December",
    String(plan("i've never been in august but let's go in december, 9 days").brief.month));
  check("and a remembered one loses too",
    plan("last time we went in june, this time we want october, 9 days").brief.month === "October",
    String(plan("last time we went in june, this time we want october, 9 days").brief.month));

  // Months that are also ordinary English words.
  for (const text of ["we want to march up to the top of the hill, 9 days",
    "a trip to Mar del Plata, 9 days", "travelling with jan and her brother, 9 days"]) {
    check(`"${text.slice(0, 38)}…" is not a month`,
      plan(text).brief.month === undefined, String(plan(text).brief.month));
  }

  /*
   * Month AND year vanished entirely: the lookahead that defers "march 9" to
   * parseDateRange also swallowed "march 2027", which parseDateRange doesn't
   * match either. She named a month and a year and nothing downstream knew.
   */
  for (const [text, month] of [
    ["portugal in october 2026, 9 days", "October"],
    ["portugal, 9 days, march 2027", "March"],
    ["japan, 10 days, sometime in august 2026", "August"],
  ] as const) {
    check(`"${text}" keeps ${month}`, plan(text).brief.month === month, String(plan(text).brief.month));
  }

  /*
   * Saying "September" on 11 September used to move the trip eleven months
   * out — further away than saying nothing, which defaults to six weeks.
   */
  check("a month that is happening now means this one, not next year",
    startOfStatedMonth("September", new Date("2026-09-11T00:00:00Z"))!.startsWith("2026-09"),
    String(startOfStatedMonth("September", new Date("2026-09-11T00:00:00Z"))));

  // "may i ask" is not a May trip: the one month that is also a normal word.
  check("'may i ask about portugal' is not a May trip",
    plan("may i ask about portugal, 9 days").brief.month === undefined,
    String(plan("may i ask about portugal, 9 days").brief.month));
  check("but 'portugal in may, 9 days' is",
    plan("portugal in may, 9 days").brief.month === "May",
    String(plan("portugal in may, 9 days").brief.month));

  // And with nothing at all, it still owns the date it invented.
  check("no dates at all is admitted too",
    !!plan("portugal, 9 days, history and food").trip.concept.dateNote);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
