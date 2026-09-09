/**
 * Regression: a dash is a clause boundary.
 *
 * Four modules had each learned, separately, to scope a rule to the clause
 * that carries it — the "already been" veto, the more/less polarity in an
 * edit, the refusal in an activity phrase, the month a refusal governs. All
 * four split on commas, full stops, "and" and "but". None split on the
 * punctuation people actually type, so every one of those fixes had the same
 * hole and the same criticals came back through a hyphen:
 *
 *   "fewer museums - more food"                  deleted every restaurant, 15/15
 *   "i've been to bali - i want somewhere new"   recommended Bali, 15/15
 *   "no museums - hot springs please"            asked for nothing at all
 *   "not august - october please"                planned August
 *
 * A dash is her own style: the message the oldest test in this repo is built
 * on is "i wanna go on a road trip - i've been to bryce canyon...".
 *
 * The rule lives in lib/clauses.ts now, and this file holds every reader of it
 * to the same behaviour across every separator, so the next one to learn
 * clause scoping cannot learn it with a different alphabet.
 */
import { emptyBrief, emptyProfile, type Brief, type Trip } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { interpretRules } from "@/lib/discovery";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { parseEditRules, applyOps } from "@/lib/edit";
import { activityWords } from "@/lib/select";
import { bareMonth } from "@/lib/dates";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mEVERY SEPARATOR SHE MIGHT TYPE\x1b[0m\n");

/** Every way a person separates two thoughts in one message. */
const SEPS = [". ", ", ", "; ", " - ", " — ", " – ", ": ", " / ", "\n", " & ", " and "];
const label = (s: string) => JSON.stringify(s);

// 1. A ban and a request in one message.
{
  let bad: string[] = [];
  for (const sep of SEPS) {
    const text = `i've been to bali${sep}i want somewhere new`;
    const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
    if (recommend(b).destinationId === "bali") bad.push(label(sep));
  }
  check("a ban followed by a request never sends her back", bad.length === 0, bad.join(" "));
}

// 2. Less of one thing, more of another.
{
  const brief = applyPatch(emptyBrief(), {
    namedDestination: "portugal", days: 8, month: "October",
  }) as Brief;
  const trip: Trip = planTrip(brief, recommend(brief), emptyProfile());
  let bad: string[] = [];
  for (const sep of SEPS) {
    const r = applyOps(trip, parseEditRules(`fewer museums${sep}more food`, trip), brief, emptyProfile());
    if (r.brief.avoidTags.includes("food" as never)) bad.push(label(sep));
  }
  check("what she asks for is never deleted as what she refused", bad.length === 0, bad.join(" "));
}

// 3. A refusal, then a request.
{
  let bad: string[] = [];
  for (const sep of SEPS) {
    if (sep === " and ") continue;   // "no museums and hot springs" refuses both
    if (!activityWords(`no museums${sep}hot springs please`).includes("spr")) bad.push(label(sep));
  }
  check("a refusal doesn't swallow what follows it", bad.length === 0, bad.join(" "));
}

// 4. A refused month, then the one she wants.
{
  let bad: string[] = [];
  for (const sep of SEPS) {
    if (sep === " and ") continue;   // "not august and october" refuses both
    if (bareMonth(`not august${sep}october please`) !== "October") bad.push(label(sep));
  }
  check("a refused month doesn't poison the one she named", bad.length === 0, bad.join(" "));
}

// And the separators really are different code paths: a hyphen with no spaces
// is a word, not a break.
check("a hyphen inside a word is not a boundary",
  activityWords("step-free walking").includes("walk"), JSON.stringify(activityWords("step-free walking")));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
