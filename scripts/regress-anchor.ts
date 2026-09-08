/**
 * A trip built around a dated event starts when the event says it does.
 *
 * "i wanna plan a trip to see the solar eclipse next year in egypt. help me
 * plan" produced a pitch that named the date correctly — the total solar
 * eclipse of 2 August 2027, totality over the Theban desert — attached to an
 * itinerary beginning 24 October of this year.
 *
 * The model knew. It said so, in its own opening paragraph, directly above a
 * plan that missed the only thing she asked for by twenty-one months. Nothing
 * carried the date from the sentence into the brief, so the planner used its
 * default of "a few weeks from now".
 *
 * Same shape as the rest of tonight: one layer knows, the next one never
 * reads it.
 */
import { planTrip } from "@/lib/planner";
import { recommend } from "@/lib/recommend";
import { validateForTest } from "@/lib/agent/llm";
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `  ${d}` : ""}`);
  if (!ok) fails++;
};
const start = (b: Brief) => planTrip(b, recommend(b, emptyProfile()), emptyProfile()).concept.startDate;
const base: Brief = { ...emptyBrief(), days: 7, namedDestination: "portugal" };

console.log("\n\x1b[1mPLANNED AROUND THE THING SHE CAME FOR\x1b[0m\n");

const noAnchor = start(base);
const anchored = start({ ...base, anchorDate: "2027-08-02", anchorEvent: "total solar eclipse" });
check("without an anchor the trip starts soon, as before", noAnchor < "2027-01-01", noAnchor);
check("with one, the trip is built around it", anchored.startsWith("2027-07"), anchored);
check("and the event falls inside the trip, not on the first or last day", (() => {
  const s = new Date(`${anchored}T12:00:00Z`).getTime();
  const e = new Date("2027-08-02T12:00:00Z").getTime();
  const dayOf = Math.round((e - s) / 86400000) + 1;
  return dayOf > 1 && dayOf < 7;
})(), anchored);

/*
 * Dates she stated outright beat an inferred one. A booked flight is a fact;
 * an event date is a very good guess about a trip that does not exist yet.
 */
const both = start({ ...base, anchorDate: "2027-08-02", dates: { start: "2026-10-10", end: "2026-10-17" } });
check("dates she actually stated still win", both.startsWith("2026-10"), both);

/*
 * And the model is told to leave the date empty rather than guess, because a
 * plan built on an invented date is silently wrong everywhere and nothing
 * downstream can tell. So the reader only accepts a real, future, plausible
 * one.
 */
for (const [label, raw] of [
  ["a date in the past", { anchor_event: "eclipse", anchor_date: "2019-07-02" }],
  ["a nonsense date", { anchor_event: "eclipse", anchor_date: "next august" }],
  ["a date beyond planning", { anchor_event: "eclipse", anchor_date: "2044-08-23" }],
] as [string, Record<string, unknown>][]) {
  check(`${label} is refused`, validateForTest(raw)?.anchorDate === undefined,
    String(validateForTest(raw)?.anchorDate));
}
const good = validateForTest({ anchor_event: "total solar eclipse", anchor_date: "2027-08-02" });
check("a real future date is kept", good?.anchorDate === "2027-08-02", String(good?.anchorDate));
check("and the event is kept even without a date",
  validateForTest({ anchor_event: "the Palio" })?.anchorEvent === "the Palio");

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
