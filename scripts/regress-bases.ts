/**
 * Regression: a twelve-day trek is not two cities.
 *
 * She asked for hiking in China. The agent researched it, said the right
 * thing — "Tiger Leaping Gorge, the Jade Dragon Snow Mountain area, and
 * multi-day treks around Shangri-La, skip Beijing entirely" — and then handed
 * her six nights in Kunming and four in Lijiang: the transport hub and the
 * nearest old town, with every mountain it had just named sitting unused.
 *
 * The planner destructured `const [a, b] = sleepable`. Two bases, always,
 * whatever the length of the trip and however many places the destination
 * held. On a seeded destination that is invisible, because the catalogue only
 * has two sleepable cities each. On a researched one it throws most of the
 * research away.
 */
import { registerPack } from "@/data/registry";
import { buildShape } from "@/lib/planner";
import { cityById } from "@/data/destinations";
import type { DestinationPack } from "@/lib/research";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA LONG TRIP EARNS MORE THAN TWO BASES\x1b[0m\n");

const city = (id: string, name: string, lat: number, lng: number, max = 5) => ({
  id, name, destinationId: "yunnan", lat, lng,
  nightlyUsd: 60, minNights: 2, maxNights: max,
  base: `the middle of ${name}`, scale: "walkable" as const,
});

const place = (cityId: string, n: number) => ({
  id: `${cityId}-p${n}`, cityId, name: `${cityId} thing ${n}`,
  kind: "sight" as const, tags: ["hike" as const, "nature" as const],
  neighborhood: "centre", lat: 25 + n / 100, lng: 100 + n / 100,
  durationMin: 120, costUsd: 0, bestTime: "morning" as const,
  touristy: 2 as const, note: "A real thing to do.",
});

const pack = {
  destination: {
    id: "yunnan", name: "Yunnan", pitch: "Gorges and high trails.",
    strengths: { nature: 5, exploration: 4, food: 3, relaxation: 2, culture: 3, adventure: 5, city: 1 },
    paceFit: ["mixed", "busy"], flightUsd: 900, floorPerDayUsd: 60, minDays: 7,
    because: { nature: "The gorge." }, warmth: 3, arrival: "fly",
    caveat: "Altitude.", hubCityId: "kunming",
  },
  cities: [
    city("kunming", "Kunming", 25.04, 102.71, 4),
    city("lijiang", "Lijiang", 26.87, 100.23),
    city("tigerleaping", "Tiger Leaping Gorge", 27.18, 100.13),
    city("shangrila", "Shangri-La", 27.83, 99.70),
  ],
  places: ["kunming", "lijiang", "tigerleaping", "shangrila"].flatMap(
    (c) => [1, 2, 3, 4, 5, 6].map((n) => place(c, n)),
  ),
} as unknown as DestinationPack;

check("the researched destination registers", registerPack(pack));

const shape = buildShape("yunnan", 12);
const beds = shape.filter((l) => l.nights > 0);
const names = [...new Set(beds.map((l) => cityById(l.cityId).name))];
const line = beds.map((l) => `${cityById(l.cityId).name} ${l.nights}n`).join(" → ");

check("twelve days uses more than two places to sleep", names.length >= 3, line);
check("and it still starts at the hub you fly into", beds[0].cityId === "kunming", line);
check("and no single base swallows the trip",
  Math.max(...beds.map((l) => l.nights)) <= 6, line);
check("and every night is allocated",
  beds.reduce((s, l) => s + l.nights, 0) === 11, `${beds.reduce((s, l) => s + l.nights, 0)} of 11`);
check("and no base is below one night", beds.every((l) => l.nights >= 1), line);

// Short trips must not fragment: three cities in five days is packing, not travel.
const short = buildShape("yunnan", 5).filter((l) => l.nights > 0);
check("a five-day trip stays put",
  [...new Set(short.map((l) => l.cityId))].length === 1,
  short.map((l) => `${cityById(l.cityId).name} ${l.nights}n`).join(" → "));

// And the ceiling holds: a very long trip doesn't become a bus tour.
const long = buildShape("yunnan", 21).filter((l) => l.nights > 0);
check("three weeks is still at most four bases",
  [...new Set(long.map((l) => l.cityId))].length <= 4,
  long.map((l) => `${cityById(l.cityId).name} ${l.nights}n`).join(" → "));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
