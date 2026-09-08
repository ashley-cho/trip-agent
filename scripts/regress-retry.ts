/**
 * Regression: "say the word and I'll try Faroe Islands again" was a lie.
 *
 * When research on somewhere she named couldn't be turned into a plan, the
 * agent said so honestly, offered a retry, and planned somewhere else. Two
 * things were wrong with that.
 *
 * It never tried twice. One flaky structuring call and she was going to New
 * Zealand instead of the Faroes, which is an enormous consequence for a single
 * request. The notes are already in hand at that point, so a second attempt
 * costs one call.
 *
 * And the retry it offered in writing could not happen. Failed research is
 * marked acknowledged so the agent doesn't burn forty seconds on it every
 * turn; the cost was that saying "try again" hit a closed gate and produced
 * the substitute a second time. An offer the product can't honour is worse
 * than no offer at all.
 */
import { wantsRetry } from "@/lib/discovery";
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mSAYING THE WORD DOES SOMETHING\x1b[0m\n");

for (const yes of [
  "try again",
  "try the faroe islands again",
  "can you try again please",
  "have another go",
  "retry",
  "one more go",
  "go on, try again",
]) {
  check(`"${yes}" asks for a retry`, wantsRetry(yes));
}

// Things that are not a retry, especially the ones that sound like one.
for (const no of [
  "i want to go to new zealand",
  "somewhere warm again would be nice",
  "again, i don't want a city",
  "sounds good",
  "make it five days",
]) {
  check(`"${no}" is not`, !wantsRetry(no), "");
}

{
  const page = readFileSync("app/page.tsx", "utf8") + readFileSync("lib/flow.ts", "utf8");
  check("the place that failed is remembered",
    /(?:refs\.failedResearch|failedResearchRef)\.current = failure \?\? wanted\[0\]/.test(page));
  check("and a retry reopens exactly that one",
    /unknownAcknowledged: false/.test(page) && /unknownCandidates: \[again\]/.test(page));
  check("clearing the pin, so it is genuinely re-decided",
    /wantsRetry\(text\)[\s\S]{0,400}pitchedRef\.current = null/.test(page));
  check("naming somewhere else beats a stray 'again'",
    /wantsRetry\(text\) && !patch\.namedDestination/.test(page));
  check("and the structuring call is attempted twice before giving up",
    /one more go/.test(page) && /await structure\(\)[\s\S]{0,400}await structure\(\)/.test(page));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
