/**
 * Regression: over the limit, it planned you a trip anyway.
 *
 * The allowance runs out and the server answers 429. The browser caught that,
 * quietly ran its own rules driver, and returned a complete itinerary built
 * from the seeded catalogue. Nothing on screen said the model had stopped
 * answering. It reads exactly like the product and it is not the product.
 *
 * Ashley's call, and it is the right one: no degraded mode. Stop, and say when
 * it comes back.
 *
 * Two details that matter as much as the behaviour. The wait is a clock time,
 * because "give it a few minutes" is not something a person can plan around
 * and the server already knows precisely when the window rolls. And nothing
 * anywhere suggests starting a new session: the limit is keyed on IP address,
 * so a new tab, a new trip and cleared storage all change nothing. Offering an
 * escape that doesn't work is the same class of bug as "say the word and I'll
 * try the Faroe Islands again".
 */
import { peek, RESEARCH_UNITS, charge } from "@/lib/guard";
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mOVER THE LIMIT, IT STOPS\x1b[0m\n");

// The budget check is free: asking must never consume what it is asking about.
{
  const id = `t${Date.now()}a`;
  const before = peek(1, id);
  check("a budget check is allowed when there is room", before.ok === true);
  for (let i = 0; i < 5; i++) peek(RESEARCH_UNITS, id);
  check("and asking five times changes nothing", peek(1, id).ok === true);
}

// A research run is four calls, and the check knows what the whole run costs.
{
  check("a research run is priced as a whole", RESEARCH_UNITS >= 20,
    `${RESEARCH_UNITS} units`);
  const id = `t${Date.now()}b`;
  check("with an empty allowance there is room for one", peek(RESEARCH_UNITS, id).ok === true);
}

// Spend it down, and the refusal carries a real reset rather than a shrug.
{
  const id = `t${Date.now()}c`;
  let spent = 0;
  for (let i = 0; i < 200; i++) {
    const v = charge("researchNotes", id);
    if (!v.ok) {
      check("running out is refused", true);
      check("with a reason", v.reason === "visitor", String(v.reason));
      check("and a real number of seconds to wait",
        typeof v.retryAfter === "number" && v.retryAfter > 0 && v.retryAfter <= 3600,
        `${v.retryAfter}s`);
      break;
    }
    spent++;
  }
  check("after a sane number of calls", spent > 0 && spent < 200, `${spent} calls`);
  check("and the pre-check agrees with the charge", peek(RESEARCH_UNITS, id).ok === false);
}

// The wiring, since the whole bug was one `return local(body)`.
{
  const client = readFileSync("lib/client.ts", "utf8");
  check("a 429 throws instead of answering from the rules driver",
    /throw new RateLimited\(/.test(client)
    && !/if \(res\.status === 429\)[\s\S]{0,400}return local<T>\(body\)/.test(client));
  check("and the catch-all does not swallow it",
    /if \(isRateLimited\(e\)\) throw e;/.test(client));

  const page = readFileSync("app/page.tsx", "utf8") + readFileSync("lib/flow.ts", "utf8");
  check("every path that can hit it says so",
    (page.match(/isRateLimited\(e\)/g) ?? []).length >= 4,
    `${(page.match(/isRateLimited\(e\)/g) ?? []).length} call sites`);
  check("research checks for room before starting",
    /const room = await agent\.budget\(\)/.test(page));
  check("the wait is a clock time",
    /toLocaleTimeString/.test(page));
  // Comments may explain why not; the copy may not offer it.
  const copy = page.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
  check("and nothing she reads suggests starting a new session",
    !/new session/i.test(copy));

  const route = readFileSync("app/api/agent/route.ts", "utf8");
  check("the 429 body no longer claims a working degraded mode",
    !/The planning still works/.test(route));
  check("and the budget action is outside the charge",
    /action === "budget"/.test(route));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
