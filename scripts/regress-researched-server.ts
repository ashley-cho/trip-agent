/**
 * Regression: the server has never heard of the place you just researched.
 *
 * "model failed — rules" on every researched trip was not a failed API call
 * and not a rate limit. It was `Cannot read properties of undefined (reading
 * 'id')`. A researched destination is registered into the BROWSER's copy of
 * the catalogue; the route runs in a different process, where Yunnan does not
 * exist. So `destinationById("yunnan")` came back undefined, the pitch and the
 * room booking both threw, and the traveller got rules-written prose with no
 * indication that anything had gone wrong.
 *
 * The context now travels with the request. Because the deployment is public,
 * it is treated as untrusted input on arrival.
 */
import { safePlaceContext } from "@/lib/place-context";
import { staysPrompt } from "@/lib/stays";
import { rulesDriver } from "@/lib/agent/rules";
import { emptyBrief } from "@/lib/types";
import type { PlaceContext } from "@/lib/agent/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

async function main() {
console.log("\n\x1b[1mA PLACE THE SERVER DOESN'T HOLD\x1b[0m\n");

  const wire = {
    destination: {
      id: "yunnan", name: "Yunnan, China", pitch: "Gorges and high trails.",
      because: { nature: "Tiger Leaping Gorge." }, caveat: "Altitude.",
      hubCityId: "kunming", arrival: "fly", warmth: 3, minDays: 8,
      flightUsd: 900, floorPerDayUsd: 70,
      strengths: { nature: 5, exploration: 4, food: 3, relaxation: 2, culture: 3, adventure: 5, city: 2 },
      paceFit: ["mixed"],
    },
    cities: [
      { id: "kunming", name: "Kunming", lat: 25.04, lng: 102.71, nightlyUsd: 55, minNights: 2, maxNights: 4, base: "Green Lake" },
      { id: "shangrila", name: "Shangri-La", lat: 27.83, lng: 99.7, nightlyUsd: 45, minNights: 2, maxNights: 4, base: "Dukezong" },
    ],
  };

  const place = safePlaceContext(wire)!;
  check("a researched destination survives the wire", !!place, place?.destination.name);

  // The exact crash: this used to read `.id` off undefined.
  let prompt = "", threw = "";
  try { prompt = staysPrompt([{ cityId: "kunming", nights: 3 }, { cityId: "shangrila", nights: 3 }], emptyBrief(), "yunnan", place); }
  catch (e) { threw = (e as Error).message; }
  check("booking rooms in it no longer throws", !threw, threw);
  check("and the prompt names the real cities",
    prompt.includes("Kunming") && prompt.includes("Shangri-La"), prompt.split("\n")[2] ?? "");

  // The pitch used to die on destinationById() coming back undefined.
  let pitched = "", pthrew = "";
  try {
    const p = await rulesDriver.pitch({ destinationId: "yunnan", confidence: "high", scores: [] }, emptyBrief(), place);
    pitched = `${p.headline} ${p.body}`;
  } catch (e) { pthrew = (e as Error).message; }
  check("pitching it no longer throws", !pthrew, pthrew);
  check("and it names the place we planned", /Yunnan/.test(pitched), pitched.slice(0, 70));

  // Without the context, the old behaviour: it must fail loudly, not silently
  // produce a pitch for the wrong place.
  let noCtx = "ok";
  try { await rulesDriver.pitch({ destinationId: "yunnan", confidence: "high", scores: [] }, emptyBrief()); }
  catch (e) { noCtx = (e as Error).message; }
  check("with no context it still fails rather than inventing one", noCtx !== "ok", noCtx);

  // It is client-supplied text on a public deployment. Treat it as input.
  check("garbage is refused outright", safePlaceContext({ destination: {} }) === undefined);
  check("so is a context with no cities",
    safePlaceContext({ destination: wire.destination, cities: [] }) === undefined);
  check("a nonsense type is refused", safePlaceContext("yunnan") === undefined);
  const huge = safePlaceContext({
    destination: { ...wire.destination, name: "x".repeat(9000), pitch: "y".repeat(90000) },
    cities: Array.from({ length: 200 }, (_, i) => ({ ...wire.cities[0], id: `c${i}` })),
  })!;
  check("an oversized one is cut down, not passed through",
    huge.destination.name.length <= 80 && huge.destination.pitch.length <= 600 && huge.cities.length <= 12,
    `name ${huge.destination.name.length}, pitch ${huge.destination.pitch.length}, ${huge.cities.length} cities`);
  check("and coordinates can't be off the planet",
    safePlaceContext({ destination: wire.destination, cities: [{ ...wire.cities[0], lat: 9999 }] })!
      .cities[0].lat === 90);

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}
main();
