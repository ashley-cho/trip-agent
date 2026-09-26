/**
 * Regression: a pack that reached the bar stays at the bar.
 *
 * Every base in a pack written through docs/PACK_BRIEF.md holds fifteen
 * places and three named meals, so a week pinned to it does not run out on
 * day four. The older packs are below it and are being brought up one at a
 * time; they are reported, not failed, until they are. The list below is
 * the ratchet: a pack goes on it when it clears pack-check and never comes
 * off.
 */
import { readFileSync, readdirSync } from "node:fs";
import { validatePack } from "@/lib/research";

const AT_THE_BAR = [
  "belgium", "netherlands", "london", "singapore", "hongkong", "thailand",
  "czechia", "austria", "spain-madrid",
];
const MIN = 15;

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA WEEK IN EVERY BASE\x1b[0m\n");

let below = 0, bases = 0, thin = 0;
for (const f of readdirSync("data/catalogue").filter((x) => x.endsWith(".json"))) {
  const row = JSON.parse(readFileSync(`data/catalogue/${f}`, "utf8"));
  const p = row.pack;
  const { pack } = validatePack({ ...p.destination, cities: p.cities, places: p.places, outings: p.outings }, p.sources ?? []);
  if (!pack) { check(`${row.id} validates`, false); continue; }
  const beds = pack.cities.filter((c) => !c.dayTripOnly);
  const short = beds.filter((c) => pack.places.filter((x) => x.cityId === c.id && !x.skip).length < MIN);
  const fewMeals = beds.filter((c) => pack.places.filter((x) => x.cityId === c.id && x.kind === "meal").length < 3);
  bases += beds.length; thin += short.length;
  if (AT_THE_BAR.includes(row.id)) {
    check(`${row.id}: every base holds ${MIN} places and 3 meals`, !short.length && !fewMeals.length,
      [...short.map((c) => `${c.name} short`), ...fewMeals.map((c) => `${c.name} few meals`)].join(", "));
  } else if (short.length) {
    below++;
  }
}
console.log(`\n  ${AT_THE_BAR.length} packs held to the bar; ${below} older packs still below it (${thin}/${bases} bases under ${MIN} places)\n`);
check("the ratchet only tightens: every pack on the list is still in the catalogue",
  AT_THE_BAR.every((id) => readdirSync("data/catalogue").includes(`${id}.json`)));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
