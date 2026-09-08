/**
 * Regression: a country is not one itinerary.
 *
 *   "i wanna go to china for hiking"
 *
 * The agent opened well: Tiger Leaping Gorge, the trails around Yangshuo,
 * multi-day treks in western Sichuan. Then it went off to research China and
 * came back with Beijing four nights, Xi'an two, Shanghai three. The guidebook
 * index, with no hiking anywhere in it.
 *
 * The cause was not the model. `researchPrompt(place, days, origin)` never
 * received the brief, so the only thing the researcher knew was the name of
 * the country, and the only sensible answer to "plan twelve days in China" with
 * no other information is the standard tourist route.
 */
import { researchPrompt } from "@/lib/research";
import { interestLine } from "@/lib/brief";
import { applyPatch } from "@/lib/brief";
import { emptyBrief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA COUNTRY IS NOT ONE ITINERARY\x1b[0m\n");

const hers = applyPatch(emptyBrief(), {
  days: 12,
  vibes: ["nature", "adventure"],
  interestEcho: "Hiking.",
  unknownCandidates: ["china"],
});

const line = interestLine(hers);
check("her interest survives into one line", /hiking/i.test(line), line);
check("and so do the vibes behind it", /nature/.test(line) && /adventure/.test(line), line);

const prompt = researchPrompt("china", 12, "San Francisco", line);
check("the researcher is told what they asked for", /hiking/i.test(prompt));
check("and told it decides where in the country they go",
  /decides which part/i.test(prompt), prompt.split("\n").find((l) => /decides/i.test(l)) ?? "");
check("and told not to fall back on the famous route",
  /do not send them on the famous route/i.test(prompt));
check("and told to say so if the country can't serve it",
  /say so plainly/i.test(prompt));

// Everything the brief knows has to reach it, or the pack is built blind.
const rich = applyPatch(hers, {
  budgetUsd: 3000,
  avoidTags: ["museum"],
  visitedIds: ["japan"],
  visitedNames: ["Japan"],
  roadTrip: true,
});
const rl = interestLine(rich);
for (const want of ["3000", "museum", "Japan", "drive"]) {
  check(`"${want}" reaches the researcher`, rl.includes(want), rl);
}

// No brief means no invented interests: an empty line must not fabricate one.
check("an empty brief adds nothing rather than guessing",
  interestLine(emptyBrief()) === "", `"${interestLine(emptyBrief())}"`);
const bare = researchPrompt("china", 12, "San Francisco");
check("and the prompt stays clean without it",
  !/THIS IS WHAT THEY ASKED FOR/.test(bare) && /12 days/.test(bare));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
