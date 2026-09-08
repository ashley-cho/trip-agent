/**
 * Regression: trips are projects, not conversations.
 *
 * Closing the tab used to lose the Thailand you spent ten minutes on. Planning
 * happens over days, with two or three ideas alive at once.
 */
import { emptyBrief, type Brief, type Trip } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { tripName, tripStatus, whenLabel, type SavedTrip } from "@/lib/trips";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { emptyProfile } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\nTRIPS AS PROJECTS\n");

// Named from the trip, never typed by anyone.
const planned = applyPatch(emptyBrief(), {
  namedDestination: "portugal", days: 9, month: "October",
  dates: { start: "2026-10-12", end: "2026-10-21" }, vibes: ["culture"],
}) as Brief;
const trip: Trip = planTrip(planned, recommend(planned), emptyProfile());
check("a planned trip is named after the place and the dates",
      /Portugal/.test(tripName(planned, trip)) && /9 days/.test(tripName(planned, trip)),
      tripName(planned, trip));

// Half-finished ideas still have to be tellable apart.
const vague = applyPatch(emptyBrief(), { vibes: ["nature"] }) as Brief;
check("an unfinished one falls back to what they typed",
      tripName(vague, null, "i want to go roadtripping in europe").startsWith("I want to go"),
      tripName(vague, null, "i want to go roadtripping in europe"));
check("and never lands on a name that says nothing",
      tripName(vague, null, "i want to go roadtripping in europe") !== "New trip");

// A place we researched is named too, even in a tab that never registered it.
const researched = applyPatch(emptyBrief(), { namedDestination: "botswana", days: 10 }) as Brief;
check("a researched place doesn't crash the name in a fresh tab",
      tripName(researched, null).length > 0, tripName(researched, null));

// Where each one got to.
const at = (stage: SavedTrip["stage"]): SavedTrip => ({
  id: "x", name: "n", createdAt: 0, updatedAt: 0, stage,
  brief: emptyBrief(), msgs: [], history: [], trip: null,
});
check("status says where it got to",
      tripStatus(at("chat")) === "In conversation"
      && tripStatus(at("proposal")) === "Shortlisted"
      && tripStatus(at("itinerary")) === "Planned");

check("and when, in words", /min ago|just now/.test(whenLabel(Date.now() - 120_000)),
      whenLabel(Date.now() - 120_000));

console.log(`\n  ${fails === 0 ? "\x1b[32mall clear\x1b[0m" : `\x1b[31m${fails} failing\x1b[0m`}\n`);
process.exit(fails === 0 ? 0 : 1);
