/**
 * A place she ruled out had nowhere to live.
 *
 * "i wanna go to turkey but not istanbul" parsed the country correctly and
 * dropped the exclusion on the floor. Not a parser miss: there was no field
 * for it. avoidTags is a fixed list of 28 tags and none of them is a city
 * name; constraints is free text that only select.ts reads, and only to match
 * those same tags. So Turkey would be researched and Istanbul come back as the
 * obvious first base, and she would be shown an itinerary starting in the one
 * city she had ruled out.
 *
 * Three layers, because a prompt is not an enforcement mechanism:
 * the parser records it, the researcher is told, the planner refuses to sleep
 * there.
 */
import { interpretRules } from "@/lib/discovery";
import { applyPatch } from "@/lib/brief";
import { researchPrompt } from "@/lib/research";
import { planTrip } from "@/lib/planner";
import { recommend } from "@/lib/recommend";
import { emptyBrief, emptyProfile } from "@/lib/types";
import type { Brief } from "@/lib/types";
import { CITIES } from "@/data/destinations";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  somewhere she ruled out\n");

// --- it is recorded at all ------------------------------------------------
{
  const said = "i wanna go to turkey but not istanbul";
  const b = applyPatch(emptyBrief(said), interpretRules(said, emptyBrief()));
  check("the country still parses", JSON.stringify(b.unknownCandidates) === JSON.stringify(["turkey"]),
    JSON.stringify(b.unknownCandidates));
  check("and the exclusion is kept", JSON.stringify(b.avoidPlaces) === JSON.stringify(["istanbul"]),
    JSON.stringify(b.avoidPlaces));
}
{
  const said = "portugal, not lisbon";
  const b = applyPatch(emptyBrief(said), interpretRules(said, emptyBrief()));
  check("a comma clause works too", (b.avoidPlaces ?? []).includes("lisbon"), JSON.stringify(b.avoidPlaces));
}
{
  // A tag is not a place. "not museums" must stay a tag, or every avoided
  // interest becomes a fake city.
  const said = "japan but not museums";
  const b = applyPatch(emptyBrief(said), interpretRules(said, emptyBrief()));
  check("an avoided interest is not filed as a place",
    !(b.avoidPlaces ?? []).length && b.avoidTags.includes("museum"),
    `places=${JSON.stringify(b.avoidPlaces)} tags=${JSON.stringify(b.avoidTags)}`);
}
{
  const first = "turkey but not istanbul";
  let b = applyPatch(emptyBrief(first), interpretRules(first, emptyBrief()));
  b = applyPatch(b, interpretRules("also not ankara", b));
  check("ruling somewhere out only ever adds", (b.avoidPlaces ?? []).length === 2,
    JSON.stringify(b.avoidPlaces));
}

// --- the researcher is told ----------------------------------------------
{
  const p = researchPrompt("turkey", 7, "San Francisco", "food and coast", ["istanbul"]);
  check("the prompt names it", /RULED THESE OUT: istanbul/.test(p));
  check("and says passing through is fine but staying is not",
    /Passing through on the way somewhere is fine, staying/.test(p));
  check("with nothing ruled out the prompt is unchanged",
    !/RULED THESE OUT/.test(researchPrompt("turkey", 7, "San Francisco", "food and coast")));
}

// --- and the planner will not sleep there --------------------------------
{
  const prof = emptyProfile();
  const dest = "portugal";
  const lisbon = CITIES.find((c) => c.destinationId === dest && /lisbon/i.test(c.name))!;
  const b: Brief = { ...emptyBrief("x"), vibes: ["food"] as any, days: 7, namedDestination: dest };
  const before = planTrip(b, recommend(b, prof), prof);
  check("Lisbon is normally a base", before.concept.shape.some((l) => l.cityId === lisbon.id),
    before.concept.shape.map((l) => l.cityId).join(" > "));

  const avoided: Brief = { ...b, avoidPlaces: ["lisbon"] };
  const after = planTrip(avoided, recommend(avoided, prof), prof);
  check("ruled out, it is not a base", !after.concept.shape.some((l) => l.cityId === lisbon.id),
    after.concept.shape.map((l) => l.cityId).join(" > "));
  check("and the trip still happens", after.days.length === 7 && after.concept.shape.length > 0);
}
{
  // Ruling out everywhere must not produce a tripless trip.
  const prof = emptyProfile();
  const b: Brief = { ...emptyBrief("x"), vibes: ["food"] as any, days: 6,
    namedDestination: "portugal", avoidPlaces: ["portugal", "lisbon", "porto", "sintra", "algarve", "douro", "evora"] };
  const t = planTrip(b, recommend(b, prof), prof);
  check("ruling out everywhere falls back rather than failing",
    t.concept.shape.length > 0 && t.days.length === 6,
    t.concept.shape.map((l) => l.cityId).join(" > "));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
