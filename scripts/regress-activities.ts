/**
 * What she wants to DO, in her words, one entry per thing.
 *
 * `vibes` is a closed seven-value taxonomy and it does real work: measured on
 * a fixed destination, a single vibe changes seven to twenty items out of
 * fifty, and across the catalogue the rankings are distinct and sensible
 * (nature to New Zealand, food to Italy, relaxation to Bali). The problem was
 * never that vibes carry no information. It is that they are lossy AND they
 * were sole: surfing, via ferrata and birding all compress to "adventure", and
 * the compressed form was the only thing that survived the front door.
 *
 * "i wanna go to portugal for surfing" returned a Lisbon and Porto city break:
 * Alfama, Sao Jorge Castle, pastel de nata. Nothing in the catalogue mentions
 * surf, Portugal is held so no research runs, and nothing anywhere noticed
 * that the one thing she asked for was absent.
 *
 * activities is the channel that keeps the original. Open vocabulary, on
 * purpose: the moment it is a fixed list, the next word she types falls off
 * it. It replaces interestEcho, which held the same content as one prose blob
 * accumulated with "; " and truncated at 240 characters from the middle.
 */
import { applyPatch, interestLine } from "@/lib/brief";
import { emptyBrief } from "@/lib/types";
import type { Brief } from "@/lib/types";
import { readFileSync } from "node:fs";
import { activityWords, servesActivity, unserved } from "@/lib/select";
import type { Place } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  activities\n");

// --- it accumulates, and never shortens ----------------------------------
{
  let b: Brief = emptyBrief("i wanna go to portugal for surfing");
  b = applyPatch(b, { activities: ["surfing"] });
  check("her word is kept as she typed it",
    JSON.stringify(b.activities) === JSON.stringify(["surfing"]), JSON.stringify(b.activities));

  b = applyPatch(b, { activities: ["eat well"] });
  check("a second thing is added, not substituted",
    (b.activities ?? []).length === 2, JSON.stringify(b.activities));

  b = applyPatch(b, { activities: ["surfing, ideally beginner breaks"] });
  check("a fuller wording replaces the thinner one rather than duplicating",
    (b.activities ?? []).length === 2 && b.activities!.some((x) => /beginner breaks/.test(x)),
    JSON.stringify(b.activities));

  b = applyPatch(b, { vibes: ["culture"] });
  check("an unrelated patch does not disturb it", (b.activities ?? []).length === 2);
}
{
  // The northern-lights case that made the old merge necessary in the first
  // place: a later message must not overwrite an earlier one.
  let b: Brief = emptyBrief("i wanna see the northern lights");
  b = applyPatch(b, { activities: ["see the northern lights"] });
  b = applyPatch(b, { activities: ["nature and city"] });
  check("a later message never erases an earlier one",
    b.activities!.some((x) => /northern lights/.test(x)), JSON.stringify(b.activities));
}
{
  // 40 messages. The old field capped at 240 chars and dropped from the middle.
  let b: Brief = emptyBrief("x");
  for (let i = 0; i < 40; i++) b = applyPatch(b, { activities: [`thing number ${i}`] });
  check("forty things all survive; nothing is truncated to fit",
    (b.activities ?? []).length === 40, `${(b.activities ?? []).length} kept`);
}

// --- and it reaches the researcher ---------------------------------------
{
  const b: Brief = { ...emptyBrief("x"), activities: ["surfing", "eat well"], vibes: ["adventure"] as any };
  const line = interestLine(b);
  check("interestLine leads with her words, not our tags",
    line.startsWith("surfing; eat well"), line);
  check("and still carries the vibes behind them", /interested in adventure/.test(line), line);
}

// --- the model is asked for it, and told why -----------------------------
{
  const llm = readFileSync("lib/agent/llm.ts", "utf8");
  check("the interpret schema asks for activities, as an array",
    /activities: \{\s*\n\s*type: "array"/.test(llm));
  check("and tells the model our vibes lose it",
    /if you only fill vibes the thing they asked for stops existing/.test(llm));
  check("interest_echo is still accepted, so an older reply loses nothing",
    /raw\.interest_echo/.test(llm));
  check("interestEcho is gone as a stored field",
    !/interestEcho/.test(readFileSync("lib/types.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")));
}

console.log("\n\x1b[1mA REFUSAL GOVERNS ITS CLAUSE, NOT THE SENTENCE\x1b[0m\n");
{
  /*
   * "no early starts, markets please" used to produce nothing at all: the
   * cut happened at the first refusal word in the whole string, and "no" is
   * at index 0. She said markets and the app kept none of it — no match, and
   * not even reported as unserved, which is the one failure mode this path
   * exists to prevent.
   */
  const w = (s: string) => activityWords(s);
  check("a refusal in front doesn't eat what comes after it",
    w("no early starts, markets please").includes("market"), JSON.stringify(w("no early starts, markets please")));
  check("and the refused thing is still refused",
    !w("no early starts, markets please").some((x) => "early".startsWith(x) || x === "start"),
    JSON.stringify(w("no early starts, markets please")));
  check("'but' separates clauses too",
    w("hiking but no crowds").includes("hik") && !w("hiking but no crowds").includes("crowd"),
    JSON.stringify(w("hiking but no crowds")));
  check("a sentence that only refuses still yields nothing",
    w("no wine, i hate wine").length === 0, JSON.stringify(w("no wine, i hate wine")));
  check("and a plain request is untouched",
    w("i want to go to portugal for the wine").includes("win"));
  check("politeness is not an activity",
    !w("markets please, thanks").includes("pleas"), JSON.stringify(w("markets please, thanks")));

  // The matcher has to agree with the words, or the fix stops at the parser.
  const markets = { id: "x", name: "Mercado da Ribeira", tags: ["market"], skip: false } as unknown as Place;
  check("a market still serves 'no early starts, markets please'",
    servesActivity(markets, "no early starts, markets please"));
  check("and nothing is reported unserved when it is served",
    unserved([markets], ["no early starts, markets please"]).length === 0);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
