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
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { interpretRules } from "@/lib/discovery";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";

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
const EXPLAINERS = ["caveat", "overrideNote", "dateNote", "unenforcedNote", "trimmedForBudget", "paceShortfall"];
// `knowLines` gathers the fields; `WhatYouShouldKnow` renders them and both
// screens use `knowLines` to decide whether the section exists at all.
const block = proposal.slice(proposal.indexOf("export function knowLines"),
  proposal.indexOf("export function WhatYouShouldKnow"));
for (const field of EXPLAINERS) {
  check(`${field} is in the shared block`, block.includes(`c.${field}`), block.length ? "" : "block not found");
}
check("both screens hide the section when there is nothing to say",
  /knowLines\(trip\)\.length > 0 &&/.test(proposal) && /knowLines\(trip\)\.length > 0 &&/.test(itinerary));
check("and every explainer field on the concept is one of those",
  types.slice(types.indexOf("export interface TripConcept"), types.indexOf("export interface PassedOn"))
    .split("\n")
    .filter((l) => /Note\??:|Shortfall\??: string/.test(l))
    .every((l) => EXPLAINERS.some((f) => l.includes(f))),
  "a new *Note field on TripConcept has to be added to WhatYouShouldKnow and to this list");

/*
 * The over-budget sentence lives in CostLine, the one cost line both screens
 * render — it was in the proposal body, so the itinerary answered "keep it
 * under $1,500" with "Re-cut to $2,238 from $2,789" and never named the
 * $1,500 again. The breakdown card is gone; the line is the only place cost
 * is mentioned on either screen.
 */
const costs = proposal.slice(proposal.indexOf("export function CostLine"));
check("the over-budget line lives in CostLine, which both screens render",
  /budgetShortfallUsd > 0/.test(costs) && /<CostLine trip=\{trip\}/.test(itinerary) && /<CostLine trip=\{trip\}/.test(proposal));
check("and it only says \"what you said\" about a number she said",
  /budgetStated === false/.test(costs));
check("and cost is said once per screen",
  (proposal.match(/estimateUsd/g) ?? []).length === 1 && !/estimateUsd/.test(itinerary));


console.log("\n\x1b[1mAND A REFUSAL WE CANNOT CHECK IS SAID OUT LOUD\x1b[0m\n");
{
  /*
   * `constraints` holds her refusals verbatim. Anything in one that maps to
   * one of the 28 avoidTags is enforced by the planner and the critic; the
   * rest reached nothing — identical itineraries with and without it on 15 of
   * 15 destinations. Worse, the parser only recorded the clause at all when it
   * ALSO produced a tag or a place, so "no more than two hours' driving a day"
   * reached the brief as nothing whatsoever.
   */
  const TODAY = new Date("2026-09-09T00:00:00Z");
  const plan = (text: string) => {
    const b0 = emptyBrief(text);
    const b = applyPatch(b0, interpretRules(text, b0)) as Brief;
    return { brief: b, trip: planTrip(b, recommend(b), emptyProfile(), { today: TODAY }) };
  };
  for (const text of ["portugal for 9 days, no more than two hours driving a day",
    "japan for 9 days, nothing that needs booking months ahead"]) {
    const { brief, trip } = plan(text);
    check(`"${text.slice(-38)}" survives the parser`, brief.constraints.length > 0,
      JSON.stringify(brief.constraints));
    check("  and the card says we can't check it",
      !!trip.concept.unenforcedNote, trip.concept.unenforcedNote ?? "(none)");
  }
  /*
   * A requirement does not have to be phrased as a refusal. Constraints came
   * from negated clauses only, so "it must be step free" — this feature's own
   * headline example — reached the brief as nothing at all: not stored, not
   * sent to the model, not on the card.
   */
  for (const text of ["portugal for 9 days, it must be step free",
    "portugal for 9 days, only direct flights",
    "portugal for 9 days, at least two nights in each place"]) {
    const { brief, trip } = plan(text);
    check(`"${text.slice(22)}" survives`, brief.constraints.length > 0, JSON.stringify(brief.constraints));
    check("  and is named on the card", !!trip.concept.unenforcedNote,
      trip.concept.unenforcedNote?.slice(0, 70) ?? "(none)");
    check("  without the destination stuck to the front of it",
      !/portugal/i.test(trip.concept.unenforcedNote ?? ""), trip.concept.unenforcedNote ?? "");
  }

  /*
   * And not the ones we DID act on. The requirement regex catches any sentence
   * with "need", "only" or "have to" in it, so "i only have 5 days" and "it
   * has to be somewhere warm" were captured, acted on, and then disclaimed on
   * the card as things we could not check — and "i have to say this looks
   * great" was read back to her as a constraint.
   */
  for (const text of ["portugal, i only have 5 days",
    "portugal, it has to be somewhere warm",
    "portugal 9 days, i have to say this looks great",
    "portugal 9 days, i need a break"]) {
    const { trip } = plan(text);
    check(`"${text.slice(10)}" is not disclaimed`,
      trip.concept.unenforcedNote === undefined, trip.concept.unenforcedNote ?? "");
  }

  // One we DO enforce is not confessed to.
  check("a refusal the planner enforces is not apologised for",
    plan("portugal for 9 days, no museums").trip.concept.unenforcedNote === undefined,
    plan("portugal for 9 days, no museums").trip.concept.unenforcedNote ?? "");
  /*
   * And a figure of speech is not a requirement. "somewhere that looks nothing
   * like home" is a negated clause and reading it back as a rule we cannot
   * check is worse than saying nothing.
   */
  check("a figure of speech is not read back as a constraint",
    plan("i want to go somewhere that looks nothing like home, 9 days")
      .trip.concept.unenforcedNote === undefined,
    plan("i want to go somewhere that looks nothing like home, 9 days")
      .trip.concept.unenforcedNote ?? "");
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
