/**
 * Regression: what the screen says, on BOTH screens.
 *
 * No test in this repo imported anything from `components/`, and the audit
 * that found that also found what it cost: deleting `WhatYouShouldKnow` from
 * the itinerary — the caveat, the dates we picked, the place she ruled out
 * that we went to anyway, the simpler rooms — was invisible to all 953 checks.
 * The over-budget line had the identical bug and was only found by hand.
 *
 * These are source-level checks rather than a render harness, because the
 * thing that keeps going wrong is not a rendering bug: it is a paragraph that
 * exists on one screen and not the other, and the proposal is the screen
 * nobody stays on. What matters is that every explanation the concept can
 * carry is rendered by a component both screens mount.
 */
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mTHE SAME EXPLANATIONS ON BOTH SCREENS\x1b[0m\n");

const proposal = readFileSync("components/Proposal.tsx", "utf8");
const itinerary = readFileSync("components/Itinerary.tsx", "utf8");
const types = readFileSync("lib/types.ts", "utf8");

check("Proposal defines one shared explanation block",
  /export function WhatYouShouldKnow/.test(proposal));
check("the proposal renders it", /<WhatYouShouldKnow trip=\{trip\}/.test(proposal));
check("and so does the itinerary", /<WhatYouShouldKnow trip=\{trip\}/.test(itinerary));

/*
 * Every field on the concept whose whole purpose is to explain something to
 * her has to be read by that block. A new one is easy to add and easy to
 * render on one screen only, which is how this went wrong twice.
 */
const EXPLAINERS = ["caveat", "overrideNote", "dateNote", "trimmedForBudget", "paceShortfall"];
const block = proposal.slice(proposal.indexOf("export function WhatYouShouldKnow"),
  proposal.indexOf("export function Costs"));
for (const field of EXPLAINERS) {
  check(`${field} is in the shared block`, block.includes(`c.${field}`), block.length ? "" : "block not found");
}
check("and every explainer field on the concept is one of those",
  types.slice(types.indexOf("export interface TripConcept"), types.indexOf("export interface PassedOn"))
    .split("\n")
    .filter((l) => /Note\??:|Shortfall\??: string/.test(l))
    .every((l) => EXPLAINERS.some((f) => l.includes(f))),
  "a new *Note field on TripConcept has to be added to WhatYouShouldKnow and to this list");

/*
 * The over-budget paragraph lives in Costs, which both screens render — it was
 * in the proposal body, so the itinerary answered "keep it under $1,500" with
 * "Re-cut to $2,238 from $2,789" and never named the $1,500 again.
 */
const costs = proposal.slice(proposal.indexOf("export function Costs"));
check("the over-budget line lives in the Costs card, which both screens render",
  /budgetShortfallUsd > 0/.test(costs) && /<Costs trip=\{trip\}/.test(itinerary));
check("and it only says \"what you said\" about a number she said",
  /budgetStated === false/.test(costs));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
