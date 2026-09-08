/**
 * Regression: "about 10 days" is not a ten dollar budget.
 *
 * She typed a trip length and the agent opened by telling her that at $10
 * total she wasn't flying anywhere. The hedge words people use about money are
 * the same ones they use about time, and the pattern took the number out of
 * both. Every "about 10 days", "around two weeks", "up to 12 days" in the
 * app's history has been silently setting a budget of ten or twelve dollars.
 */
import { interpretRules, BUDGET_FLOOR } from "@/lib/discovery";
import { emptyBrief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};
const read = (t: string) => interpretRules(t, emptyBrief());

console.log("\n\x1b[1mTIME IS NOT MONEY\x1b[0m\n");

// Her message, and every phrasing shaped like it.
for (const [text, days] of [
  ["i wanna go to the middle east for about 10 days", 10],
  ["up to 10 days", 10],
  ["around 12 days in japan", 12],
  ["roughly 2 weeks", 14],
  ["under 10 days", 10],
  ["max 9 nights", 9],
] as const) {
  const p = read(text);
  check(`"${text}" sets no budget`, p.budgetUsd === undefined, `budget=${p.budgetUsd}`);
  check(`  and still reads ${days} days`, p.days === days, `days=${p.days}`);
}

// Real budgets must survive all of that.
for (const [text, usd] of [
  ["about $2000", 2000],
  ["around 3k", 3000],
  ["under $800", 800],
  ["up to $1,500", 1500],
  ["budget 2500", 2500],
  ["2500 budget", 2500],
  ["budget of 3k", 3000],
  ["about 2 weeks in japan with a $3,000 budget", 3000],
] as const) {
  const p = read(text);
  check(`"${text}" still reads as ${usd}`, p.budgetUsd === usd, `budget=${p.budgetUsd}`);
}

// The floor, for anything that slips past the patterns.
check("a whole trip costing less than the floor is a misread, not a budget",
  read("budget 10").budgetUsd === undefined && read("$25").budgetUsd === undefined,
  `floor=${BUDGET_FLOOR}`);
check("and the floor doesn't eat a small but real one",
  read("$600").budgetUsd === 600, String(read("$600").budgetUsd));

// The mixed message: both numbers in one sentence, each read correctly.
{
  const p = read("about 10 days in portugal, budget around $2500");
  check("length and budget in one sentence are told apart",
    p.days === 10 && p.budgetUsd === 2500, `days=${p.days} budget=${p.budgetUsd}`);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
