import { loadEnvLocal } from "@/lib/env";
loadEnvLocal();

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentDriver } from "@/lib/agent/types";
import { runScenario, type ScenarioResult } from "./scenario-run";
import { METRIC_LABELS, type Scores } from "./metrics";
import { rulesDriver } from "@/lib/agent/rules";
import { createLlmDriver, anthropicTransport, type DriverStats } from "@/lib/agent/llm";
import { SCENARIOS, type Scenario } from "./scenarios";

// --- reporting -------------------------------------------------------------

const bar = (v: number) => {
  const n = Math.round(v * 10);
  return "█".repeat(n) + "·".repeat(10 - n);
};
const pct = (v: number) => (v * 100).toFixed(0).padStart(3) + "%";

function report(driverName: string, results: ScenarioResult[], baseline?: Record<string, number>) {
  const keys = Object.keys(results[0].scores);
  const agg: Record<string, number> = {};
  for (const k of keys) agg[k] = results.reduce((s, r) => s + (r.scores[k]?.score ?? 0), 0) / results.length;
  const overall = Object.values(agg).reduce((a, b) => a + b, 0) / keys.length;

  console.log(`\n  TRIP AGENT — EVAL SCORECARD      driver: ${driverName}`);
  console.log(`  ${"─".repeat(66)}`);
  for (const k of keys) {
    const label = (METRIC_LABELS[k] ?? k).padEnd(24);
    let delta = "";
    if (baseline && baseline[k] !== undefined) {
      const d = agg[k] - baseline[k];
      delta = Math.abs(d) < 0.005 ? "     ·" : `  ${d > 0 ? "+" : "−"}${(Math.abs(d) * 100).toFixed(0).padStart(2)}%`;
    }
    console.log(`  ${label} ${bar(agg[k])} ${pct(agg[k])}${delta}`);
  }
  console.log(`  ${"─".repeat(66)}`);
  console.log(`  ${"OVERALL".padEnd(24)} ${bar(overall)} ${pct(overall)}`);

  console.log(`\n  Per scenario`);
  console.log(`  ${"─".repeat(66)}`);
  for (const r of results) {
    console.log(`  ${r.id.padEnd(20)} ${r.destination.padEnd(11)} ${r.questions}q  ${pct(r.mean)}`);
    for (const [k, m] of Object.entries(r.scores)) {
      if (m.score < 0.999) console.log(`      ${(METRIC_LABELS[k] ?? k).padEnd(22)} ${pct(m.score)}  ${m.raw}`);
    }
  }
  console.log();
  return { agg, overall };
}

// --- entry -----------------------------------------------------------------

(async () => {
  const args = process.argv.slice(2);
  const wantLlm = args.includes("--llm");
  const save = args.includes("--save-baseline");
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];

  let driver: AgentDriver = rulesDriver;
  let stats: DriverStats | undefined;
  if (wantLlm) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      console.error("\n  --llm needs ANTHROPIC_API_KEY. Put it in .env.local or export it.\n");
      process.exit(2);
    }
    const d = createLlmDriver(anthropicTransport(key));
    driver = d;
    stats = d.stats;
  }

  // A scenario marked llm-only is skipped under the rules driver rather than
  // failing it forever: the rules parser has no typo tolerance by design, and
  // a permanent red is a red nobody reads.
  const scenarios = (only ? SCENARIOS.filter((s) => s.id === only) : SCENARIOS)
    .filter((s) => !s.onlyDriver || s.onlyDriver === driver.name);
  if (!scenarios.length) { console.error(`no scenario "${only}"`); process.exit(2); }

  const results: ScenarioResult[] = [];
  for (const sc of scenarios) results.push(await runScenario(driver, sc));

  const baseFile = join(process.cwd(), "evals", `baseline.${driver.name}.json`);
  const baseline = existsSync(baseFile) && !save
    ? (JSON.parse(readFileSync(baseFile, "utf8")).agg as Record<string, number>)
    : undefined;

  const { agg, overall } = report(driver.name, results, baseline);

  // A score is only an LLM score if the model actually answered. Without this,
  // an unreachable API produced a confident "driver: llm" scorecard that was
  // entirely the rules driver.
  if (stats) {
    const used = stats.attempts - stats.fallbacks;
    const pct = stats.attempts ? Math.round((used / stats.attempts) * 100) : 0;
    console.log(`  Model answered ${used}/${stats.attempts} calls (${pct}%).`);
    if (stats.fallbacks > 0) {
      console.log(`  \x1b[33m${stats.fallbacks} fell back to the rules driver.\x1b[0m`);
      if (stats.lastError) console.log(`  Last error: ${stats.lastError}`);
    }
    if (used === 0) {
      console.log("\n  \x1b[31mThis is NOT an LLM result.\x1b[0m Every call failed and fell back.");
      console.log("  The numbers above are the rules driver. Fix the errors and re-run.\n");
      process.exit(3);
    }
    if (pct < 90) {
      console.log("  \x1b[33mTreat this as a partial result.\x1b[0m\n");
    } else console.log();
  }

  // Expected-destination assertions are separate from scoring: a wrong
  // destination is a bug, not a soft metric.
  let failures = 0;
  for (const sc of scenarios) {
    if (!sc.expectDestination) continue;
    const got = results.find((r) => r.id === sc.id)!.destination;
    const want = Array.isArray(sc.expectDestination) ? sc.expectDestination : [sc.expectDestination];
    if (!want.includes(got)) {
      console.log(`  ✗ ${sc.id}: expected ${want.join(" or ")}, got ${got}`);
      failures++;
    }
  }
  if (failures) console.log();

  if (save) {
    mkdirSync(join(process.cwd(), "evals"), { recursive: true });
    writeFileSync(baseFile, JSON.stringify({ agg, overall, at: new Date().toISOString() }, null, 2));
    console.log(`  baseline saved → ${baseFile}\n`);
  }
  process.exit(failures ? 1 : 0);
})();
