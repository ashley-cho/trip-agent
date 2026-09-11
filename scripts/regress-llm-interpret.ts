/**
 * Regression: the model interprets, the regex is only the fallback.
 *
 * record_brief used to have five fields. Everything else the brief holds —
 * where they want to go, regions, shortlists, dates, origin, indifference,
 * road trips — could only be filled by hand-written patterns, so the model was
 * live and still not the thing reading the sentence. These check the model's
 * answer actually lands.
 */
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { applyPatch } from "@/lib/brief";
import { emptyBrief, emptyProfile, type Brief, unknownHead } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { destinationById } from "@/data/destinations";
import { rulesDriver } from "@/lib/agent/rules";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

/** Stands in for the model, answering as the schema asks it to. */
const model = (answer: Record<string, unknown>): Transport => ({
  async call(args) {
    return args.tool.name === "record_brief" ? answer : null;
  },
});

/*
 * The sentence matters, and this helper used to throw it away.
 *
 * It passed "..." as the user's text while asserting on how that text was
 * read, so every backstop that consults her actual words was being tested
 * against three dots. The Croatia case passed for the wrong reason: nothing
 * in it was recognisable as a place she said she wanted to GO to, and the
 * code took the whole unknown list anyway as a fallback. Tightening that
 * fallback in production is what exposed the fake input here.
 */
const read = async (
  answer: Record<string, unknown>,
  said = "...",
  from: Brief = emptyBrief(),
) => applyPatch(from, await createLlmDriver(model(answer)).interpret(said, from)) as Brief;

(async () => {
  console.log("\nMODEL INTERPRETATION\n");

  // "i want to do a roadtrip in europe"
  const euro = await read({
    destination_ids: ["portugal", "andalusia", "catalonia", "italy", "france", "denmark", "iceland"],
    scope: "Europe",
    road_trip: true,
  }, "i want to do a roadtrip in europe");
  check("a region becomes a filter, not a destination",
        !euro.namedDestination && (euro.regionIds ?? []).length === 7, `named=${euro.namedDestination ?? "-"}`);
  check("the road trip is recorded as a shape", euro.roadTrip === true);
  const euroRec = recommend({ ...euro, days: 9, vibes: ["nature"] } as Brief, emptyProfile());
  check("and it recommends inside the region",
        (euro.regionIds ?? []).includes(euroRec.destinationId),
        destinationById(euroRec.destinationId).name);

  // "i want to go to croatia or southern france. recs?"
  /*
   * Croatia in the original report. Dalmatia is shipped data now, so croatia
   * is a place we HOLD and this pair stopped being one-held-one-not — which is
   * the whole shape being tested, and the model's `unknown_places` entry for
   * it is now simply wrong. Montenegro is the neighbour we still hold nothing
   * in, so the fixture keeps its shape and the assertions are unchanged.
   */
  const two = await read({
    destination_ids: ["france"],
    unknown_places: ["Montenegro"],
    scope: "Montenegro or southern France",
  }, "i want to go to montenegro or southern france. recs?");
  check("keeps the place we hold", two.namedDestination === "france" || (two.candidates ?? []).includes("france"),
        `named=${two.namedDestination} candidates=${JSON.stringify(two.candidates)}`);
  check("and never drops the one we don't", (two.unknownCandidates ?? []).some((x) => /montenegro/i.test(x)),
        JSON.stringify(two.unknownCandidates));

  // A shortlist of two we hold: a decision, not a region.
  const pair = await read({ destination_ids: ["france", "italy"], scope: "France or Italy" },
    "france or italy, i can't decide");
  check("two named places are a shortlist to decide between",
        (pair.candidates ?? []).length === 2 && !pair.regionIds, JSON.stringify(pair.candidates));
  const pairRec = recommend({ ...pair, days: 8, vibes: ["food"] } as Brief, emptyProfile());
  check("it decides, and keeps the runner-up", pairRec.confidence === "high" && !!pairRec.alternativeId,
        `${destinationById(pairRec.destinationId).name}, over ${pairRec.alternativeId ? destinationById(pairRec.alternativeId).name : "-"}`);

  // Her real Portugal message.
  const pt = await read({
    destination_ids: ["portugal"],
    start_date: "2026-10-12", end_date: "2026-10-21",
    days: 12,                      // deliberately wrong: the dates must win
    budget_usd: 2500,
    vibes: ["culture", "exploration", "nature"],
    not_vibes: ["food"],
    origin_city: "San Francisco",
    constraint: "no film festival",
  });
  check("dates land as a real calendar", pt.dates?.start === "2026-10-12" && pt.dates?.end === "2026-10-21");
  check("length is recomputed from the dates, not taken on trust", pt.days === 9, `got ${pt.days}`);
  check("the month comes with them", pt.month === "October", `got ${pt.month}`);
  check("the origin airport resolves", pt.origin?.label === "San Francisco", `got ${pt.origin?.label}`);
  check("indifference removes the vibe", !pt.vibes.includes("food"), pt.vibes.join(", "));
  check("and is not filed as an aversion", !pt.avoidTags.includes("food"));

  // "i want to go roadtripping in australia" — the model mapped it to nothing,
  // listed no unknown_places, and left Australia sitting in scope where nothing
  // read it. The place she named vanished and the agent offered the Olympic
  // Peninsula. Scope is the backstop now.
  const aus = await read({ destination_ids: [], scope: "Australia", road_trip: true },
    "thinking about roadtripping in australia");
  check("a named place with no catalogue match is never dropped",
        unknownHead(aus) === "Australia", `got ${unknownHead(aus) ?? "nothing"}`);
  check("and it is queued for research", (aus.unknownCandidates ?? []).includes("Australia"));

  // The fallback parser has to survive the same sentence on its own.
  const ausRules = applyPatch(emptyBrief(),
    await rulesDriver.interpret("i want to go roadtripping in australia. suggest an itinerary", emptyBrief())) as Brief;
  check("the fallback reads 'roadtripping in X' too",
        unknownHead(ausRules)?.toLowerCase() === "australia", `got ${unknownHead(ausRules)}`);

  // Junk from the model must not reach the planner.
  const junk = await read({
    destination_ids: ["atlantis", "portugal"],
    start_date: "2026-02-31", end_date: "nonsense",
    budget_usd: -5, days: 900,
    vibes: ["teleportation"], not_vibes: ["also-fake"],
  }, "i want to go to portugal, roughly 900 days, budget minus five dollars");
  check("an invented destination id is dropped", junk.namedDestination === "portugal", `got ${junk.namedDestination}`);
  check("an impossible date is dropped", junk.dates === undefined);
  check("an out-of-range budget is dropped", junk.budgetUsd === undefined, `got ${junk.budgetUsd}`);
  check("an invented vibe is dropped", junk.vibes.length === 0, junk.vibes.join(", "));

  console.log(`\n  ${fails === 0 ? "\x1b[32mall clear\x1b[0m" : `\x1b[31m${fails} failing\x1b[0m`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
