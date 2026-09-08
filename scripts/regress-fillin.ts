/**
 * Regression: the per-base fill-in never added a single place.
 *
 * The destination call returns a spine and each base is then asked for its own
 * dozen places. That fan-out is the whole reason a researched trip can be more
 * than a list of sights. It had never worked.
 *
 * The destination call writes short city ids ("torshavn") which get prefixed
 * with the destination. The per-base call is TOLD the full id, because the
 * prompt says `use cityId exactly "faroe-islands-torshavn"`. Validation
 * prefixed that a second time, got "faroe-islands-faroe-islands-torshavn",
 * matched no city, and dropped the place as "not in a city we have". Every
 * place, every call, silently.
 *
 * Visible downstream as: itineraries at one thing a day, whole days reading
 * "0 things · 10h free", and researched destinations abandoned for being too
 * thin, which is how a week in the Faroes turned into New Zealand.
 */
import { validatePlaceList } from "@/lib/research";
import type { City } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mTHE FILL-IN ACTUALLY FILLS IN\x1b[0m\n");

const cities = [
  { id: "faroe-islands-torshavn", name: "Tórshavn", destinationId: "faroe-islands",
    lat: 62, lng: -6.77, nightlyUsd: 160, minNights: 2, maxNights: 5, base: "Old town." },
  { id: "faroe-islands-klaksvik", name: "Klaksvík", destinationId: "faroe-islands",
    lat: 62.23, lng: -6.58, nightlyUsd: 140, minNights: 1, maxNights: 3, base: "Harbour." },
] as City[];

const place = (cityId: string, i: number) => ({
  id: `p${i}`, cityId, name: `Place ${i}`, kind: "sight", tags: ["local"],
  neighborhood: "Centre", lat: 62 + i / 1000, lng: -6.77,
  durationMin: 90, costUsd: 10, bestTime: "any", touristy: 2, note: "Worth an hour.",
});

// The per-base call: the model was told the full id, so it uses the full id.
{
  const { places, problems } = validatePlaceList(
    [0, 1, 2].map((i) => place("faroe-islands-torshavn", i)), "faroe-islands", cities,
  );
  check("places using the full city id are kept", places.length === 3,
    `${places.length} kept, ${problems.length} dropped: ${problems[0] ?? ""}`);
  check("and land in the right city", places.every((p) => p.cityId === "faroe-islands-torshavn"));
}

// The destination call: short ids, as before. Must still work.
{
  const { places } = validatePlaceList(
    [3, 4].map((i) => place("klaksvik", i)), "faroe-islands", cities,
  );
  check("short ids still work", places.length === 2, `${places.length} kept`);
  check("and are still prefixed correctly",
    places.every((p) => p.cityId === "faroe-islands-klaksvik"));
}

// A city that genuinely isn't in the pack is still refused.
{
  const { places, problems } = validatePlaceList(
    [place("reykjavik", 9)], "faroe-islands", cities,
  );
  check("a city we don't have is still dropped", places.length === 0 && problems.length === 1);
}

// The two passes together, deduped, which is what a real trip does.
{
  const first = validatePlaceList([0, 1].map((i) => place("torshavn", i)), "faroe-islands", cities);
  const second = validatePlaceList(
    [0, 2].map((i) => place("faroe-islands-torshavn", i)), "faroe-islands", cities, first.places,
  );
  check("the second pass adds what's new", second.places.length === 1, `${second.places.length} added`);
  check("and not what the spine already had",
    !second.places.some((p) => p.id === "faroe-islands-p0"));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
