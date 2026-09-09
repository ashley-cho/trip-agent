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
  /*
   * "but" after a refusal flips it back: "no crowds but markets" asks for
   * markets. Nothing tested that direction, so the reset was load-bearing and
   * uncovered — removing it changed real behaviour and the suite stayed green.
   */
  check("'but' after a refusal turns it back into a request",
    w("no crowds but markets").includes("market"), JSON.stringify(w("no crowds but markets")));
  check("and two 'anything but's both refuse",
    w("anything but museums, anything but churches").length === 0,
    JSON.stringify(w("anything but museums, anything but churches")));
  check("'but' separates clauses too",
    w("hiking but no crowds").includes("hik") && !w("hiking but no crowds").includes("crowd"),
    JSON.stringify(w("hiking but no crowds")));
  check("a sentence that only refuses still yields nothing",
    w("no wine, i hate wine").length === 0, JSON.stringify(w("no wine, i hate wine")));
  check("and a plain request is untouched",
    w("i want to go to portugal for the wine").includes("win"));
  check("politeness is not an activity",
    !w("markets please, thanks").includes("pleas"), JSON.stringify(w("markets please, thanks")));

  /*
   * "you" is three letters, survives the stemmer, and is in every sentence the
   * reason bank uses to quote her back to herself. So "can you plan me a trip"
   * put "you" in her licence set and opened the attribution gate completely:
   * 278 fabricated "you asked for" lines across 60 trips, from a message that
   * names nothing at all.
   */
  const museum = { id: "m", name: "Museum", tags: ["museum"], skip: false } as unknown as Place;
  for (const s2 of ["can you plan me a trip", "what would you suggest", "where should we go"]) {
    check(`"${s2}" names nothing to do`, w(s2).length === 0, JSON.stringify(w(s2)));
  }

  /*
   * "and" was not a separator, so a refusal in front of it swallowed the whole
   * sentence: "no crowds and i want markets" produced nothing, and `unserved`
   * didn't even report it. But "and" usually continues a refusal rather than
   * ending it, so what survives it has to actually ask for something.
   */
  check("a request after 'and' survives a refusal before it",
    w("no crowds and i want markets").includes("market"), JSON.stringify(w("no crowds and i want markets")));
  check("and so does one after 'and love'",
    w("i hate museums and love wine").includes("win"), JSON.stringify(w("i hate museums and love wine")));
  check("but a second refused thing after 'and' is still refused",
    w("no early starts and late nights").length === 0, JSON.stringify(w("no early starts and late nights")));
  check("'hiking and hot springs' is two requests, not one refusal",
    w("hiking and hot springs").includes("hik"), JSON.stringify(w("hiking and hot springs")));

  /*
   * "Anything but X" refuses X in a clause with no refusal word in it, and its
   * "but" flipped the polarity the wrong way — so the refused thing arrived
   * with the +0.6 `asked` weight, the largest single term in the scorer. A
   * museum was in the top five for 15 of 42 cities under "anything but
   * museums", and the reason bank answered "One museum, not a week of them.
   * You were clear about that."
   */
  for (const s2 of ["anything but museums", "everything but museums", "anywhere but museums"]) {
    check(`"${s2}" refuses museums`, !servesActivity(museum, s2), JSON.stringify(w(s2)));
  }

  /*
   * A full stop, a semicolon or a comma ends the refusal; only "and" carries
   * it. The carry was written for "and" and applied to every joiner, so five
   * ordinary phrasings produced nothing at all — and `unserved` did not report
   * them either. The flagship string only passed because "please" happens to
   * be a want-marker; without it, it failed too.
   */
  for (const [s2, want] of [
    ["no early starts, surfing", "surf"],
    ["nothing touristy, just good food", "food"],
    ["no hiking. wine tasting", "win"],
    ["no museums, hiking and food", "hik"],
    ["no crowds; markets", "market"],
    ["no early starts, markets", "market"],
  ] as const) {
    check(`"${s2}" keeps what comes after the punctuation`,
      w(s2).includes(want), JSON.stringify(w(s2)));
  }

  // Refusals that are not the word "no".
  for (const s2 of ["i can't stand museums", "cannot do museums", "we won't be doing museums",
    "i dislike museums", "museums are out", "i'm done with museums",
    "we've had enough of museums", "except museums", "apart from museums", "museums bore me"]) {
    check(`"${s2}" does not ask for museums`, !servesActivity(museum, s2), JSON.stringify(w(s2)));
  }

  // The matcher has to agree with the words, or the fix stops at the parser.
  const markets = { id: "x", name: "Mercado da Ribeira", tags: ["market"], skip: false } as unknown as Place;
  check("a market still serves 'no early starts, markets please'",
    servesActivity(markets, "no early starts, markets please"));
  check("and nothing is reported unserved when it is served",
    unserved([markets], ["no early starts, markets please"]).length === 0);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
