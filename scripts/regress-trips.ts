/**
 * Regression: trips are projects, not conversations.
 *
 * Closing the tab used to lose the Thailand you spent ten minutes on. Planning
 * happens over days, with two or three ideas alive at once.
 */
import { emptyBrief, type Brief, type Trip } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { listTrips, saveTrip, tripName, tripStatus, whenLabel, type SavedTrip } from "@/lib/trips";
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

console.log("\n\x1b[1mA FULL BOX IS NOT A REASON TO SAY NOTHING\x1b[0m\n");
{
  /*
   * `saveTrip` halves the number it keeps until the write succeeds. At keep=1
   * it writes the live trip alone — deleting every other saved trip — and used
   * to return `true`. Eight itineraries became one, the caller was told it had
   * worked, and nothing anywhere mentioned it. Dropping the oldest to keep the
   * live conversation is the right trade; doing it in silence is not.
   */
  const store = new Map<string, string>();
  let cap = 1e9;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > cap) {
        const e = new Error("full") as Error & { name: string };
        e.name = "QuotaExceededError";
        throw e;
      }
      store.set(k, v);
    },
    removeItem: (k: string) => { store.delete(k); },
  };
  const rec = (id: string, at: number): SavedTrip => ({
    id, name: id, createdAt: 1, updatedAt: at,
    stage: "itinerary", brief: emptyBrief(), msgs: [], history: [], trip: null,
  });
  for (let i = 1; i <= 8; i++) saveTrip(rec(`t${i}`, i));
  check("eight trips are saved when there is room", listTrips().length === 8, String(listTrips().length));

  // Now only one fits.
  cap = JSON.stringify([rec("t9", 9)]).length + 5;
  const out = saveTrip(rec("t9", 9));
  check("the live trip is still saved when the box is full",
    out.ok && listTrips()[0]?.id === "t9", JSON.stringify(out));
  check("and the caller is told that older trips went", out.dropped > 0, JSON.stringify(out));
  check("the number reported is the number that actually went",
    out.dropped === 8 - (listTrips().length - 1),
    `${out.dropped} reported, ${listTrips().length} left in the store`);
}

console.log(`\n  ${fails === 0 ? "\x1b[32mall clear\x1b[0m" : `\x1b[31m${fails} failing\x1b[0m`}\n`);
process.exit(fails === 0 ? 0 : 1);
