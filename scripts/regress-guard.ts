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
import { readFileSync, readdirSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mSPENDING SOMEONE ELSE'S KEY\x1b[0m\n");

// An unknown action costs nothing: the deterministic half never rate-limits.
check("actions with no model behind them are free",
  [...Array(500)].every(() => charge("somethingElse", "free").ok));

/*
 * Both bounds are DERIVED from the allowance rather than restating it.
 *
 * `cheap <= 200` was a copy of the per-visitor number at the time, so raising
 * that number failed a test whose subject is "a limit exists" — a knob moving
 * and breaking a test about a behaviour that had not moved. The allowance is
 * configuration; that it bites, and that it leaves room for a real
 * conversation first, are the rules.
 */
const VISITOR_UNITS = Number(process.env.TRIP_AGENT_VISITOR_UNITS) || 400;
const a = "1.2.3.4";
let cheap = 0;
while (charge("interpret", a).ok) { cheap++; if (cheap > VISITOR_UNITS * 2) break; }
check("one visitor gets a real conversation before any limit", cheap >= 40, `${cheap} turns`);
check("but not an unlimited one", cheap <= VISITOR_UNITS,
  `${cheap} turns against an allowance of ${VISITOR_UNITS}`);

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


/*
 * "use client" has to be the first thing in the file.
 *
 * An import got inserted above it in lib/trips.ts and the whole app stopped
 * building — `next build` failed, `tsc` was clean, and the entire regress
 * suite passed, because nothing in either of them compiles the app. The site
 * would have gone out broken.
 *
 * Cheap to check here, and it catches the class rather than the instance.
 */
{
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      const text = readFileSync(full, "utf8");
      /*
       * The DIRECTIVE, not the words.
       *
       * This matched any occurrence of the string anywhere in the file, so a
       * doc comment that mentioned "use client" while explaining why a helper
       * was split out of a client module failed the check. A test that fires
       * on prose is one people learn to ignore, which costs more than the
       * bug it was written for. It has to be a statement on its own line.
       */
      if (!/^\s*["']use client["'];?\s*$/m.test(text)) continue;
      // First non-empty, non-comment line has to be the directive.
      const first = text.split("\n").map((l) => l.trim())
        .find((l) => l && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"));
      if (first !== '"use client";' && first !== "'use client';") bad.push(`${full} starts with: ${first}`);
    }
  };
  for (const dir of ["lib", "app", "components"]) walk(dir);
  check('"use client" is the first statement in every file that has it',
    bad.length === 0, bad.join("\n        "));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
