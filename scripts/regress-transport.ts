/**
 * We do not sell train tickets to places with no railway.
 *
 * One line in the planner decided how you got between every pair of cities we
 * had no data for, and it said "train", at 93 km/h, forever. So a seven-day
 * Canada trip came back with an 11-hour train from Edmonton to Yellowknife,
 * twice, priced, in the bookings panel, across 983 km of subarctic bush with
 * no rail link. The same fabrication put a metro and a tram into Reykjavík.
 *
 * It cost two days as well. A 665-minute leg leaving at 09:30 lands at 20:35,
 * so the planner had nowhere to put anything and printed "Move to Yellowknife
 * — 0 things". The empty transit day was the same bug wearing a different
 * hat.
 *
 * The seeded table still wins, because it is real. Below it, geography, and
 * above both, what the traveller actually said they want to travel by.
 */
import { resolveLeg, legVerb, legReason, plausible } from "@/lib/transport";
import { cityById } from "@/data/destinations";
import type { City } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};
const at = (name: string, lat: number, lng: number): City =>
  ({ id: name.toLowerCase(), name, destinationId: "x", lat, lng } as City);

console.log("\n\x1b[1mHOW YOU ACTUALLY GET THERE\x1b[0m\n");

// --- the one that shipped ------------------------------------------------
{
  const edmonton = at("Edmonton", 53.5461, -113.4938);
  const yellowknife = at("Yellowknife", 62.4540, -114.3718);
  const leg = resolveLeg(edmonton, yellowknife);
  check("Edmonton to Yellowknife is a flight", leg.mode === "fly",
    `${legVerb(leg.mode)} — ${leg.km} km, ${Math.round(leg.minutes / 60)}h`);
  check("and it does not eat the whole day", leg.minutes < 300, `${leg.minutes} min`);
  check("and it is not claimed as checked", !leg.known);
  check("the copy says it is a flight", legVerb(leg.mode) === "Fly to");
  check("and admits it is not a timetable",
    /haven't checked/.test(legReason(leg, "Yellowknife")), legReason(leg, "Yellowknife"));
}

// --- real data still wins -------------------------------------------------
{
  const leg = resolveLeg(cityById("lisbon"), cityById("porto"));
  check("the Lisbon-Porto train is still the train", leg.mode === "train" && leg.known,
    `${leg.mode}, ${leg.minutes} min`);
  check("and keeps its checked wording", !/haven't checked/.test(legReason(leg, "Porto")));

  const drive = resolveLeg(cityById("reykjavik"), cityById("vik"));
  check("Reykjavík to Vík is still the Ring Road drive", drive.mode === "car" && drive.known);
}

// --- a stated preference wins over geography ------------------------------
{
  const a = at("A", 40.0, -3.0);
  const b = at("B", 41.5, -4.5);   // ~200 km
  check("someone who wants to drive gets to drive", resolveLeg(a, b, "car").mode === "car");
  check("someone who wants the train gets the train", resolveLeg(a, b, "train").mode === "train");
  check("someone who wants the bus gets the bus", resolveLeg(a, b, "bus").mode === "bus");
  // ...but only where it is a straight-faced answer.
  const far = at("Far", 55.0, -3.0);   // ~1670 km
  check("nobody drives 1600 km between two bases", resolveLeg(a, far, "car").mode === "fly",
    `${resolveLeg(a, far, "car").km} km`);
  check("and nobody takes that train either", resolveLeg(a, far, "train").mode === "fly");
  check("but a short hop is not a flight", resolveLeg(a, b, "fly").mode !== "fly" || false,
    `${resolveLeg(a, b, "fly").km} km -> ${resolveLeg(a, b, "fly").mode}`);
}

// --- real data beats the preference too -----------------------------------
//
// "I'd rather drive" should change the drive, not invent a different train.
{
  const leg = resolveLeg(cityById("lisbon"), cityById("porto"), "car");
  check("a preference does not overwrite a checked leg", leg.known && leg.mode === "train");
}

// --- the plausibility rules, stated plainly -------------------------------
for (const [mode, km, want] of [
  ["fly", 120, false], ["fly", 900, true],
  ["car", 400, true], ["car", 1200, false],
  ["train", 300, true], ["train", 1000, false],
  ["ferry", 100, false],
] as const) {
  check(`${mode} at ${km} km is ${want ? "plausible" : "not"}`, plausible(mode, km) === want);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
