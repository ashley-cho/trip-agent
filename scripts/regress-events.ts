/**
 * Regression: a sporting event is a place and a date under another name.
 *
 * "wimbledon" was read as an activity and pitched as "For wimbledon: ...";
 * "f1 in may" was refused. The table in data/events.json places the host
 * and dates the edition, and this checks the whole path with no model:
 * the gate, the brief, the planner's dates, the event on the days it runs,
 * and the honest sentence when the host is not held or the ask is open.
 */
import { readFileSync, readdirSync } from "node:fs";
import { registerPack } from "@/data/registry";
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import { offlineInterpret } from "@/lib/offline";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { EVENTS, findEvent, editionFor } from "@/lib/events";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};
for (const f of readdirSync("data/catalogue").filter((x) => x.endsWith(".json"))) {
  const row = JSON.parse(readFileSync(`data/catalogue/${f}`, "utf8"));
  try { registerPack(row.pack ?? row); } catch { /* held */ }
}
const TODAY = new Date("2026-09-26T00:00:00Z");
const plan = (text: string) => {
  const r = offlineInterpret(text, emptyBrief(text));
  if (!("patch" in r)) return { r };
  const b = applyPatch(emptyBrief(text), r.patch) as Brief;
  return { r, b, trip: planTrip(b, recommend(b), emptyProfile(), { today: TODAY }) };
};

console.log("\n\x1b[1mAN EVENT IS A PLACE AND A DATE\x1b[0m\n");

check("the table holds every category she asked for",
  ["f1", "tennis", "football", "golf", "olympics", "nfl", "nba", "mlb"].every((s) => EVENTS.some((e) => e.sport === s)));
check("every row has a host city and a venue", EVENTS.every((e) => e.city && e.venue));
check("every dated row has ISO dates in order",
  EVENTS.every((e) => e.editions.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.start) && x.start <= x.end)));

{
  const { b, trip } = plan("the monaco grand prix");
  check("\"the monaco grand prix\" is the Riviera", trip?.concept.destinationId === "riviera", trip?.concept.destinationId);
  check("  dated round the 2027 race", !!b?.event?.start && b.event.start.startsWith("2027-06"), b?.event?.start);
  check("  with the race on its days", (trip?.days.filter((d) => d.items.some((i) => i.name === "Monaco Grand Prix")).length ?? 0) >= 3);
  check("  and the card says when and how to get tickets", /Monaco Grand Prix runs/.test(trip?.concept.eventNote ?? "") && /(ticket|seats|sold via)/i.test(trip?.concept.eventNote ?? ""));
  check("  and no 'you haven't given me dates'", !trip?.concept.dateNote, trip?.concept.dateNote);
}
{
  const { b, trip } = plan("wimbledon");
  check("\"wimbledon\" is London", trip?.concept.destinationId === "london");
  check("  not in the past: last year's dates moved a year, and said so",
    !!b?.event?.provisional && (b.event.start ?? "") > "2026-09-26" && /not published yet/.test(trip?.concept.eventNote ?? ""), b?.event?.start);
}
{
  const { r } = plan("the masters");
  check("a host we do not hold is said, not planned around",
    !("patch" in r) && /Augusta isn't somewhere I hold/.test(r.unheld ?? ""), JSON.stringify(r).slice(0, 160));
}
{
  const { r } = plan("f1 in march 2027");
  check("two rounds in a month is a question, not a guess",
    !("patch" in r) && /Which one/.test(r.unheld ?? "") && /Bahrain/.test(r.unheld ?? ""), r.unheld);
}
{
  const { r } = plan("a warriors game");
  check("a league team names its city and season",
    !("patch" in r) && /San Francisco/.test(r.unheld ?? "") && /season/.test(r.unheld ?? ""), r.unheld);
}
{
  const { b, trip } = plan("roland garros with my mum");
  check("the rest of the sentence still lands", !!b && trip?.concept.destinationId === "france" && !!b.event, JSON.stringify(b?.asides));
}
{
  const { trip } = plan("melbourne");
  check("a city with an event in it is not an event", !trip?.concept.eventNote);
}
check("editionFor prefers the next published edition", editionFor(EVENTS.find((e) => e.id === "f1-monaco")!, TODAY)?.year === 2027);
check("findEvent ignores a sentence with no event", findEvent("hot springs and long walks", TODAY) === undefined);

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
