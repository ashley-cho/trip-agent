import { loadEnvLocal } from "@/lib/env";
loadEnvLocal();

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentDriver } from "@/lib/agent/types";
import { runScenario, type ScenarioResult } from "./scenario-run";
import { METRIC_LABELS, type Scores } from "./metrics";
import { rulesDriver } from "@/lib/agent/rules";
import { deadDriver } from "./dead";
import { createLlmDriver, anthropicTransport, type DriverStats } from "@/lib/agent/llm";
import { SCENARIOS, type Scenario } from "./scenarios";
import { DESTINATIONS } from "@/data/destinations";

// --- reporting -------------------------------------------------------------

const bar = (v: number) => {
  const n = Math.round(v * 10);
  return "█".repeat(n) + "·".repeat(10 - n);
};
const pct = (v: number) => (v * 100).toFixed(0).padStart(3) + "%";

/*
 * A column is the mean of the cells that ARE numbers.
 *
 * Since the harness runs lib/flow.ts, a scenario can end with no itinerary —
 * that is what most of the guards in that file are for — and the twenty
 * metrics that read a Trip have nothing to read on such a row. Averaging a 0
 * in would say the app built a bad trip; averaging a 1 in would say it built a
 * good one. Both are false, so the cell is dropped and the count of dropped
 * cells is printed next to the column. `outcome_fidelity` is the column that
 * cannot be dropped, and it is what stops a refusal being free.
 */
function report(driverName: string, results: ScenarioResult[], baseline?: Record<string, number>) {
  const keys = Object.keys(results[0].scores);
  const agg: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  for (const k of keys) {
    const live = results.map((r) => r.scores[k]).filter((m) => m && !m.na);
    skipped[k] = results.length - live.length;
    agg[k] = live.length ? live.reduce((s, m) => s + m.score, 0) / live.length : 1;
  }
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
    const note = skipped[k] ? `   (${skipped[k]} n/a)` : "";
    console.log(`  ${label} ${bar(agg[k])} ${pct(agg[k])}${delta}${note}`);
  }
  console.log(`  ${"─".repeat(66)}`);
  console.log(`  ${"OVERALL".padEnd(24)} ${bar(overall)} ${pct(overall)}`);

  console.log(`\n  Per scenario`);
  console.log(`  ${"─".repeat(66)}`);
  for (const r of results) {
    console.log(`  ${r.id.padEnd(20)} ${r.destination.padEnd(11)} ${r.questions}q  ${pct(r.mean)}`);
    for (const [k, m] of Object.entries(r.scores)) {
      if (m.na) console.log(`      ${(METRIC_LABELS[k] ?? k).padEnd(22)}  n/a  ${m.raw}`);
      else if (m.score < 0.999) console.log(`      ${(METRIC_LABELS[k] ?? k).padEnd(22)} ${pct(m.score)}  ${m.raw}`);
    }
  }
  console.log();
  return { agg, overall };
}

/**
 * The same scenario shapes, run at every destination we hold, reporting the
 * WORST one per metric.
 *
 * The scorecard above is a mean over fourteen scenarios, and the recommender
 * only ever sends those fourteen to seven of the fifteen destinations. So
 * eight catalogues have never been scored at all, and the seven that have are
 * averaged together — which is the failure mode this exists for: one country
 * whose places are all closed on Tuesdays, or whose only two cities are four
 * hours apart, disappears into a 98% that is carried by Portugal.
 *
 * A mean is reported alongside each worst case, and it is there to be ignored.
 * The number that matters is the low one and the name next to it.
 *
 * `destination_fidelity` is dropped: the sweep pins the destination, so the
 * metric that asks whether we went where she said is answering a question
 * nobody asked here and would read 0% on fourteen of fifteen rows.
 */
async function sweep(driver: AgentDriver, scenarios: Scenario[]) {
  const ids = DESTINATIONS.map((d) => d.id);
  console.log(`\n  DESTINATION SWEEP — ${scenarios.length} scenarios × ${ids.length} destinations\n`);

  /** metric -> destination -> [scenario id, score]. */
  const cell: Record<string, Record<string, [string, number][]>> = {};
  const failures: string[] = [];
  for (const at of ids) {
    for (const sc of scenarios) {
      let r: ScenarioResult;
      try {
        r = await runScenario(driver, sc, undefined, { at });
      } catch (e) {
        // A destination that cannot be planned at all is the loudest possible
        // result, and swallowing it into a missing row would hide it.
        failures.push(`${at}/${sc.id}: ${(e as Error).message}`);
        continue;
      }
      for (const [k, m] of Object.entries(r.scores)) {
        if (k === "destination_fidelity") continue;
        // A cell with nothing in it is not a zero and not a hundred. See
        // Metric.na — under the sweep this is close to empty, because the pin
        // forces a plan, but a destination that genuinely cannot be planned
        // shows up as a row that is thin rather than as a row that is green.
        if (m.na) continue;
        ((cell[k] ??= {})[at] ??= []).push([sc.id, m.score]);
      }
    }
    process.stdout.write(`  ${at} `);
  }
  console.log("\n");

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  console.log(`  ${"metric".padEnd(24)} ${"worst".padEnd(13)} ${"score".padStart(5)}   ${"mean".padStart(5)}   worst single run`);
  console.log(`  ${"─".repeat(80)}`);
  for (const k of Object.keys(cell)) {
    const byDest = Object.entries(cell[k]).map(([at, xs]) => [at, mean(xs.map((x) => x[1]))] as const)
      .sort((a, b) => a[1] - b[1]);
    if (!byDest.length) {
      console.log(`  ${(METRIC_LABELS[k] ?? k).padEnd(24)} ${"— not scored".padEnd(13)}`);
      continue;
    }
    const [worstId, worstV] = byDest[0];
    const all = mean(byDest.map(([, v]) => v));
    /*
     * A metric on which every destination scores the same has no worst
     * destination, and printing whichever one happens to sort first invents a
     * finding. Say tied.
     */
    const tied = byDest.every(([, v]) => Math.abs(v - worstV) < 0.005);
    const run = Object.entries(cell[k]).flatMap(([at, xs]) => xs.map(([id, v]) => [`${at}/${id}`, v] as const))
      .sort((a, b) => a[1] - b[1])[0];
    console.log(`  ${(METRIC_LABELS[k] ?? k).padEnd(24)} ${(tied ? "— all tied" : worstId).padEnd(13)} ${pct(worstV)}   ${pct(all)}   ${run[1] < 0.999 ? `${run[0]} ${pct(run[1])}` : ""}`);
  }

  // And the same question asked the other way round: which catalogue is worst
  // overall. A destination that is mediocre on every metric never owns a row
  // above, and is still the one nobody should be sent to.
  const dests = ids.map((at) => {
    const vals = Object.keys(cell).map((k) => mean((cell[k][at] ?? []).map((x) => x[1])));
    return [at, mean(vals)] as const;
  }).sort((a, b) => a[1] - b[1]);
  console.log(`\n  ${"worst destinations overall".padEnd(24)}`);
  console.log(`  ${"─".repeat(74)}`);
  // One decimal here, because five destinations inside a point of each other
  // all print as "95%" and the ordering looks arbitrary.
  for (const [at, v] of dests.slice(0, 5)) {
    console.log(`  ${at.padEnd(24)} ${bar(v)} ${(v * 100).toFixed(1)}%`);
  }
  if (failures.length) {
    console.log(`\n  \x1b[31m${failures.length} scenario(s) threw:\x1b[0m`);
    for (const f of failures.slice(0, 10)) console.log(`    ${f}`);
  }
  console.log();
}

// --- entry -----------------------------------------------------------------

(async () => {
  const args = process.argv.slice(2);
  const wantLlm = args.includes("--llm");
  const save = args.includes("--save-baseline");
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];

  /*
   * --dead: the app with no model at all, which is not the same thing as the
   * rules driver. See evals/dead.ts. The rules driver answers everything it
   * can; a deployment out of credit refuses the four comprehension actions
   * outright, so the scorecard under --dead is the one that describes what a
   * visitor actually gets when the balance is zero.
   */
  const wantDead = args.includes("--dead");
  let driver: AgentDriver = wantDead ? deadDriver() : rulesDriver;
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

  // A separate mode: 15× the work, so it never runs as part of the normal
  // scorecard.
  if (args.includes("--sweep")) { await sweep(driver, scenarios); process.exit(0); }

  const results: ScenarioResult[] = [];
  for (const sc of scenarios) results.push(await runScenario(driver, sc));

  const baseFile = join(process.cwd(), "evals", `baseline.${driver.name}.json`);
  const baseline = existsSync(baseFile) && !save
    ? (JSON.parse(readFileSync(baseFile, "utf8")).agg as Record<string, number>)
    : undefined;

  const { agg, overall } = report(driver.name, results, baseline);

  /*
   * How often it held.
   *
   * Kept out of the metric table on purpose: every column there is "how good
   * was the trip", scored over the rows that produced one. This is the other
   * question, and averaging it in would hide both. A run where two scenarios
   * in thirty produce a superb itinerary scores the same as one where thirty
   * do, and only this line tells them apart.
   */
  {
    const planned = results.filter((r) => r.trip && (r.trip.days?.length ?? 0) > 0).length;
    const pctHeld = Math.round((planned / results.length) * 100);
    console.log(`  HELD                     ${bar(planned / results.length)} ${String(pctHeld).padStart(3)}%`
      + `   ${planned}/${results.length} conversations ended with an itinerary`);
    if (driver.name === "dead") {
      console.log(`  ${results.length - planned} stopped rather than answer from pattern matching.`);
    }
    console.log("  ──────────────────────────────────────────────────────────────────");
  }

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
