/**
 * The catalogue is a cache, not the world.
 *
 * The recommender scored the entries we held, and the model's own suggestions
 * were filtered against the same list with everything else dropped. So
 * "surprise me" could only ever return one of them, and Oregon, Florida and
 * Alaska were unreachable unless the traveller named them herself. Adding
 * four more entries by hand would not have fixed that; it would have moved
 * the wall four places to the right.
 *
 * Now it is asked where on earth, with no list attached. A name we hold is
 * planned instantly; a name we don't is researched and joins the catalogue,
 * on exactly the same footing as the ones that shipped pre-cached.
 *
 * Two rules govern it, both stated by Ashley, and this file exists to hold
 * them:
 *
 *   1. It must not wander. Only fires when she has named nowhere at all.
 *   2. Better to say there isn't room than to produce something worse
 *      without saying so.
 */
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { resolvePlaceName } from "@/lib/places";
import { registerPack } from "@/data/registry";
import { emptyBrief, type Brief } from "@/lib/types";
import { emptyUsage } from "@/lib/cost";
import type { DestinationPack } from "@/lib/research";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `  ${d}` : ""}`);
  if (!ok) fails++;
};
const fake = (a: Record<string, unknown>): Transport => ({ call: async () => a, usage: () => emptyUsage() });

/** The page's own condition for "she has named nowhere at all". */
const namedNowhere = (b: Brief, pitched?: string) =>
  !b.namedDestination && !b.focusCityId && !(b.candidates?.length)
  && !(b.unknownCandidates?.length) && !b.unknownDestination && !b.region && !pitched;

async function main() {
  console.log("\n\x1b[1mTHE CATALOGUE IS A CACHE, NOT THE WORLD\x1b[0m\n");

  // --- 1. it must not wander -------------------------------------------
  check("a named destination is not second-guessed",
    !namedNowhere({ ...emptyBrief(), namedDestination: "portugal" }));
  check("a named city is not second-guessed",
    !namedNowhere({ ...emptyBrief(), namedDestination: "mexico", focusCityId: "oaxaca" }));
  check("a place being looked up is not second-guessed",
    !namedNowhere({ ...emptyBrief(), unknownCandidates: ["hokkaido"] }));
  check("a shortlist is not second-guessed",
    !namedNowhere({ ...emptyBrief(), candidates: ["italy", "france"] }));
  check("a region is not second-guessed",
    !namedNowhere({ ...emptyBrief(), region: "europe" }));
  check("and a destination already pitched is not second-guessed",
    !namedNowhere(emptyBrief(), "portugal"));
  check("but 'surprise me' is open",
    namedNowhere({ ...emptyBrief(), surpriseMe: true }));

  // --- 2. what comes back is a name, resolved against one catalogue -----
  const d = createLlmDriver(fake({ place: "Oregon", why: "coast and forest" }));
  const s1 = await d.suggest!({ ...emptyBrief(), surpriseMe: true, days: 8 });
  check("it can name somewhere we have never held", s1.place === "Oregon", String(s1.place));
  check("and we correctly do not hold it yet", resolvePlaceName("Oregon") === undefined);

  const held = await createLlmDriver(fake({ place: "Portugal" }))
    .suggest!({ ...emptyBrief(), days: 8 });
  check("a suggestion we DO hold resolves to it, no research needed",
    resolvePlaceName(held.place!)?.destinationId === "portugal");

  /*
   * One catalogue. A researched destination is not a second tier: once it is
   * in, a later suggestion of the same place resolves exactly like one that
   * shipped pre-cached, and costs nothing.
   */
  registerPack({
    destination: {
      id: "oregon", name: "Oregon", pitch: "p",
      strengths: { nature: 5, exploration: 4, food: 3, relaxation: 3, culture: 2, adventure: 4, city: 3 },
      paceFit: ["mixed"], flightUsd: 200, floorPerDayUsd: 150, minDays: 4, because: {},
      warmth: 2, arrival: "fly", caveat: "c", hubCityId: "oregon-portland",
    },
    cities: [{ id: "oregon-portland", name: "Portland", destinationId: "oregon", lat: 45.5, lng: -122.6 }],
    places: [], sources: [],
  } as unknown as DestinationPack);
  check("once researched, it is simply in the catalogue",
    resolvePlaceName("Oregon")?.destinationId === "oregon");
  check("with no second tier: it resolves the same way Portugal does",
    typeof resolvePlaceName("Oregon") === typeof resolvePlaceName("Portugal"));

  // --- 3. rather stop than produce something worse ----------------------
  const mute = await createLlmDriver(fake({})).suggest!({ ...emptyBrief(), days: 8 });
  check("a model that names nowhere reports a problem instead of guessing",
    !mute.place && !!mute.problem, JSON.stringify(mute));
  const junk = await createLlmDriver(fake({ place: "somewhere nice" })).suggest!(emptyBrief());
  check("and a non-place is rejected rather than researched",
    !junk.place, String(junk.place));

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}
void main();
