/**
 * Regression: Ashley's real Portugal session.
 *
 * She planned this trip by hand over dozens of turns. Her opening message
 * already contained the dates, the origin airport, the budget, what she likes
 * and what she doesn't. The agent threw most of it away and then asked how
 * long she had. This test holds the line on reading it all in one pass, and on
 * the one correction she had to make by hand: the plan ended with two nights
 * in Porto and a morning flight home out of Lisbon.
 */
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import { rulesDriver } from "@/lib/agent/rules";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { destinationById, cityById } from "@/data/destinations";

const OPENING = `Going to portugal, flying out on 10/12 from sfo to lisbon, and coming back on 10/21. Knowing me help me plan it. I also haven't booked any lodging, and maybe my budget is max 2500, lower the better, but i'm flexible. i don't wanna go to a film festival. also like history and i usually check out art museums, food i don't care. i also like to check out local markets, landscapes, small towns`;

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${name}${detail ? `\n        ${detail}` : ""}`);
  if (!ok) fails++;
};

(async () => {
  console.log("\nPORTUGAL REGRESSION — one message, no questions\n");

  const b = applyPatch(emptyBrief(), await rulesDriver.interpret(OPENING, emptyBrief())) as Brief;

  check("reads the destination", b.namedDestination === "portugal", `got ${b.namedDestination}`);
  check("reads the dates", b.dates?.start === "2026-10-12" && b.dates?.end === "2026-10-21",
        `got ${b.dates?.start} → ${b.dates?.end}`);
  check("derives the length", b.days === 9, `got ${b.days}`);
  check("reads the month", b.month === "October", `got ${b.month}`);
  check("reads the origin airport", b.origin?.label === "San Francisco", `got ${b.origin?.label}`);
  check("reads the budget", b.budgetUsd === 2500, `got ${b.budgetUsd}`);
  check("keeps history and landscapes", b.vibes.includes("culture") && b.vibes.includes("nature"),
        `got ${b.vibes.join(", ")}`);
  check("'food i don't care' is not a request for food", !b.vibes.includes("food"),
        `got ${b.vibes.join(", ")}`);
  check("doesn't file the whole message as a constraint",
        b.constraints.every((c) => c.length < 80), JSON.stringify(b.constraints));

  const q = await rulesDriver.nextQuestion(b);
  check("asks nothing at all", q === null, `would ask: ${q?.id}`);

  const rec = recommend(b);
  const t = planTrip(b, rec, emptyProfile());
  const dest = destinationById(rec.destinationId);

  check("plans the trip she asked for", rec.destinationId === "portugal", `got ${rec.destinationId}`);
  check("starts on the arrival day, not the departure day", t.days[0].date === "2026-10-13",
        `got ${t.days[0].date}`);
  check("ends on her flight home", t.days[t.days.length - 1].date === "2026-10-21",
        `got ${t.days[t.days.length - 1].date}`);
  check("last night is at the airport she flies out of",
        t.days[t.days.length - 1].cityId === dest.hubCityId,
        `last day in ${cityById(t.days[t.days.length - 1].cityId).name}, flying from ${cityById(dest.hubCityId).name}`);
  check("holds the budget", t.concept.estimateUsd <= 2500 * 1.02,
        `$${t.concept.estimateUsd} vs $2500`);
  const dupes = t.days.some((d) => {
    const n = d.items.filter((i) => i.placeId).map((i) => i.placeId);
    return n.some((x, i) => n.indexOf(x) !== i);
  });
  check("no place appears twice in one day", !dupes);

  console.log(`\n  ${fails === 0 ? "\x1b[32mall clear\x1b[0m" : `\x1b[31m${fails} failing\x1b[0m`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
