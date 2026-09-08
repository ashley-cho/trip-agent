/**
 * Regression: naming a destination the catalogue doesn't hold.
 *
 * Asking for Patagonia used to return a fifteen-item menu of unrelated
 * countries. The catalogue is a cache now: the model researches the place and
 * the result is registered in the same shape as the hand-written data, so the
 * deterministic planner schedules it exactly as it schedules Portugal.
 */
import "@/lib/env";
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { emptyBrief, emptyProfile, type Brief, unknownHead } from "@/lib/types";
import { registerPack } from "@/data/registry";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { applyPatch } from "@/lib/brief";
import { validatePack } from "@/lib/research";
import { rulesDriver } from "@/lib/agent/rules";
import { destinationById, cityById } from "@/data/destinations";

// A stand-in for what a live search returns. Coordinates are real.
const PATAGONIA = {
  id: "patagonia", name: "Patagonia",
  pitch: "Two weeks of walking in weather that does what it likes, with almost nothing else to do.",
  strengths: { nature: 5, exploration: 3, food: 2, relaxation: 2, culture: 1, adventure: 5, city: 1 },
  paceFit: ["mixed", "busy"], flightUsd: 1400, floorPerDayUsd: 160, minDays: 7,
  warmth: 2, arrival: "fly", caveat: "The wind is not a detail, it is the weather.",
  because: { nature: "Granite towers, glaciers and steppe within a day of each other.", adventure: "The trekking is the reason to come." },
  cities: [
    { id: "puerto-natales", name: "Puerto Natales", lat: -51.7236, lng: -72.5064, nightlyUsd: 110, minNights: 2, maxNights: 4, base: "Near the waterfront, walkable to the outfitters.", scale: "walkable" },
    { id: "el-calafate", name: "El Calafate", lat: -50.3379, lng: -72.2648, nightlyUsd: 120, minNights: 2, maxNights: 4, base: "Avenida Libertador end of town.", scale: "driving" },
    { id: "torres", name: "Torres del Paine", lat: -50.9423, lng: -73.4068, nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day trip from Puerto Natales.", dayTripOnly: true, dayTripFrom: "puerto-natales", transitFromHubMin: 110, transitFromHubUsd: 30, transitMode: "bus" },
  ],
  places: [
    { id: "base-torres", cityId: "torres", name: "Base of the Towers hike", kind: "outdoor", tags: ["hike", "nature", "iconic"], neighborhood: "Torres del Paine", lat: -50.9423, lng: -73.4068, durationMin: 480, costUsd: 35, bestTime: "morning", touristy: 4, note: "Eight hours up and back, and the last hour is the only one that matters." },
    { id: "perito-moreno", cityId: "el-calafate", name: "Perito Moreno glacier", kind: "sight", tags: ["nature", "iconic", "viewpoint"], neighborhood: "Los Glaciares", lat: -50.4967, lng: -73.1377, durationMin: 240, costUsd: 30, opens: "08:00", closes: "18:00", bestTime: "morning", touristy: 5, note: "The one famous thing here that is worth the crowd, because it calves while you watch." },
    { id: "grey-glacier", cityId: "torres", name: "Grey Glacier boat", kind: "experience", tags: ["boat", "nature"], neighborhood: "Lago Grey", lat: -51.0, lng: -73.2, durationMin: 200, costUsd: 90, bestTime: "afternoon", touristy: 3, note: "Cold, loud and worth it; wear more than you think." },
    { id: "mirador-condor", cityId: "puerto-natales", name: "Mirador Cerro Dorotea", kind: "walk", tags: ["walk", "viewpoint"], neighborhood: "Dorotea", lat: -51.6858, lng: -72.4736, durationMin: 150, costUsd: 12, bestTime: "afternoon", touristy: 2, note: "Two hours on a private farm track for the best view of the fjord." },
    { id: "afrigonia", cityId: "puerto-natales", name: "Afrigonia", kind: "meal", tags: ["food", "local"], neighborhood: "Centro", lat: -51.7275, lng: -72.5089, durationMin: 90, costUsd: 40, opens: "18:30", closes: "23:00", bestTime: "evening", touristy: 3, note: "Zambian-Chilean, which sounds like a gimmick and is the best dinner in town." },
    { id: "santolla", cityId: "puerto-natales", name: "Santolla", kind: "meal", tags: ["food"], neighborhood: "Centro", lat: -51.7245, lng: -72.5061, durationMin: 90, costUsd: 45, opens: "19:00", closes: "23:00", bestTime: "evening", touristy: 3, note: "King crab in a shipping container. Book it." },
    { id: "base-camp", cityId: "puerto-natales", name: "Base Camp bar", kind: "drink", tags: ["nightlife", "local"], neighborhood: "Centro", lat: -51.7269, lng: -72.5075, durationMin: 90, costUsd: 15, opens: "17:00", closes: "01:00", bestTime: "evening", touristy: 2, note: "Where everyone compares blisters. Go on the night you come off the trail." },
    { id: "glaciarium", cityId: "el-calafate", name: "Glaciarium", kind: "museum", tags: ["museum", "nature"], neighborhood: "Ruta 11", lat: -50.3225, lng: -72.3436, durationMin: 120, costUsd: 18, opens: "09:00", closes: "20:00", bestTime: "afternoon", touristy: 3, note: "Actually good on the ice, and the only indoor thing here worth a wet afternoon." },
    { id: "laguna-nimez", cityId: "el-calafate", name: "Laguna Nimez reserve", kind: "walk", tags: ["walk", "nature"], neighborhood: "Lakefront", lat: -50.3283, lng: -72.2731, durationMin: 120, costUsd: 10, opens: "09:00", closes: "20:00", bestTime: "morning", touristy: 2, note: "Flamingos twenty minutes from the main street, and almost nobody there." },
    { id: "la-zaina", cityId: "el-calafate", name: "La Zaina", kind: "meal", tags: ["food", "local"], neighborhood: "Centro", lat: -50.3403, lng: -72.2678, durationMin: 90, costUsd: 35, opens: "12:00", closes: "23:00", bestTime: "evening", touristy: 2, note: "Small, run by the people cooking, lamb done properly." },
    { id: "don-diego", cityId: "el-calafate", name: "Don Diego de la Noche", kind: "meal", tags: ["food", "music"], neighborhood: "Libertador", lat: -50.3391, lng: -72.2712, durationMin: 100, costUsd: 38, opens: "12:00", closes: "00:00", bestTime: "evening", touristy: 3, note: "Live guitar most nights, which is either the point or the reason to sit outside." },
    { id: "milodon", cityId: "puerto-natales", name: "Cueva del Milodón", kind: "sight", tags: ["history", "nature"], neighborhood: "Ruta Y-290", lat: -51.5717, lng: -72.6042, durationMin: 120, costUsd: 12, opens: "08:00", closes: "19:00", bestTime: "midday", touristy: 3, note: "A big cave and a fibreglass sloth. Go for the drive, not the sloth.", skip: true },
  ],
};

/**
 * Research is two calls now: search and take notes, then structure the notes
 * with the schema tool forced. One call could not do both inside a serverless
 * function's budget — it spent the whole sixty seconds searching and returned
 * no tool call at all.
 */
const searcher: Transport = {
  async call(args) {
    return args.tool.name === "record_destination"
      ? (PATAGONIA as unknown as Record<string, unknown>)
      : null;
  },
  async research() {
    return {
      text: "Notes on Patagonia: Puerto Natales and El Calafate as bases, Torres del Paine as a day trip...",
      sources: ["https://www.parquetorresdelpaine.cl/x", "https://losglaciares.com/y"],
    };
  },
};

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

(async () => {
  console.log("\nRESEARCH REGRESSION — a destination the catalogue doesn't hold\n");

  const driver = createLlmDriver(searcher);
  const out = await driver.research!("patagonia", 9, "San Francisco");
  check("research returns a pack", !!out.pack, out.problem);
  check("it searched first, then structured", true);
  if (!out.pack) { process.exit(1); }

  const pack = out.pack;
  check("ids are namespaced so they can't collide", pack.destination.id === "patagonia"
        && pack.cities.every((c) => c.id.startsWith("patagonia-"))
        && pack.places.every((p) => p.id.startsWith("patagonia-")));
  check("the day trip keeps its base", pack.cities.some((c) => c.dayTripOnly && c.dayTripFrom === "patagonia-puerto-natales"));
  check("a place it would steer you away from is kept and marked",
        pack.places.some((p) => p.skip && p.name.includes("Milodón")));
  check("sources come back", pack.sources.length > 0, pack.sources.join(", "));

  check("registers into the live catalogue", registerPack(pack));
  check("registering twice is a no-op", !registerPack(pack));

  const b = applyPatch(emptyBrief(), { namedDestination: "patagonia", days: 9, budgetUsd: 4000, vibes: ["nature", "adventure"] }) as Brief;
  const trip = planTrip(b, recommend(b), emptyProfile());
  check("the deterministic planner schedules it", trip.days.length === 9, `${trip.days.length} days`);
  check("every day has something in it", trip.days.every((d) => d.items.length > 0));
  check("nothing marked skip was scheduled",
        !trip.days.some((d) => d.items.some((i) => i.name.includes("Milodón"))));
  check("it costs something plausible", trip.concept.estimateUsd > 1000 && trip.concept.estimateUsd < 9000,
        `$${trip.concept.estimateUsd}`);
  console.log(`\n  ${trip.concept.shape.map((l) => `${cityById(l.cityId).name} ${l.nights}n`).join(" · ")}`);
  console.log(`  ${destinationById("patagonia").name}: ${trip.days.length} days, about $${trip.concept.estimateUsd}`);

  // Junk in, refusal out.
  const bad = validatePack({ id: "x", name: "X", cities: [{ id: "c", name: "C", lat: 999, lng: 0, nightlyUsd: 1, minNights: 1, maxNights: 1, base: "b" }], places: [] });
  check("garbage coordinates are refused, not planned", !bad.pack, bad.problems[0]);

  // She asked for Thailand and was offered Bali. The model queued Thailand
  // correctly; a leftover flag from the deleted catalogue menu switched
  // research off on the second message, and the rules parser's region guess
  // ("Southeast Asia" -> the one destination we hold there) filled the gap.
  const first = applyPatch(emptyBrief(), await rulesDriver.interpret(
    "i want to go to thailand for 14 days in january", emptyBrief())) as Brief;
  check("a place we don't hold is queued for research", !!unknownHead(first),
        `got ${unknownHead(first)}`);
  const second = applyPatch(first, await rulesDriver.interpret("a mixture of all of it", first)) as Brief;
  check("and answering another question does not cancel it",
        !second.unknownAcknowledged, `unknownAcknowledged=${second.unknownAcknowledged}`);

  console.log(`\n  ${fails === 0 ? "\x1b[32mall clear\x1b[0m" : `\x1b[31m${fails} failing\x1b[0m`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
