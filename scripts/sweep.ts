import { ALL_VIBES, emptyBrief, type Vibe } from "@/lib/types";
import { recommend, scoreDestinations } from "@/lib/recommend";

// Every brief the chips can actually produce: duration x vibe subset x budget.
const DURATIONS = [4, 7, 10];           // the actual chip values
const BUDGETS = [900, 1500, 2500, 4000, undefined];
const subsets: Vibe[][] = [];
for (let mask = 1; mask < 1 << ALL_VIBES.length; mask++) {
  const s = ALL_VIBES.filter((_, i) => mask & (1 << i));
  if (s.length <= 3) subsets.push(s);          // realistic picks
}
subsets.push([]);                               // "surprise me"

const count = new Map<string, number>();
const byLen = new Map<number, Map<string, number>>();
let n = 0;
for (const days of DURATIONS) {
  byLen.set(days, new Map());
  for (const vibes of subsets) {
    for (const budgetUsd of BUDGETS) {
      const b = emptyBrief("");
      b.days = days; b.vibes = vibes;
      if (budgetUsd === undefined) b.flexibleBudget = true; else b.budgetUsd = budgetUsd;
      const id = recommend(b).destinationId;
      count.set(id, (count.get(id) ?? 0) + 1);
      byLen.get(days)!.set(id, (byLen.get(days)!.get(id) ?? 0) + 1);
      n++;
    }
  }
}
console.log(`${n} briefs (${subsets.length} vibe combos x ${DURATIONS.length} lengths x ${BUDGETS.length} budgets)\n`);
console.log("OVERALL");
for (const [id, c] of [...count].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id.padEnd(11)} ${String(c).padStart(4)}  ${(c / n * 100).toFixed(1).padStart(5)}%  ${"█".repeat(Math.round(c / n * 60))}`);
}
console.log("\nBY TRIP LENGTH");
for (const [days, m] of byLen) {
  const tot = [...m.values()].reduce((a, b) => a + b, 0);
  console.log(`  ${days}d: ` + [...m].sort((a, b) => b[1] - a[1])
    .map(([id, c]) => `${id} ${(c / tot * 100).toFixed(0)}%`).join("  "));
}
// How many destinations are even in play at each length?
console.log("\nAT 7 DAYS, BY BUDGET (what a tester actually varies)");
for (const budgetUsd of BUDGETS) {
  const m = new Map<string, number>();
  for (const vibes of subsets) {
    const b = emptyBrief(""); b.days = 7; b.vibes = vibes;
    if (budgetUsd === undefined) b.flexibleBudget = true; else b.budgetUsd = budgetUsd;
    const id = recommend(b).destinationId;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  const tot = [...m.values()].reduce((a, b) => a + b, 0);
  const label = budgetUsd === undefined ? "flexible" : "$" + budgetUsd;
  console.log(`  ${label.padEnd(9)} ` + [...m].sort((a, b) => b[1] - a[1])
    .map(([id, c]) => `${id} ${(c / tot * 100).toFixed(0)}%`).join("  "));
}

console.log("\nELIGIBLE AT EACH LENGTH");
for (const days of DURATIONS) {
  const b = emptyBrief(""); b.days = days;
  const live = scoreDestinations(b).filter((s) => !s.excluded).map((s) => s.id);
  console.log(`  ${days}d: ${live.length} — ${live.join(", ")}`);
}
