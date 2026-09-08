/**
 * Regression: "This page couldn't load".
 *
 * A completed trip to the Faroe Islands, then a reload, and the entire app
 * white-screened. Not that trip: every trip in the browser, and the home
 * screen with them.
 *
 * Researched destinations were held in memory only and deliberately never
 * persisted, on the sound reasoning that live data ages. But the SAVED TRIP
 * was persisted, pointing at an id that no longer existed anywhere, and
 * `destinationById` ended in a non-null assertion that was simply untrue:
 *
 *     DESTINATIONS.find((d) => d.id === id)!
 *
 * so the lookup returned undefined, `.name` threw during render, and there was
 * no way back into the application short of clearing site data.
 *
 * Two things had to change. A trip now carries the researched catalogue it
 * depends on and puts it back before anything renders. And the catalogue
 * stopped lying: an id it doesn't hold degrades to a readable placeholder,
 * because no single saved trip may ever take the app down again.
 */
import { destinationById, cityById, isKnownDestination } from "@/data/destinations";
import { registerPack } from "@/data/registry";
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA SAVED TRIP MAY NOT TAKE DOWN THE APP\x1b[0m\n");

// The placeholder is a BROWSER safety net. On the server an unknown
// destination stays a hard error, because guessing there is how the agent
// confidently describes the wrong country; regress-researched-server guards
// that, and this test runs in node, so stand up a window first.
(globalThis as { window?: unknown }).window = globalThis;

// The exact crash: an id nothing holds.
{
  let d: { name?: string } | undefined;
  let threw = false;
  try { d = destinationById("faroe-islands"); } catch { threw = true; }
  check("looking up an unloaded destination does not throw", !threw);
  check("and reads correctly rather than as an id", d?.name === "Faroe Islands", String(d?.name));
  check("while still being known as not-in-the-catalogue",
    !isKnownDestination("faroe-islands"));
  let cityThrew = false;
  try { cityById("faroe-islands-torshavn"); } catch { cityThrew = true; }
  check("nor does an unloaded city", !cityThrew);
}

// A real catalogue entry is untouched.
{
  check("a real destination is unaffected", isKnownDestination("portugal")
    && destinationById("portugal").name.length > 0, destinationById("portugal").name);
}

// Re-registering a saved pack restores the real thing.
{
  const pack = {
    destination: {
      id: "faroe-islands", name: "Faroe Islands", hubCityId: "faroe-islands-torshavn",
      pitch: "Cliffs and fog.", strengths: {} as never, paceFit: ["mixed" as const],
      flightUsd: 900, floorPerDayUsd: 180, minDays: 5, because: {}, warmth: 1 as const,
      arrival: "fly" as const, caveat: "Weather runs the show.",
    },
    cities: [{
      id: "faroe-islands-torshavn", name: "Tórshavn", destinationId: "faroe-islands",
      lat: 62, lng: -6.77, nightlyUsd: 160, minNights: 2, maxNights: 5, base: "Old town edge.",
    }],
    places: [], sources: [],
  };
  check("a trip's saved pack puts the real destination back", registerPack(pack as never));
  check("and it resolves properly afterwards", isKnownDestination("faroe-islands")
    && destinationById("faroe-islands").caveat === "Weather runs the show.");
}

// The wiring, since the crash was a missing call rather than a bad function.
{
  const page = readFileSync("app/page.tsx", "utf8");
  check("opening a trip re-registers its pack before rendering",
    /if \(t\.pack\) registerPack\(t\.pack\)/.test(page));
  check("and saving a trip stores it",
    /pack: packForTrip\(brief, trip\)/.test(page));
  const dests = readFileSync("data/destinations.ts", "utf8");
  check("no lookup ends in a non-null assertion any more",
    !/DESTINATIONS\.find\(\(d\) => d\.id === id\)!/.test(dests)
    && !/CITIES\.find\(\(c\) => c\.id === id\)!/.test(dests));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
