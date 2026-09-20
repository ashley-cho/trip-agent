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
import { effectiveDays, discoveryGate, interpretRules, QUESTIONS } from "@/lib/discovery";
import { emptyBrief } from "@/lib/types";
import type { Brief } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { recommend, fitDays, daysSupported, tooThinFor } from "@/lib/recommend";
import { destinationById } from "@/data/destinations";
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

// --- and it is asked before the ceiling can end the conversation ---------
/*
 * Built, reverted for turn count, then restored on her instruction.
 *
 * discoveryGate already had the check; it sat below `if (asked >= ceiling)
 * return "stop"`, so it could only fire on a turn the gate would allow anyway.
 * Lifting it above the ceiling fixed the Everest case and cost a turn on every
 * researched destination, which regress-turns caught. I reverted it on speed
 * grounds. She overruled that: "always ask ... it's better than spitting out
 * nonsensical bs". Asking outranks the turn budget when the alternative is the
 * app making the answer up.
 */
{
  const hiking: Brief = { ...emptyBrief("i wanna go abroad to hike"),
    vibes: ["nature", "adventure"],
    activities: ["hike abroad", "proper mountains, altitude and challenge", "multi-day remote trek"],
    unknownCandidates: ["nepal's khumbu region"] };

  check("at the ceiling, an unknown length is still asked for",
    discoveryGate(hiking, 2) === "must", discoveryGate(hiking, 2));
  /*
   * This used to assert that a single named place counted "not just a
   * candidate list", because the same place was stored in two fields and
   * readers kept consulting only one. The fields are now one field, so the
   * disagreement is not possible; what is worth asserting is that the
   * collapse happened.
   */
  check("with nothing named at all it is not asked",
    discoveryGate({ ...hiking, unknownCandidates: undefined }, 2) === "stop",
    discoveryGate({ ...hiking, unknownCandidates: undefined }, 2));
  check("and there is only one field to disagree with",
    !("unknownDestination" in (hiking as unknown as Record<string, unknown>)));
  check("once she gives one, the ceiling ends it as before",
    discoveryGate({ ...hiking, days: 14 }, 2) === "stop");
  check("and 'I'm flexible' is an answer, not a gap",
    discoveryGate({ ...hiking, flexibleDuration: true }, 2) === "stop");
  check("always ask is not ask forever",
    discoveryGate(hiking, 9) === "stop", discoveryGate(hiking, 9));
  check("and a place we already hold is not researched, so it is not asked",
    discoveryGate({ ...emptyBrief("x"), vibes: ["nature"], namedDestination: "iceland" }, 2) === "stop");
}

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

/*
 * A RANGE IS A RANGE.
 *
 * "i wanna go to croatia for 1-2 weeks" was answered with:
 *
 *   "Nothing I have really fits this. The closest is Dalmatia, and even that
 *    only has about 12 days of material in it, against a trip of 14."
 *
 * Twelve days is a one-to-two-week trip. Three separate things were wrong,
 * all of them the same shape as the bug above: the app substituted a number
 * for hers and then treated its own number as a fact about her.
 *
 *   1. There was no rule for a range of WEEKS, so "1-2 weeks" fell through to
 *      the bare weeks rule, which found "2 weeks" and said fourteen.
 *   2. Even the day-range rule kept only its midpoint, so both ends were gone
 *      by the time anything downstream could ask about them.
 *   3. The chip labelled "1-2 weeks" sent 10. Clicking and typing the same
 *      phrase produced different trips.
 */
{
  const read = (said: string) => {
    const b = applyPatch(emptyBrief(said), interpretRules(said, emptyBrief(said)));
    return { b, rec: recommend(b) };
  };

  const croatia = read("i wanna go to croatia for 1-2 weeks");
  check("\"1-2 weeks\" is one to two weeks, not two",
    croatia.b.daysRange?.min === 7 && croatia.b.daysRange?.max === 14,
    JSON.stringify({ days: croatia.b.days, range: croatia.b.daysRange }));
  check("and croatia is planned, not refused",
    !croatia.rec.noGoodFit && croatia.rec.destinationId === "dalmatia",
    croatia.rec.noGoodFit ?? croatia.rec.destinationId);
  check("the trip it plans sits inside the range she gave",
    (() => {
      const d = destinationById(croatia.rec.destinationId)!;
      const n = fitDays(croatia.b, d);
      return n >= 7 && n <= 14 && n <= daysSupported(d, "mixed");
    })(),
    `${fitDays(croatia.b, destinationById(croatia.rec.destinationId)!)} days`);

  check("a day range keeps both of its ends too",
    read("croatia for 10-14 days").b.daysRange?.min === 10
    && read("croatia for 10-14 days").b.daysRange?.max === 14);
  check("and \"1 to 2 weeks\" reads the same as \"1-2 weeks\"",
    read("portugal for 1 to 2 weeks").b.daysRange?.max === 14);

  /*
   * The floor is what decides it, because `carries` only gets harder as the
   * trip gets longer. A destination is refused only when there is no trip in
   * her range at all.
   */
  const dalmatia = destinationById("dalmatia")!;
  const ranged = (min: number, max: number): Brief =>
    ({ ...emptyBrief("x"), days: Math.round((min + max) / 2), daysRange: { min, max } });
  check("a range is refused only when nothing in it fits",
    !tooThinFor(dalmatia, ranged(7, 14), 14)
    && tooThinFor(dalmatia, ranged(18, 21), 21),
    `carries ${daysSupported(dalmatia, "mixed")}`);
  check("and a single stated length still refuses honestly at that length",
    tooThinFor(dalmatia, { ...emptyBrief("x"), days: 21 }, 21),
    "she named one number; measuring against it is not a substitution");

  check("the refusal quotes the range, not the top of it",
    /a trip of \$\{brief\.daysRange\.min\} to \$\{brief\.daysRange\.max\} days/
      .test(readFileSync("lib/recommend.ts", "utf8")),
    "\"against a trip of 14\" was a number she never typed");

  // --- and the chips say what their labels say ----------------------------
  const opts = QUESTIONS.duration.options ?? [];
  check("every duration chip sends the range on its label",
    opts.filter((o) => o.value !== "flexible").every((o) => /^\d+-\d+$/.test(o.value)),
    JSON.stringify(opts.map((o) => `${o.value}=${o.label}`)));
  check("and the 1-2 weeks chip is one to two weeks",
    opts.find((o) => /1.2 weeks/i.test(o.label))?.value === "7-14");
  check("the page turns that value into a range on the brief",
    /daysRange: \{ min: lo, max: hi \}/.test(readFileSync("app/page.tsx", "utf8")),
    "otherwise clicking means something narrower than the words beside it");
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
