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

/*
 * Asking for the length BEFORE research was built and then reverted.
 *
 * discoveryGate already had the check; it sat below `if (asked >= ceiling)
 * return "stop"`, so it could only fire on a turn the gate would allow
 * anyway. Lifting it above the ceiling did fix the Everest case, and cost a
 * turn on every researched destination: "i wanna go to turkey but not
 * istanbul or anywhere touristy" went from 2 turns to 4, and regress-turns
 * caught it. Speed is the first priority and the value proposition is "no
 * more planning, just leave", so a question on every trip is the wrong price
 * for a problem that only appears on trips needing more than a week.
 *
 * The minDays check below fixes the same case, after research, exactly when
 * it applies, for no turns at all.
 */

// --- a place that needs longer is a question, not a refusal --------------
{
  const flow = readFileSync("lib/flow.ts", "utf8");
  check("an unstated length against a high minDays asks instead of planning",
    /const needs = filled\.destination\.minDays/.test(flow)
    && /b\.days === undefined && !b\.flexibleDuration && needs > planDays/.test(flow));
  check("the research is kept, so answering does not pay for it twice",
    /needs > planDays[\s\S]{0,300}rememberPack\(filled\)/.test(flow));
  check("and a length she gave is allowed to refuse honestly",
    /If she gave a length, this does not fire/.test(flow));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
