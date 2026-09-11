/**
 * Regression: the number you'd price on.
 *
 * Every figure in this project about what a trip costs was my estimate. That
 * is fine for a comment and useless for a decision, and pricing a product or
 * sizing a free allowance on a guess is how you find out you were wrong from
 * a bill. These are the API's own token counts, priced by a table we control.
 */
import { readFileSync } from "node:fs";
import { addUsage, emptyUsage, money, priceOf, usdFor } from "@/lib/cost";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mWHAT A TRIP COSTS\x1b[0m\n");

// A million tokens should cost exactly the table rate for whatever the
// default model is. Written against the table rather than against a number,
// because the first version of this test hardcoded Sonnet 4.5's $15 and broke
// the moment the default moved to a cheaper model, which is the test being
// wrong rather than the code.
const rate = priceOf("");
check("a million output tokens prices at the table rate",
  Math.abs(usdFor({ ...emptyUsage(), calls: 1, outputTokens: 1e6 }) - rate.output) < 1e-9,
  `$${usdFor({ ...emptyUsage(), calls: 1, outputTokens: 1e6 })} vs $${rate.output}`);
check("and a million in at the input rate",
  Math.abs(usdFor({ ...emptyUsage(), calls: 1, inputTokens: 1e6 }) - rate.input) < 1e-9);
check("cached input is far cheaper than fresh input",
  usdFor({ ...emptyUsage(), cacheReadTokens: 1e6 }) < usdFor({ ...emptyUsage(), inputTokens: 1e6 }) / 5);
check("web searches bill per search, not per token",
  Math.abs(usdFor({ ...emptyUsage(), searches: 1000 }) - 10) < 1e-9);

// A dated model snapshot must still price, or a model bump silently zeroes it.
check("a dated snapshot prices like its family",
  priceOf("claude-sonnet-4-5-20250929").output === priceOf("claude-sonnet-4-5").output);
check("and an unknown model falls back rather than costing nothing",
  priceOf("something-else-entirely").output > 0);

// Usage adds up across calls without losing a field.
{
  let u = emptyUsage();
  u = addUsage(u, { calls: 1, inputTokens: 100, outputTokens: 20, searches: 1 });
  u = addUsage(u, { calls: 1, inputTokens: 50, cacheReadTokens: 400 });
  check("usage accumulates every field",
    u.calls === 2 && u.inputTokens === 150 && u.outputTokens === 20
    && u.cacheReadTokens === 400 && u.searches === 1,
    JSON.stringify(u));
}

// Money at the scale this actually happens: rounding cents to 2dp shows "$0.00"
// for almost every real trip, which reads as broken.
check("a third of a cent is not displayed as zero", money(0.0034) !== "$0.00", money(0.0034));
check("cents are shown as cents", money(0.34) === "34¢", money(0.34));
check("dollars are shown as dollars", money(2.5) === "$2.50", money(2.5));
check("nothing is nothing", money(0) === "$0");

// The shape of a real researched trip, so a change in the call pattern that
// doubles the bill shows up here rather than on a statement.
{
  let u = emptyUsage();
  for (const [calls, i, o] of [[3, 3600, 750], [1, 900, 1400], [1, 2600, 4200], [3, 7800, 9000], [1, 1100, 900], [1, 1300, 1200]] as const) {
    u = addUsage(u, { calls, inputTokens: i, outputTokens: o });
  }
  const usd = usdFor(u);
  check("a researched twelve-day trip lands under a dollar", usd < 1, money(usd));
  check("and over a cent, or the measurement is broken", usd > 0.01, money(usd));
}

// The default model has to be one that still exists. Sonnet 4.5 retires from
// 29 September 2026 and retired models return errors, so a prototype pointed
// at one stops working on a date nobody wrote down.
check("the default model is priced, not falling through to a guess",
  priceOf("claude-sonnet-5").output === 10, `$${priceOf("claude-sonnet-5").output}`);
check("and a $5 Opus is not priced as a $15 one",
  priceOf("claude-opus-4-5").input === 5, `$${priceOf("claude-opus-4-5").input}`);
check("longest prefix wins, so opus-4-1 keeps its own price",
  priceOf("claude-opus-4-1").input === 15, `$${priceOf("claude-opus-4-1").input}`);
check("switching to Sonnet 5 is meaningfully cheaper than 4.5",
  usdFor({ ...emptyUsage(), outputTokens: 1e6 }, "claude-sonnet-5")
    < usdFor({ ...emptyUsage(), outputTokens: 1e6 }, "claude-sonnet-4-5") * 0.7);


/*
 * And the requests that ought to hit that cheaper rate actually ask for it.
 *
 * The cost table has priced cache reads at a fraction of fresh input since the
 * day it was written, and `record` has counted cache_read_input_tokens since
 * the day the transport was written. Neither of those makes a single cached
 * token happen: nothing ever set cache_control, so the well-priced path was
 * simply never taken, and an afternoon of seeding paid full price for the same
 * multi-thousand-token preamble on every one of three hundred calls.
 *
 * A request with no breakpoint is indistinguishable from a cached one at this
 * level -- same response shape, same fields, just a bigger bill -- so it is
 * asserted here rather than noticed later.
 *
 * The marker goes on the LAST cacheable block because it caches the prefix
 * before it: tools, then system, then messages. Marking the tool therefore
 * covers the system prompt too, and marking the system prompt as well would
 * spend a second of the four breakpoints to cache a strictly shorter prefix.
 */
{
  const src = readFileSync("lib/agent/llm.ts", "utf8");
  const call = src.slice(src.indexOf("async call({"), src.indexOf("async research({"));
  const research = src.slice(src.indexOf("async research({"));

  check("a tool call marks a cache breakpoint",
    /cache_control: CACHE/.test(call),
    "without one, the system prompt and tool schema are re-billed in full every call");
  check("and puts it on the tool, which caches the system prompt with it",
    /tools: \[\{ \.\.\.tool, cache_control: CACHE \}/.test(call)
    && !/system: cacheableSystem/.test(call),
    "tools come before system in the prefix, so one marker on the tool covers both");
  check("a research call marks its system prompt",
    /system: cacheableSystem\(system\)/.test(research),
    "there is no tool schema worth caching on this path, so the prompt is the last block");
  check("ephemeral, not some invented cache type",
    /const CACHE = \{ type: "ephemeral" as const \}/.test(src));
  check("and the counters that price it are still wired to the API's own fields",
    /cache_read_input_tokens/.test(src) && /cache_creation_input_tokens/.test(src),
    "a breakpoint with nothing reading the counts back is a saving nobody can see");
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
