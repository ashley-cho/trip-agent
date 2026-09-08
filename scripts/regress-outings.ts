/**
 * The thing she came to do has somewhere to live.
 *
 * The pipeline's only spatial unit was a city: research returned cities,
 * fillInBases filled cities, the planner put places near the bed. So the only
 * question it could ask was "what is in this town". Patagonia came back as
 * Puerto Natales, Everest as the Namche Bazaar loop, Kenya as Nairobi. Towns,
 * every time, because a town was the only shape of answer the schema had.
 *
 * dayTripOnly did not fix it and could not: it is still a city, just one with
 * no bed. An outing is not somewhere you sleep, it is somewhere you go, and
 * where she sleeps is derived from it afterwards.
 *
 * Stage one: the schema and the prompts. Nothing consumes outings yet, so
 * behaviour is unchanged and this is safe to ship while we find out whether
 * the model actually returns Base Torres when asked.
 */
import { RESEARCH_TOOL, RESEARCH_SYSTEM, STRUCTURE_SYSTEM, validatePack } from "@/lib/research";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  outings\n");

const props = RESEARCH_TOOL.input_schema.properties as Record<string, any>;
check("the schema has somewhere to put a route", !!props.outings);
check("and it is required, so there is no silently skipping it",
  (RESEARCH_TOOL.input_schema.required as string[]).includes("outings"));
for (const f of ["name", "hours", "startsFrom", "why"]) {
  check(`an outing must carry ${f}`, (props.outings.items.required as string[]).includes(f));
}
check("startsFrom is what decides lodging, so it carries coordinates",
  ["name", "lat", "lng"].every((k) => (props.outings.items.properties.startsFrom.items.required as string[]).includes(k)));

check("RESEARCH_SYSTEM asks for the days by name",
  /Base Torres/.test(RESEARCH_SYSTEM) && /not the town nearest to it/.test(RESEARCH_SYSTEM));
check("STRUCTURE_SYSTEM, which emits the arrays, knows an outing is not a city",
  /an outing is not somewhere you sleep/i.test(STRUCTURE_SYSTEM));

/*
 * The prompt and the schema must not ask for opposite things.
 *
 * This shipped saying "cities is only for places with beds" while the
 * dayTripOnly field in the same call's schema said the opposite about the same
 * four nouns: a park, a trailhead, an island, a valley. Nothing reads outings
 * yet, so a model that obeyed the prompt put Torres del Paine somewhere no
 * consumer looks and it vanished from the trip. That is the original bug,
 * reintroduced by its own fix. Both, until the planner reads outings.
 */
check("and asks for BOTH while nothing consumes outings",
  /must ALSO appear in "cities" with dayTripOnly true/.test(STRUCTURE_SYSTEM)
  && /vanishes from the trip entirely/.test(STRUCTURE_SYSTEM));
check("and says so as a temporary state, with the condition for removing it",
  /This is temporary and this note goes when the planner reads outings/.test(STRUCTURE_SYSTEM));

// --- validation -----------------------------------------------------------
const base = {
  id: "patagonia", name: "Patagonia", pitch: "Wind and granite.",
  strengths: { nature: 5, adventure: 5 }, paceFit: ["mixed"],
  flightUsd: 1200, floorPerDayUsd: 90, minDays: 6, warmth: 2, arrival: "fly",
  caveat: "The wind.", because: { adventure: "Long days on foot." },
  cities: [{ id: "puerto-natales", name: "Puerto Natales", lat: -51.72, lng: -72.48,
             nightlyUsd: 120, minNights: 3, maxNights: 6, base: "The waterfront." }],
  places: [],
  outings: [
    { name: "Base Torres", hours: 9, km: 22, gainM: 1000,
      why: "Steep, exposed, and the last hour is a boulder field.",
      startsFrom: [{ name: "Puerto Natales", lat: -51.72, lng: -72.48 },
                   { name: "Hotel Las Torres", lat: -50.98, lng: -72.86 }] },
    { name: "Valle Frances", hours: 9,
      why: "The middle of the W, and the wind funnels down it.",
      startsFrom: [{ name: "Refugio Paine Grande", lat: -51.09, lng: -73.08 }] },
    // No startsFrom: unusable, because lodging is derived from it.
    { name: "Some ridge", hours: 6, why: "Vague.", startsFrom: [] },
  ],
};

const { pack, problems } = validatePack(base);
check("the pack validates", !!pack, problems.join("; "));
check("both usable outings survive", pack?.outings.length === 2,
  JSON.stringify(pack?.outings.map((o) => o.name)));
check("the one with nowhere to start is dropped",
  !pack?.outings.some((o) => o.name === "Some ridge"));
check("and dropping it is said out loud, not swallowed",
  problems.some((p) => /nowhere to start from/.test(p)), problems.join("; "));
check("hours survive, because a 9 means it owns the day",
  pack?.outings[0].hours === 9);
check("so do the start points lodging will be solved from",
  pack?.outings[0].startsFrom.length === 2);
check("an empty outings list is legal, for a city break",
  !!validatePack({ ...base, outings: [] }).pack);

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
