/**
 * Regression: research makes a hand-written destination deeper, never doubled.
 *
 * `registerPack` used to refuse outright when a destination already existed by
 * hand. Right instinct, wrong consequence. The instinct: a hand-checked entry
 * is the verified tier and a model must not overwrite judgment. The
 * consequence, once the shared catalogue held ninety-six researched
 * destinations, was that the verified tier had quietly become the WEAK tier
 * and was permanently protected from improving:
 *
 *   hand-written   24 destinations, average 34 places
 *   researched     96 destinations, average 75 places
 *
 * Bali held exactly the fourteen places its own seven-day minimum asks for,
 * with no margin, so one avoid-tag dropped a week in Bali under the bar. Japan
 * was two cities for a whole country at an eight-day minimum. Neither could
 * ever be fixed, because a better pack bounced off that line.
 *
 * What is kept is the destination RECORD: the pitch, the strengths, the
 * because clauses, the caveat. That is judgment. The places are data, and data
 * merges.
 *
 * The trap this guards is the duplicate base. validatePack namespaces every
 * city, so a pack correctly reusing "ubud" arrives holding "bali-ubud".
 * Merged naively that is two Ubuds: the scheduler moves her between them and
 * counts the hotel twice.
 */
import { readFileSync } from "node:fs";
import { placesNeeded, type DestinationPack } from "@/lib/research";
import { registerPack, isResearched } from "@/data/registry";
import { CITIES, DESTINATIONS, destinationById } from "@/data/destinations";
import { PLACES } from "@/data";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mRESEARCH DEEPENS THE VERIFIED TIER\x1b[0m\n");

const of = (id: string) => {
  const cs = CITIES.filter((c) => c.destinationId === id);
  return { cities: cs.length, places: PLACES.filter((p) => cs.some((c) => c.id === p.cityId)).length };
};

const before = of("bali");
const pitch = destinationById("bali").pitch;
/*
 * The real pack from data/catalogue, not a fixture invented for the test, and
 * not re-validated on the way in: adopt.ts already put it through
 * validatePack, and running it through again would namespace the city ids a
 * second time ("bali-bali-ubud") and test something that never happens.
 */
const row = JSON.parse(readFileSync("data/catalogue/bali.json", "utf8")) as { pack: DestinationPack };
const pack = row.pack;

if (!pack?.destination) {
  check("data/catalogue/bali.json is a pack", false, "run npm run adopt");
} else {
  check("a pack for a hand-written destination is not refused",
    registerPack(pack) === true,
    "it used to return false and walk away, which is why Bali could never improve");

  const after = of("bali");
  check("its places are merged in",
    after.places > before.places,
    `${before.places} -> ${after.places}`);
  check("and it clears its own stated minimum with room to spare",
    after.places > placesNeeded(destinationById("bali").minDays) * 2,
    `${after.places} places against ${placesNeeded(destinationById("bali").minDays)} wanted`);

  // The whole point of keeping the hand-written record.
  check("the hand-written pitch is untouched",
    destinationById("bali").pitch === pitch,
    "the record is judgment; only the data merges");
  check("and it is still not counted as researched",
    !isResearched("bali"),
    "a deepened hand-written destination is still hand-written");

  // The trap.
  const names = CITIES.filter((c) => c.destinationId === "bali").map((c) => c.name.toLowerCase());
  check("no base is added twice under a namespaced id",
    new Set(names).size === names.length,
    names.join(", "));
  check("and the existing bases keep their own ids",
    CITIES.some((c) => c.id === "ubud") && !CITIES.some((c) => c.id === "bali-ubud"),
    CITIES.filter((c) => c.destinationId === "bali").map((c) => c.id).join(", "));

  // Merging twice must be a no-op, or a reload doubles the catalogue.
  const twice = of("bali");
  registerPack(pack);
  check("registering the same pack again changes nothing",
    of("bali").places === twice.places && of("bali").cities === twice.cities,
    `${twice.places} -> ${of("bali").places}`);

  const ids = new Set(CITIES.map((c) => c.id));
  check("no place is orphaned from its base",
    PLACES.every((p) => ids.has(p.cityId)));
  const seen = new Set<string>();
  check("and no place id appears twice",
    PLACES.every((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))));
}

check("the catalogue still holds every hand-written destination",
  DESTINATIONS.filter((d) => !isResearched(d.id)).length >= 24);

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
