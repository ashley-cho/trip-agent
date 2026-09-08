/**
 * Regression: a public URL spends a real API key.
 *
 * The point of these limits is not that they are uncircumventable. Serverless
 * instances don't share memory, so a determined sprayer beats them. The point
 * is that a runaway client, a scraper, or one person hammering research can't
 * quietly empty an account overnight, and that going over is a degradation
 * rather than a failure.
 */
import { charge, clamp, LIMITS } from "@/lib/guard";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mSPENDING SOMEONE ELSE'S KEY\x1b[0m\n");

// An unknown action costs nothing: the deterministic half never rate-limits.
check("actions with no model behind them are free",
  [...Array(500)].every(() => charge("somethingElse", "free").ok));

const a = "1.2.3.4";
let cheap = 0;
while (charge("interpret", a).ok) { cheap++; if (cheap > 500) break; }
check("one visitor gets a real conversation before any limit", cheap >= 40, `${cheap} turns`);
check("but not an unlimited one", cheap <= 200, `${cheap} turns`);

const over = charge("interpret", a);
check("over the line it says how long to wait",
  !over.ok && (over.retryAfter ?? 0) > 0 && over.reason === "visitor",
  JSON.stringify(over));

// A second visitor is unaffected by the first one's spending.
check("limits are per visitor, not global-until-the-daily-cap",
  charge("interpret", "5.6.7.8").ok);

// Research costs more than conversation, so it runs out sooner.
const b = "9.9.9.9";
let heavy = 0;
while (charge("researchStream", b).ok) { heavy++; if (heavy > 500) break; }
check("research is charged at a higher rate than talking", heavy < cheap, `${heavy} vs ${cheap}`);
check("but you still get at least one researched destination", heavy >= 1, `${heavy}`);

// The daily ceiling exists and is reachable.
let hit = "";
for (let i = 0; i < 4000 && !hit; i++) {
  const v = charge("researchStream", `spray-${i}`);
  if (!v.ok) hit = v.reason ?? "";
}
check("spraying fresh addresses still hits the deployment's daily ceiling",
  hit === "daily", hit || "never hit");

// Input caps.
check("a long essay is truncated before it reaches the model",
  clamp("x".repeat(50_000), LIMITS.input).length === LIMITS.input);
check("and a place name is short by definition",
  clamp("y".repeat(500), LIMITS.place).length === LIMITS.place);
check("missing input is an empty string, not the word undefined",
  clamp(undefined, LIMITS.input) === "");

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
