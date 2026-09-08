/**
 * A length she never gave is not a fact about her trip.
 *
 * She wrote "i wanna go abroad to hike", then "Proper mountains, altitude and
 * challenge", then "Multi-day remote trek". No dates, no duration, nothing.
 * What came back opened:
 *
 *   "Seven days door to door does not get you to Everest Base Camp itself,
 *    not safely anyway. Real EBC trekking needs 11 to 14 days minimum for
 *    acclimatization, and cramming it into six nights is how people get
 *    medevac'd out with pulmonary edema."
 *
 * effectiveDays() resolves an unset length to 7 so the planner has something
 * to do arithmetic with. That default was handed to the researcher as though
 * she had said it, so the app invented a number, quoted it back at her, and
 * then used it to refuse the exact trip she had asked for.
 *
 * The default stays, for the scheduler. It just stops being spoken.
 */
import { researchPrompt } from "@/lib/research";
import { effectiveDays } from "@/lib/discovery";
import { emptyBrief } from "@/lib/types";
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  a length she never gave\n");

// --- the planner still gets its number -----------------------------------
check("effectiveDays still resolves an unset length to a week",
  effectiveDays(emptyBrief("x")) === 7);
check("and honours one she gave",
  effectiveDays({ ...emptyBrief("x"), days: 12 }) === 12);

// --- the researcher is told the truth ------------------------------------
const unsaid = researchPrompt("Nepal's Khumbu Region", undefined, "San Francisco",
  "hike abroad; proper mountains, altitude and challenge; multi-day remote trek");

check("with no length, no number is stated", !/\b7\b|seven days/i.test(unsaid),
  unsaid.split("\n")[0]);
check("it says plainly that she has not given one",
  /have NOT told you how long/.test(unsaid));
check("and forbids ruling the place out on an invented length",
  /do not rule the place in or out on/i.test(unsaid));
check("the nights arithmetic stops asserting a total",
  !/is \d+ nights/.test(unsaid));
check("but the fly-home rule survives", /fly home from the airport/.test(unsaid));

const said = researchPrompt("Nepal's Khumbu Region", 14, "San Francisco", "trek");
check("with a length she gave, it is used", /for about 14 days/.test(said));
check("and the nights arithmetic comes back", /14 days is 13 nights/.test(said));

// --- and the flow passes hers, not the default ---------------------------
const flow = readFileSync("lib/flow.ts", "utf8");
check("the flow sends the researcher what she said",
  /const days = b\.days;/.test(flow));
check("and keeps the default for the scheduler only",
  /const planDays = effectiveDays\(b\)/.test(flow)
  && /researchPack\(subject, planDays,/.test(flow)
  && /plannable\(filled, planDays\)/.test(flow));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
