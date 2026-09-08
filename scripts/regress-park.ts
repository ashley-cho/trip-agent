/**
 * The park has to be a base, or the trip is a week of restaurants next to it.
 *
 * "i want to hike some national parks" came back with Patagonia, a pitch that
 * said "full days in the park", and an itinerary whose headline activity on
 * two separate days was a supermarket. Nineteen places in the pack, exactly
 * one tagged hike, and that one a 120-minute walk.
 *
 * Nothing had lost the interest. The brief had it, the pitch had it, and
 * because.adventure named Valle Frances outright. What happened is that the
 * model returned two towns in `cities` and no park, so fillInBases asked
 * "Fill in Puerto Natales" and "Fill in Punta Arenas" and got, correctly,
 * town content. Torres del Paine was never asked about by anything.
 *
 * The mechanism to prevent that already existed. dayTripOnly is validated,
 * survives the prune, and gets its own day in the planner. The model never
 * set it because the schema field had no description and the three lodging
 * numbers beside it were required, which says: a place with no beds is not a
 * legal entry here.
 *
 * These tests hold the schema and the prompts to that, and prove a bedless
 * city still validates.
 */
import { RESEARCH_TOOL, RESEARCH_SYSTEM, PLACES_SYSTEM, validatePack } from "@/lib/research";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  the park is a base\n");

// --- the schema has to invite it ------------------------------------------
const city = (RESEARCH_TOOL.input_schema.properties.cities as Record<string, any>).items;
const props = city.properties as Record<string, { description?: string }>;

check("dayTripOnly is described, not a bare boolean",
  typeof props.dayTripOnly?.description === "string" && props.dayTripOnly.description.length > 40,
  props.dayTripOnly?.description ?? "(no description)");

for (const f of ["nightlyUsd", "minNights", "maxNights"]) {
  check(`${f} is not required, because a park has no beds`,
    !(city.required as string[]).includes(f));
}
for (const f of ["id", "name", "lat", "lng", "base"]) {
  check(`${f} is still required`, (city.required as string[]).includes(f));
}

// --- the prompts have to say it -------------------------------------------
/*
 * The terrain rule left this prompt on purpose.
 *
 * Describing dayTripOnly harder was the patch. It did not work: a fresh
 * Patagonia research on the shipped build still came back as two towns, 19
 * places and no route, because a park has to pretend to be a city to exist at
 * all. The rule now lives in "outings", which is not a city and needs no bed,
 * and regress-outings.ts holds it. What stays here is the part that is still
 * true: the schema must not make a bedless place illegal.
 */
check("RESEARCH_SYSTEM hands the terrain question to outings",
  /Base Torres/.test(RESEARCH_SYSTEM) && !/dayTripOnly/.test(RESEARCH_SYSTEM));
check("PLACES_SYSTEM asks a park for routes, not meals",
  /trailhead/i.test(PLACES_SYSTEM) && /elevation gain/i.test(PLACES_SYSTEM));

// --- and a bedless city has to survive validation -------------------------
const raw = {
  id: "patagonia", name: "Patagonia",
  pitch: "Wind, granite, and long days on foot.",
  strengths: { adventure: 5, nature: 5 },
  paceFit: ["mixed"], flightUsd: 1200, floorPerDayUsd: 90, minDays: 6,
  warmth: 2, arrival: "fly", caveat: "The wind can shut the high ground for days.",
  because: { adventure: "Full-day exposed hikes like Valle Frances." },
  cities: [
    { id: "puerto-natales", name: "Puerto Natales", lat: -51.7236, lng: -72.4875,
      nightlyUsd: 120, minNights: 3, maxNights: 6, base: "The waterfront, walkable to the buses." },
    // No nightlyUsd, no minNights, no maxNights. This is the entry that used
    // to be impossible to state.
    { id: "torres-del-paine", name: "Torres del Paine", lat: -50.9423, lng: -72.9877,
      base: "Laguna Amarga entrance, where the shuttles start.",
      dayTripOnly: true, dayTripFrom: "puerto-natales",
      transitFromHubMin: 120, transitFromHubUsd: 18, transitMode: "bus" },
  ],
  places: [],
};

const { pack, problems } = validatePack(raw);
check("the pack validates at all", !!pack, problems.join("; "));

const park = pack?.cities.find((c) => c.id.endsWith("torres-del-paine"));
check("the park survived validation", !!park);
check("the park is marked dayTripOnly", park?.dayTripOnly === true);
check("the park hangs off the town it is reached from",
  park?.dayTripFrom === pack?.cities.find((c) => c.id.endsWith("puerto-natales"))?.id,
  `dayTripFrom=${park?.dayTripFrom}`);
check("the park needs no beds", park?.nightlyUsd === 0 && park?.minNights === 0);
check("the town it hangs off still has beds",
  (pack?.cities.find((c) => c.id.endsWith("puerto-natales"))?.nightlyUsd ?? 0) > 0);

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
