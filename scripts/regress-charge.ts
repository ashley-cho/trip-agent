/**
 * Regression: the rate limiter charged for calls that cost nothing.
 *
 * With no ANTHROPIC_API_KEY, `resolveDriver()` returns the rules driver: no
 * network, no tokens, no bill. The route charged the visitor allowance anyway,
 * on arrival, before knowing whether anything would reach Anthropic. Sixty
 * units at one a turn is four or five test sessions, so an hour of local
 * testing ended with "That's my limit for the hour" from an app that had never
 * made an API call.
 *
 * `isLocalDev` did not save anyone: it is off under NODE_ENV=production, which
 * `next start` always sets, so the same wall hit testers on the deployment.
 * scripts/regress-render.ts has to raise TRIP_AGENT_VISITOR_UNITS to a million
 * to get two runs in an hour, which is the same bug wearing a workaround.
 *
 * What the allowance is for is written at the top of lib/guard.ts: it protects
 * one Anthropic bill. So it is spent when a model call is made, and only then.
 *
 * This file drives the real route both ways round. lib/guard.ts itself is
 * unchanged in behaviour and is still covered by regress-guard.ts and
 * regress-limit.ts — `charge` must keep charging, or the model-backed half
 * below stops being protected at all.
 */
import { POST } from "@/app/api/agent/route";
import { charge, costOf } from "@/lib/guard";
import { emptyBrief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

/*
 * A public request: not localhost, so `isLocalDev` is false whatever
 * NODE_ENV happens to be in this process. That is deliberate — the exemption
 * being unavailable is the condition the bug was reported under.
 */
const ask = (ip: string, action = "interpret") =>
  POST(new Request("https://trip-agent.example.com/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ action, input: "8 days in Portugal in October", brief: emptyBrief() }),
  }));

/** How many calls this visitor gets before the route refuses. */
async function until429(ip: string, cap: number): Promise<number> {
  for (let i = 0; i < cap; i++) {
    const res = await ask(ip);
    if (res.status === 429) return i;
  }
  return cap;
}

async function main() {
  console.log("\n\x1b[1mNO MODEL CALL, NO CHARGE\x1b[0m\n");

  // The allowance is read from the environment on every check, so it can be
  // made small enough to reach in a couple of seconds.
  process.env.TRIP_AGENT_VISITOR_UNITS = "3";
  const allowance = 3;

  check("an interpret costs something when it is charged at all",
    costOf("interpret") > 0, `${costOf("interpret")} units`);

  // --- 1. no key: nothing reaches Anthropic, so nothing is charged ---------
  {
    delete process.env.ANTHROPIC_API_KEY;
    const many = allowance * 8;
    const got = await until429("203.0.113.11", many);
    check(`with no key configured, ${many} requests are all answered`,
      got === many, `stopped after ${got}`);
  }

  // Several sessions from several addresses, which is the reported shape:
  // "four or five local test sessions in an hour".
  {
    delete process.env.ANTHROPIC_API_KEY;
    let refused = 0;
    for (let session = 0; session < 5; session++) {
      for (let turn = 0; turn < 12; turn++) {
        if ((await ask("203.0.113.12")).status === 429) refused++;
      }
    }
    check("five sessions of twelve turns from one address are never refused",
      refused === 0, `${refused} refusals`);
  }

  // The deployment's daily ceiling is charged from the same place, so it
  // must be untouched by rules traffic too.
  {
    delete process.env.ANTHROPIC_API_KEY;
    let refused = 0;
    for (let i = 0; i < 60; i++) {
      if ((await ask(`198.51.100.${i}`)).status === 429) refused++;
    }
    check("and a spray of fresh addresses does not eat the daily ceiling either",
      refused === 0, `${refused} refusals`);
  }

  // --- 2. a key: the allowance still bites, exactly as before --------------
  /*
   * The API is unreachable from here, so every one of these calls fails and
   * falls back to rules. That is on purpose: a call that reached Anthropic and
   * failed still cost tokens, so it must still be charged. If this ever passes
   * because nothing is charged, the fix has been taken too far and a public
   * URL is spending a real key for free.
   */
  {
    process.env.ANTHROPIC_API_KEY = "sk-ant-regress0000000000000000000000";
    const got = await until429("203.0.113.13", allowance * 3);
    check("with a key configured the visitor allowance still runs out",
      got > 0 && got <= allowance + 1, `${got} calls against an allowance of ${allowance}`);
    delete process.env.ANTHROPIC_API_KEY;
  }

  // --- 3. lib/guard.ts is untouched ---------------------------------------
  /*
   * The fix is in who calls `charge`, not in what `charge` does. If this stops
   * holding, regress-guard.ts and regress-limit.ts have been hollowed out from
   * underneath rather than left alone.
   */
  {
    process.env.TRIP_AGENT_VISITOR_UNITS = "5";
    const id = `guard-still-charges-${Date.now()}`;
    let n = 0;
    while (charge("interpret", id).ok && n < 50) n++;
    check("charge() itself still charges and still refuses",
      n === 5, `${n} calls before refusal`);
  }

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
