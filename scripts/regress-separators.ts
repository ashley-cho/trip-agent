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
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { parseEditRules, applyOps } from "@/lib/edit";
import { activityWords } from "@/lib/select";
import { bareMonth } from "@/lib/dates";
import { detectVisited, interpretRules } from "@/lib/discovery";

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
    // "and" continues a refusal unless the next clause asks for something, and
    // "hot springs please" does. No separator is skipped here: the first
    // version of this file excused " and " with a comment about a DIFFERENT
    // string — one without the "please" — and that exclusion was hiding a live
    // failure in the month parser two blocks down.
    if (!activityWords(`no museums${sep}hot springs please`).includes("spr")) bad.push(label(sep));
  }
  check("a refusal doesn't swallow what follows it", bad.length === 0, bad.join(" "));
  // And the same phrase without a request after it still refuses both.
  check("'and' with nothing asked for after it keeps refusing",
    activityWords("no museums and late nights").length === 0,
    JSON.stringify(activityWords("no museums and late nights")));
}

// 4. A refused month, then the one she wants.
{
  let bad: string[] = [];
  for (const sep of SEPS) {
    if (bareMonth(`not august${sep}october please`) !== "October") bad.push(label(sep));
  }
  check("a refused month doesn't poison the one she named", bad.length === 0, bad.join(" "));
  // And two months refused together stay refused.
  check("'not august and september' refuses both",
    bareMonth("not august and september") === undefined,
    String(bareMonth("not august and september")));
}

// And the separators really are different code paths: a hyphen with no spaces
// is a word, not a break.
check("a hyphen inside a word is not a boundary",
  activityWords("step-free walking").includes("walk"), JSON.stringify(activityWords("step-free walking")));


/*
 * Every reader of a clause boundary, held to the same alphabet.
 *
 * Round five moved the rule into lib/clauses.ts and converted four readers.
 * Round six found three more that were never visited — `splitClauses`, the
 * requirement capture built on top of it, and the place scan inside
 * `detectVisited` — plus a fourth where the alphabet was right and the input
 * had already been flattened (`detectVisited` rejoined lines with a space, so
 * "\n" never reached anything).
 *
 * Fixing them one at a time is what produced three rounds of the same bug. So
 * this asserts the property directly: for a message built with ANY separator,
 * every reader has to see two clauses.
 */
console.log("\n\x1b[1mEVERY READER OF A CLAUSE BOUNDARY AGREES\x1b[0m\n");
{
  /*
   * Behavioural, not structural: what matters is that the thing on the far
   * side of the separator reaches the field it belongs in. "and" is excluded
   * only where it changes the MEANING rather than the parsing — after a
   * refusal it continues the refusal, which is a different question, covered
   * by its own checks above.
   */
  const READERS: [string, (sep: string) => boolean, boolean][] = [
    ["a refusal after it becomes an avoidPlace", (sep) => {
      const text = `portugal 9 days${sep}not Porto${sep}i want lots of food`;
      const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
      return (b.avoidPlaces ?? []).some((x) => /porto/i.test(x));
    }, true],
    ["a requirement after it reaches the brief", (sep) => {
      const text = `iceland 8 days${sep}it must be wheelchair accessible`;
      const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
      return b.constraints.some((c) => /wheelchair/i.test(c) && c.split(/\s+/).length <= 6);
    }, true],
    ["detectVisited hands the rest on with the boundary intact", (sep) => {
      // It runs first on every message, including ones with no cue in them, so
      // whatever it hands downstream still has to carry the break.
      const text = `portugal 9 days${sep}not Porto`;
      return detectVisited(text).rest.includes(sep.trim() || "\n");
    }, true],
    ["a request after a refusal survives", (sep) =>
      activityWords(`no museums${sep}hot springs please`).includes("spr"), false],
    ["a refused month doesn't take the next one with it", (sep) =>
      bareMonth(`not august${sep}october please`) === "October", false],
  ];
  for (const [name, reads, includeAnd] of READERS) {
    const missed = SEPS.filter((sep) => (includeAnd || sep !== " and ") && !reads(sep));
    check(`${name}, whatever she typed between them`, missed.length === 0,
      missed.map(label).join(" "));
  }
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
