/**
 * Regression: enough material to actually fill the days.
 *
 * Her twelve-day Yunnan trip came back with one thing a day and two open
 * afternoons out of twelve. Not a scheduling bug: the research prompt said,
 * in as many words, "ten to twelve places is enough". That was written when a
 * single research call was timing out, and it is right for a long weekend and
 * wrong for a fortnight.
 *
 * Asking one call for forty doesn't fix it, because output tokens are the
 * ceiling and fifteen places already took nearly a minute. Each base gets its
 * own call instead, and they run at the same time.
 */
import { placesPerCity, validatePlaceList, PLACES_SYSTEM, placesPrompt } from "@/lib/research";
import type { City, Place } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mENOUGH TO FILL THE DAYS\x1b[0m\n");

// The number has to move with the trip, which is the whole point.
const twelve = placesPerCity(12, 3);
const weekend = placesPerCity(3, 1);
check("a twelve-day trip across three bases asks for a dozen each",
  twelve * 3 >= 30, `${twelve} per base, ${twelve * 3} total`);
check("which is three times what the old flat number gave", twelve * 3 >= 30);
check("a long weekend in one place doesn't ask for forty",
  weekend <= 14, `${weekend}`);
check("and no base is ever asked for a token amount",
  placesPerCity(2, 4) >= 8, `${placesPerCity(2, 4)}`);
check("a single base still gets a full trip's worth",
  placesPerCity(10, 1) >= 12, `${placesPerCity(10, 1)}`);

// Every place is pinned to the city that asked for it.
const cities = [
  { id: "yn-kunming", name: "Kunming" },
  { id: "yn-lijiang", name: "Lijiang" },
] as City[];

const raw = (id: string, cityId: string, name: string) => ({
  id, cityId, name, kind: "sight", tags: ["hike"], neighborhood: "centre",
  lat: 25.1, lng: 102.7, durationMin: 120, costUsd: 0,
  bestTime: "morning", touristy: 2, note: "Worth the early start.",
});

{
  const { places } = validatePlaceList(
    [raw("a", "kunming", "Green Lake"), raw("b", "lijiang", "Black Dragon Pool")],
    "yn", cities,
  );
  check("places land in the city they were asked for",
    places.length === 2 && places[0].cityId === "yn-kunming" && places[1].cityId === "yn-lijiang",
    places.map((p) => `${p.name}@${p.cityId}`).join(", "));
}

// A second pass must not schedule the same restaurant twice.
{
  const first = validatePlaceList([raw("a", "kunming", "Green Lake")], "yn", cities).places;
  const second = validatePlaceList(
    [raw("a", "kunming", "Green Lake"), raw("z", "kunming", "GREEN LAKE"), raw("c", "kunming", "Stone Forest")],
    "yn", cities, first,
  );
  check("the same place coming back twice is dropped",
    second.places.length === 1 && second.places[0].name === "Stone Forest",
    second.places.map((p) => p.name).join(", "));
}

// A city the destination doesn't have can't smuggle places in.
{
  const { places, problems } = validatePlaceList([raw("x", "shanghai", "The Bund")], "yn", cities);
  check("a place in a city we don't hold is refused",
    places.length === 0 && problems.length === 1, problems.join("; "));
}

// The per-city prompt has to pin the id, or every place lands nowhere.
{
  const p = placesPrompt("Yunnan", "yn-lijiang", "Lijiang", 12, "hiking", "notes here");
  check("the prompt pins the exact city id", p.includes('"yn-lijiang"'));
  check("and asks for the right number", p.includes("12 places"));
  check("and carries what they asked for", /hiking/.test(p));
}

check("the per-city brief still bans invention",
  /Never invent a place/i.test(PLACES_SYSTEM));
check("and still asks for what to skip", /skip/i.test(PLACES_SYSTEM));
check("and still bans the slop", /hidden gem/i.test(PLACES_SYSTEM));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
