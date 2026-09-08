/**
 * Regression: stay on the region she named. Period.
 *
 * Three failures from the sweep, one rule.
 *
 *   "lisbon ... food, viewpoints and tiles"  -> researched a country called
 *      Viewpoints, failed, and planned Mexico City.
 *   "the faroe islands"                      -> research fell short, so the
 *      recommender scored the catalogue and pitched New Zealand.
 *   "hokkaido"                               -> quietly collapsed to Japan and
 *      never researched Hokkaido at all.
 *
 * The model was faithful in all three. It resolved Lisbon and wrote a good
 * Lisbon paragraph; the code then went looking elsewhere, handed the model a
 * different destination, and the model argued for that one instead. So the fix
 * belongs in the deterministic layer, which is the layer that wandered.
 *
 * One subject per conversation:
 *   - it matches a destination we hold  -> plan that
 *   - it matches a city inside one      -> plan that city, not a tour
 *   - it matches nothing                -> research it, and never widen it to
 *     the country around it
 * Everything else in the sentence is interest, not geography.
 */
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { emptyBrief, unknownHead } from "@/lib/types";
import { emptyUsage } from "@/lib/cost";
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};
const fake = (answer: Record<string, unknown>): Transport => ({
  call: async () => answer,
  usage: () => emptyUsage(),
});
/*
 * The sentence matters now.
 *
 * validatePatch will only accept a place the model names if the traveller's
 * own words back it up, so a stand-in like "whatever she typed" corroborates
 * nothing and every where-field is stripped before the assertions run. That
 * is the guard working; the suite was the thing out of date. Unless a test
 * gives its own sentence, she says the place the model is answering with.
 */
const read = (answer: Record<string, unknown>, said?: string) => {
  const named = typeof answer.place_named === "string" ? answer.place_named : undefined;
  const first = Array.isArray(answer.unknown_places) ? String(answer.unknown_places[0]) : undefined;
  return createLlmDriver(fake(answer))
    .interpret(said ?? `i wanna go to ${named ?? first ?? "somewhere"}`, emptyBrief());
};

console.log("\n\x1b[1mONE SUBJECT, AND WE STAY ON IT\x1b[0m\n");

async function main() {

// Her Lisbon message, as the model actually answers it.
{
  const p = await read({
    place_named: "lisbon",
    destination_ids: ["portugal"],
    unknown_places: ["viewpoints", "tiles"],
    interest_echo: "food, viewpoints and tiles",
  });
  check("Lisbon resolves to the destination that holds it", p.namedDestination === "portugal",
    String(p.namedDestination));
  check("and Viewpoints is never researched",
    !(p.unknownCandidates ?? []).length && !p.unknownCandidates?.[0],
    JSON.stringify(p.unknownCandidates));
}

// A region inside a country we hold must not become the country.
for (const [said, ] of [["hokkaido"], ["the yucatan"], ["patagonia"]] as [string][]) {
  const p = await read({ place_named: said, destination_ids: ["japan"] });
  check(`"${said}" is researched as itself, not widened`,
    p.unknownCandidates?.[0] === said && p.namedDestination === undefined,
    `named=${p.namedDestination} unknown=${p.unknownCandidates?.[0]}`);
}

// A city we hold is planned from that city's data, and the city IS the trip.
for (const [said, want, city] of [
  ["Oaxaca", "mexico", "oaxaca"],
  ["Kyoto", "japan", "kyoto"],
  ["Porto", "portugal", "porto"],
] as [string, string, string][]) {
  const p = await read({ place_named: said, destination_ids: [] });
  check(`"${said}" uses the ${want} data`, p.namedDestination === want, String(p.namedDestination));
  check(`  and pins the trip to ${city}`, (p.focusCityId ?? "").includes(city),
    String(p.focusCityId));
}

// The model skips place_named more often than not: asked about Oaxaca it fills
// destination_ids with mexico and considers the question answered. Live, that
// meant "oaxaca" still came back as "Mexico City & Oaxaca" with the whole
// subject mechanism shipped. So the code reads her sentence itself.
{
  const p = await read(
    { destination_ids: ["mexico"] },
    "i want to go to oaxaca for 6 days. food, markets and craft. budget about $2,500, flying from san francisco.",
  );
  check("a city she typed is found without the model naming it",
    (p.focusCityId ?? "").includes("oaxaca"), String(p.focusCityId));
  check("and where she is flying FROM is not where she is going",
    !(p.focusCityId ?? "").includes("seattle") && !(p.focusCityId ?? "").includes("francisco"),
    String(p.focusCityId));
}
{
  const p = await read({ destination_ids: ["mexico"] }, "i want to go to mexico for ten days");
  check("naming only the country sets no city focus", !p.focusCityId, String(p.focusCityId));
}

// The shape builder honours it: one base, the one they named.
{
  const { buildShape } = await import("@/lib/planner");
  const { emptyProfile: prof } = await import("@/lib/types");
  const named = await read({ place_named: "Oaxaca", destination_ids: [] });
  const brief = { ...emptyBrief(), days: 6, namedDestination: named.namedDestination,
    focusCityId: named.focusCityId };
  const legs = buildShape(named.namedDestination!, 6, brief, prof());
  check("six days in Oaxaca is six days in Oaxaca", legs.length === 1,
    legs.map((l) => l.cityId).join(" + "));
  check("and not a tour of Mexico",
    !legs.some((l) => /mexico-city|mexicocity|cdmx/.test(l.cityId)),
    legs.map((l) => l.cityId).join(" + "));
}

// Naming the country still gets the country's shape.
{
  const { buildShape } = await import("@/lib/planner");
  const { emptyProfile: prof } = await import("@/lib/types");
  const brief = { ...emptyBrief(), days: 10, namedDestination: "mexico" };
  const legs = buildShape("mexico", 10, brief, prof());
  check("ten days in Mexico still moves you around", legs.length > 1,
    legs.map((l) => l.cityId).join(" + "));
}

// A destination named outright still works.
{
  const p = await read({ place_named: "Iceland", destination_ids: ["iceland"] });
  check("Iceland resolves straight through", p.namedDestination === "iceland");
}

// A shortlist is still a shortlist: no subject, so unknown_places survives.
{
  const p = await read({ unknown_places: ["Croatia", "Slovenia"], destination_ids: [] },
    "croatia or slovenia, haven't decided");
  check("choosing between two unheld places still researches both",
    (p.unknownCandidates ?? []).length === 2, JSON.stringify(p.unknownCandidates));
}

// An interest word alone is not a place.
{
  const p = await read({ place_named: "viewpoints", destination_ids: [] });
  check("a bare interest never becomes the subject",
    !p.unknownCandidates?.[0] && !p.namedDestination,
    `named=${p.namedDestination} unknown=${p.unknownCandidates?.[0]}`);
}

// And the wandering itself is gone.
{
  const page = readFileSync("app/page.tsx", "utf8") + readFileSync("lib/flow.ts", "utf8");
  check("failed research no longer falls through to the recommender",
    /I'm not going to send you somewhere else instead/.test(page)
    && /somewhere else instead[\s\S]{0,400}return;/.test(page));

  const llm = readFileSync("lib/agent/llm.ts", "utf8");
  check("the model is asked for one subject, not a list",
    /place_named/.test(llm) && /Geography only/.test(llm));
  check("and a declined question is no longer a failure",
    /if \(!prompt\) return gate === "must" \? floor : structural;/.test(llm));
}

}

main().then(() => {
  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
});
