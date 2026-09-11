/**
 * Regression: what she ruled out stays ruled out.
 *
 * She wrote, in one message:
 *
 *   "somewhere quiet and peaceful, beautiful, but have some retail going on
 *    and still some people around - just not overwhelmingly not. Don't want
 *    south east asia or anywhere too hot or cold or humid"
 *
 * and was told, at high confidence: I think you should go to Bali.
 *
 * Bali is in Southeast Asia, has a warmth of 5, and sits eight degrees off
 * the equator. It is not a near miss. It is the single worst answer in the
 * catalogue to that sentence, and three independent bugs had to line up to
 * produce it:
 *
 *   1. lib/discovery.ts read the region out of her message with no negation
 *      check, so "Don't want south east asia" set her candidate shortlist TO
 *      Southeast Asia. She was not ignored, she was inverted.
 *   2. lib/recommend.ts contained no occurrence of the word "avoid". Nothing
 *      that decides where to send her had ever read a refusal.
 *   3. "too hot or cold or humid" parsed to nothing, though every destination
 *      has carried a warmth of 1 to 5 since the catalogue was written — read
 *      only ever to BOOST somewhere when she asked FOR sun.
 *
 * Her rule, which tops everything: it must stay faithful to the user's input.
 */
import { interpretRules, readClimate } from "@/lib/discovery";
import { applyPatch } from "@/lib/brief";
import { emptyBrief, emptyProfile } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { crowdFit } from "@/lib/select";
import { applyRejection } from "@/lib/reject";
import { destinationById, DESTINATIONS } from "@/data/destinations";
import { inTropics, membersOf } from "@/lib/regions";
import { fold, key } from "@/lib/text";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mWHAT SHE RULED OUT STAYS RULED OUT\x1b[0m\n");

const HERS = "somewhere quiet and peaceful, beautiful, but have some retail going on and "
  + "still some people around - just not overwhelmingly not. Don't want south east asia "
  + "or anywhere too hot or cold or humid";

/** A place, for the band tests. Only `touristy` varies. */
const PLACE = {
  id: "x", cityId: "c", name: "X", kind: "sight" as const, tags: ["local" as const],
  neighborhood: "n", lat: 0, lng: 0, durationMin: 60, costUsd: 0,
  closedDays: [], bestTime: "any" as const, touristy: 3 as const, note: "n",
};
const inBand = (p: { touristy: number }, b: ReturnType<typeof read>) =>
  p.touristy <= (b.crowds?.max ?? 5);
/** The scorer's own crowd term. The real one, not a copy of it. */
const score = (p: { touristy: number }, b: ReturnType<typeof read>) =>
  crowdFit(p.touristy, b.crowds);

function read(said: string, days = 7) {
  let b = emptyBrief();
  b = applyPatch(b, interpretRules(said, b));
  return { ...b, days };
}

// --- her message, end to end ----------------------------------------------
{
  const b = read(HERS);
  check("the region she refused is recorded as a refusal",
    (b.avoidRegions ?? []).includes("seasia"), JSON.stringify(b.avoidRegions ?? []));
  check("and never as a preference",
    b.region === undefined && !(b.regionIds ?? []).length,
    `region=${b.region} ids=${JSON.stringify(b.regionIds ?? [])}`);
  check("all three climates are read, not just the first",
    ["hot", "cold", "humid"].every((c) => (b.avoidClimate ?? []).includes(c as never)),
    JSON.stringify(b.avoidClimate ?? []));
  check("no grammar is filed as a place she refused",
    !(b.avoidPlaces ?? []).length, JSON.stringify(b.avoidPlaces ?? []));
  /*
   * "just not overwhelmingly not" was the phrase I deleted as unparseable
   * junk. It is the most specific thing in her message: a ceiling on how busy
   * she wants it, sitting next to a floor ("still some people around") in the
   * same breath. The app had no field for either, only a `less_touristy` edit
   * applied after a trip exists, so one end was invisible and the other came
   * out of the negation miner as a place called "overwhelmingly not".
   */
  check("the ceiling she set is read, not deleted",
    b.crowds?.max === 3, JSON.stringify(b.crowds ?? null));
  check("and so is the floor in the same sentence",
    b.crowds?.min === 2, JSON.stringify(b.crowds ?? null));

  const r = recommend(b, emptyProfile());
  const d = destinationById(r.destinationId);
  check("she is not sent to Bali",
    r.destinationId !== "bali", `got ${r.destinationId}`);
  check("nor anywhere else in the region she refused",
    !membersOf("seasia").includes(r.destinationId), `got ${r.destinationId}`);
  check("nor anywhere hot",
    d.warmth < 4, `${r.destinationId} warmth ${d.warmth}`);
  check("nor anywhere cold",
    d.warmth > 2, `${r.destinationId} warmth ${d.warmth}`);
  check("nor anywhere in the tropics",
    !inTropics(r.destinationId), r.destinationId);
}

// --- the refusal is a filter, not a penalty -------------------------------
{
  const b = { ...read("i want somewhere quiet, not europe"), days: 10 };
  check("a refused region is out, not merely marked down",
    !membersOf("europe").includes(recommend(b, emptyProfile()).destinationId),
    recommend(b, emptyProfile()).destinationId);
}

// --- and asking FOR something still works ---------------------------------
{
  const b = read("somewhere warm for a week");
  check("wanting warmth is not a refusal of it",
    !(b.avoidClimate ?? []).length, JSON.stringify(b.avoidClimate ?? []));
  const eu = read("two weeks in europe");
  check("a region she asks for is still a preference",
    eu.region === "europe" && !(eu.avoidRegions ?? []).includes("europe"),
    `${eu.region} / ${JSON.stringify(eu.avoidRegions ?? [])}`);
}

// --- the elided list ------------------------------------------------------
check("one 'too' governs the whole list",
  JSON.stringify(readClimate("anywhere too hot or cold or humid")) === '["hot","cold","humid"]',
  JSON.stringify(readClimate("anywhere too hot or cold or humid")));
check("and a climate named without 'too' still counts",
  readClimate("nowhere humid").includes("humid")
  && readClimate("not too cold please").includes("cold"));
check("while praise is not a refusal",
  readClimate("I love hot weather").length === 0 && readClimate("somewhere warm").length === 0);

// --- location tags cover the whole catalogue, not a hand-written list -----
{
  const unplaced = DESTINATIONS.filter((d) =>
    !["scandinavia", "iberia", "balkans", "mediterranean", "easteurope", "europe",
      "seasia", "eastasia", "asia", "meast", "africa", "caribbean", "westcoast",
      "usa", "namerica", "samerica", "latam", "oceania"]
      .some((r) => membersOf(r).includes(d.id)));
  check("every destination is somewhere on the map",
    unplaced.length === 0, unplaced.map((d) => d.id).join(", "));
  /*
   * The hand-written `ids` lists name only the original catalogue. Sixty-seven
   * researched destinations are in the shared table and in none of them, so a
   * list-only membership test would have excluded Bali and Vietnam from
   * "not southeast asia" while happily offering Laos, Singapore, Malaysia and
   * Cambodia, all seeded the same morning.
   */
  check("and membership comes from coordinates, so researched ones count too",
    membersOf("seasia").includes("bali") && membersOf("eastasia").includes("taiwan")
    && !membersOf("seasia").includes("taiwan"),
    membersOf("seasia").join(", "));
}

// --- one way to compare text ----------------------------------------------
check("however she spells a region, it is the same region",
  new Set(["south east asia", "South-East Asia", "SOUTHEAST ASIA"].map(key)).size === 1);
check("and folding keeps word boundaries while keying removes them",
  fold("South-East Asia") === "south-east asia" && key("the Cyclades") === "cyclades");

// --- rejecting a place is not a confession about yourself -----------------
{
  /*
   * She pressed "Not my kind of place" on Bali and was told "Right — less
   * food and culture, then", then offered Northern Thailand: a second
   * destination inside the region she had ruled out, described as "the
   * closest" thing to what she wanted.
   *
   * She had said nothing about food or culture. They are simply the two
   * things Bali scores four on that she had not explicitly asked for.
   */
  const b = read(HERS);
  const bali = destinationById("bali");
  const out = applyRejection("notmykind", bali, 2246, b, emptyProfile());

  check("one rejection does not become a stated taste",
    !Object.keys(out.profile.vibeLeanings ?? {}).length,
    JSON.stringify(out.profile.vibeLeanings ?? {}));
  check("and she is not told what she thinks",
    !/less food|less culture/i.test(out.said), out.said);
  check("what it says is what actually happened",
    /not bali/i.test(out.said), out.said);
  check("the rejection itself is still recorded",
    (out.profile.rejectedDestinationIds ?? []).includes("bali"));

  // Two places sharing a strength she never asked for IS a pattern.
  const twice = applyRejection("notmykind", destinationById("vietnam"), 2000,
    read("i want somewhere with mountains"),
    { ...emptyProfile(), rejectedDestinationIds: ["bali"] });
  check("two rejections sharing a strength do teach something",
    Object.keys(twice.profile.vibeLeanings ?? {}).length > 0
    && /twice/i.test(twice.said),
    `${twice.said} · ${JSON.stringify(twice.profile.vibeLeanings ?? {})}`);
}

// --- a band is not a direction --------------------------------------------
{
  /*
   * The scorer's crowd preference was a straight line: the quieter the
   * better, forever. That is a fine default and wrong the moment somebody
   * says they want SOME life — it walks them to the deserted end of the
   * range they asked for.
   */
  const b = read(HERS);
  const quiet = { ...PLACE, touristy: 1 as const };
  const middle = { ...PLACE, touristy: 3 as const };
  const mobbed = { ...PLACE, touristy: 5 as const };
  check("a place above her ceiling is not a candidate at all",
    !inBand(mobbed, b), "touristy 5 against a max of 3");
  check("and the middle of her band beats the deserted end",
    score(middle, b) > score(quiet, b),
    `middle ${score(middle, b).toFixed(3)} vs quiet ${score(quiet, b).toFixed(3)}`);
  check("while with no band stated, quieter still wins",
    score(quiet, read("a week somewhere nice")) > score(middle, read("a week somewhere nice")));
}

// --- and the fallback never names somewhere she refused -------------------
{
  let b = read(HERS);
  const p = { ...emptyProfile(), rejectedDestinationIds: ["bali"], visitedDestinationIds: ["bali"] };
  const r = recommend(b, p);
  check("after rejecting one, the next is still not in the refused region",
    !membersOf("seasia").includes(r.destinationId), r.destinationId);
  check("and 'nothing fits' never offers the region she ruled out as the closest",
    !r.noGoodFit || !membersOf("seasia").includes(r.destinationId),
    `${r.destinationId} · ${r.noGoodFit ?? "-"}`);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
