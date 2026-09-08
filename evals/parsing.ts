import { loadEnvLocal } from "@/lib/env";
loadEnvLocal();

import type { AgentDriver } from "@/lib/agent/types";
import { rulesDriver } from "@/lib/agent/rules";
import { anthropicTransport, createLlmDriver, type DriverStats } from "@/lib/agent/llm";
import { emptyBrief, type Brief, type Vibe } from "@/lib/types";
import { applyPatch } from "@/lib/brief";

/**
 * The scenario suite cannot tell the two drivers apart, because I wrote its
 * answers ("About a week.", "Around $2,000.") and unconsciously wrote them to
 * what my own regexes could already parse. Eleven of its thirteen metrics also
 * measure the deterministic planner, which both drivers share.
 *
 * This suite tests only the thing the drivers actually differ on: reading a
 * sentence a person would really type. Expectations are hand-labelled, so it
 * measures agreement with a human reading, which is the correct target.
 */
interface Case {
  input: string;
  days?: number;
  budgetAtMost?: number;
  budgetAtLeast?: number;
  wants?: Vibe[];
  rejects?: Vibe[];
  note: string;
}

const CASES: Case[] = [
  { input: "i wanna be in the nature without breaking the bank. i'm thinking for 3-4 days",
    days: 4, budgetAtMost: 2000, wants: ["nature"],
    note: "negation-shaped idiom that is not a negation of the vibe" },
  { input: "nature and adventure, mostly. Not a city trip.",
    wants: ["nature", "adventure"], rejects: ["city"],
    note: "explicit negative clause" },
  { input: "Eight days.", days: 8, note: "word numeral" },
  { input: "a fortnight", days: 14, note: "uncommon duration word" },
  { input: "I want wine and food but not museums", wants: ["food"], rejects: ["culture"],
    note: "contrastive negation mid-sentence" },
  { input: "just want to lie on a beach for 5 days", days: 5, wants: ["relaxation"],
    note: "implied climate and pace, no explicit vibe word" },
  { input: "take me somewhere beautiful", wants: ["nature"],
    note: "no vibe keyword at all" },
  { input: "i'm burnt out and need to switch off for a week", days: 7, wants: ["relaxation"],
    note: "emotional state as a pace request" },
  { input: "somewhere I can eat my way around for ten days, money no object",
    days: 10, budgetAtLeast: 3000, wants: ["food"],
    note: "idiomatic budget at the other end" },
  { input: "long weekend, nothing too strenuous, good restaurants",
    days: 4, wants: ["food"], rejects: ["adventure"],
    note: "implicit pace constraint" },
  { input: "two weeks, and I'd rather not be around crowds", days: 14,
    note: "preference stated as a mild negative" },
  { input: "we have 12 days in October and want museums and galleries", days: 12, wants: ["culture"],
    note: "plain, both drivers should get this" },
  { input: "somewhere warm for a week, nothing too expensive", days: 7,
    budgetAtMost: 2500, wants: ["relaxation"],
    note: "two idioms in one sentence" },
  { input: "I don't want another city break. Mountains, ideally.",
    wants: ["nature"], rejects: ["city"],
    note: "negation first, request second" },
  { input: "5 nights, mid-range, would like to walk a lot and eat well",
    days: 5, wants: ["food", "exploration"],
    note: "nights not days, plus a budget idiom" },
];

async function score(driver: AgentDriver) {
  let points = 0, possible = 0;
  const misses: string[] = [];

  for (const c of CASES) {
    const b: Brief = applyPatch(emptyBrief(c.input), await driver.interpret(c.input, emptyBrief(c.input)));
    const check = (label: string, ok: boolean) => {
      possible++;
      if (ok) points++;
      else misses.push(`${label}  "${c.input.slice(0, 48)}…"`);
    };
    if (c.days !== undefined) check(`days=${c.days} got ${b.days ?? "-"}`, b.days === c.days);
    if (c.budgetAtMost !== undefined) {
      check(`budget<=${c.budgetAtMost} got ${b.budgetUsd ?? "-"}`,
        b.budgetUsd !== undefined && b.budgetUsd <= c.budgetAtMost);
    }
    if (c.budgetAtLeast !== undefined) {
      check(`budget>=${c.budgetAtLeast} got ${b.budgetUsd ?? "-"}`,
        b.budgetUsd !== undefined && b.budgetUsd >= c.budgetAtLeast);
    }
    for (const v of c.wants ?? []) check(`wants ${v} got [${b.vibes}]`, b.vibes.includes(v));
    for (const v of c.rejects ?? []) check(`rejects ${v} got [${b.vibes}]`, !b.vibes.includes(v));
  }
  return { points, possible, misses };
}

(async () => {
  const key = process.env.ANTHROPIC_API_KEY;
  const drivers: [string, AgentDriver][] = [["rules", rulesDriver]];
  let stats: DriverStats | undefined;
  if (key) {
    const d = createLlmDriver(anthropicTransport(key));
    stats = d.stats;
    drivers.push(["llm", d]);
  }
  else console.log("\n  (no ANTHROPIC_API_KEY, scoring the rules driver only)");

  console.log(`\n  PARSING — ${CASES.length} phrasings a person would actually type`);
  console.log("  " + "─".repeat(64));

  const out: Record<string, { points: number; possible: number; misses: string[] }> = {};
  for (const [name, d] of drivers) out[name] = await score(d);

  for (const [name] of drivers) {
    const { points, possible } = out[name];
    const pct = Math.round((points / possible) * 100);
    console.log(`  ${name.padEnd(6)} ${"█".repeat(Math.round(pct / 5))}${"·".repeat(20 - Math.round(pct / 5))} ${String(pct).padStart(3)}%   ${points}/${possible} assertions`);
  }

  if (stats) {
    const used = stats.attempts - stats.fallbacks;
    console.log(`\n  Model answered ${used}/${stats.attempts} calls.`);
    if (used === 0) {
      console.log("  \x1b[31mThe llm row above is not an LLM result\x1b[0m — every call fell back.");
      if (stats.lastError) console.log(`  Last error: ${stats.lastError}`);
    } else if (stats.fallbacks) {
      console.log(`  \x1b[33m${stats.fallbacks} fell back.\x1b[0m ${stats.lastError ?? ""}`);
    }
  }

  for (const [name] of drivers) {
    if (!out[name].misses.length) continue;
    console.log(`\n  ${name} missed:`);
    for (const m of out[name].misses) console.log(`    ${m}`);
  }
  console.log();
})();
