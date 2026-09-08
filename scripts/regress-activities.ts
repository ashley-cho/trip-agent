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

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
