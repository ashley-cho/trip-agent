/**
 * Faithful to what she said, or nothing at all.
 *
 * Her rule, asked directly what the app should do when it cannot pick:
 * "it must stay faithful to the user's input. that tops everything."
 *
 * Two failures made this necessary, both in one screenshot.
 *
 * She wrote "hm i wanna go to patagonia" and was told "Skip Patagonia this
 * time and go do Utah canyon country instead." Patagonia was already in the
 * catalogue, remembered from an earlier session, so subjects() dropped it as
 * "not a research subject", suggest was skipped because unknownDestination
 * was set, and the gate before the recommender had nothing to defend. Knowing
 * the place better was what lost it.
 *
 * The same pitch opened "You said nature and adventure". She said neither
 * word. Those are two of the seven internal vibe tags, and the open-field
 * branch of recommend() ranks the whole catalogue on them while reading
 * neither `opening` nor `interestEcho` — so "hike a national park", "scuba
 * dive coral reefs" and "safari" all produce the same ranking, and so does a
 * brief with no words in it.
 */
import { readFileSync } from "node:fs";
import { registerPack } from "@/data/registry";
import { subjects, statedPlaces, heldPlaces, namesSomewhere } from "@/lib/subject";
import { fabricatedAttribution } from "@/lib/agent/llm";
import { recommend } from "@/lib/recommend";
import { emptyBrief, emptyProfile } from "@/lib/types";
import type { Brief } from "@/lib/types";
import type { DestinationPack } from "@/lib/research";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  faithful to what she said\n");

// Her earlier Patagonia session, as hydratePacks() re-registers it on load.
registerPack({
  destination: {
    id: "patagonia", name: "Patagonia", hubCityId: "patagonia-puerto-natales",
    pitch: "Wind, granite, long days on foot.",
    strengths: { nature: 5, exploration: 4, food: 2, relaxation: 3, culture: 2, adventure: 5, city: 1 },
    paceFit: ["mixed"], flightUsd: 1200, floorPerDayUsd: 90, minDays: 6,
    warmth: 2, arrival: "fly", caveat: "Wind can shut the high ground.",
    because: { adventure: "Full-day exposed hikes like Valle Frances." },
  },
  cities: [{ id: "patagonia-puerto-natales", name: "Puerto Natales", destinationId: "patagonia",
             lat: -51.72, lng: -72.48, nightlyUsd: 120, minNights: 3, maxNights: 6,
             base: "The waterfront.", scale: "walkable" }],
  places: [],
} as unknown as DestinationPack);

// --- a place we hold must not vanish -------------------------------------
const said: Brief = { ...emptyBrief("i wanna hike a national park"),
  vibes: ["nature", "adventure"], unknownCandidates: ["patagonia"], days: 7 };

check("subjects() still drops it, because it needs no research",
  subjects(said).length === 0);
check("statedPlaces() keeps it, because she said it",
  statedPlaces(said).includes("patagonia"), JSON.stringify(statedPlaces(said)));
check("heldPlaces() knows we can answer it outright",
  heldPlaces(said).includes("patagonia"));
check("and the brief counts as naming somewhere", namesSomewhere(said));

const settled: Brief = { ...said, namedDestination: "patagonia", unknownCandidates: undefined };
check("settled, the recommender returns what she asked for",
  recommend(settled, emptyProfile()).destinationId === "patagonia",
  `got ${recommend(settled, emptyProfile()).destinationId}`);
check("unsettled, it does not (which is why the settle step exists)",
  recommend(said, emptyProfile()).destinationId !== "patagonia",
  `got ${recommend(said, emptyProfile()).destinationId}`);

// --- with nothing of hers, we do not rank the catalogue -------------------
const tagsOnly: Brief = { ...emptyBrief("i want a holiday"), vibes: ["nature", "adventure"], days: 7 };
check("a brief with only tags names nowhere", !namesSomewhere(tagsOnly));
for (const [label, b] of [
  ["a named destination", { ...tagsOnly, namedDestination: "iceland" }],
  ["a shortlist", { ...tagsOnly, candidates: ["iceland", "portugal"] }],
  ["a region", { ...tagsOnly, regionIds: ["portugal"] }],
  ["a place we have not looked up", { ...tagsOnly, unknownCandidates: ["the faroe islands"] }],
] as [string, Brief][]) check(`${label} does name somewhere`, namesSomewhere(b));

// --- the flow holds the same line ----------------------------------------
const flow = readFileSync("lib/flow.ts", "utf8");
check("the gate before the recommender reads statedPlaces, not subjects",
  /const open = statedPlaces\(b\)\[0\]/.test(flow));
check("a held place is settled onto the brief before the bookkeeping",
  /const held = heldPlaces\(b\)/.test(flow) && /unknownCandidates: undefined/.test(flow));
check("and nothing named means it stops instead of ranking tags",
  /if \(!pinned && !namesSomewhere\(b\)\)/.test(flow)
  && /refusing to rank the catalogue[\s\S]{0,400}return;/.test(flow));

// --- and the pitch cannot quote our tags at her --------------------------
const hers: Brief = { ...emptyBrief("i wanna hike a national park"),
  activities: ["hike a national park", "remote and quiet, away from crowds"] };
check("'You said nature and adventure' is caught",
  fabricatedAttribution("You said nature and adventure, so here's what that looks like.", hers) !== undefined,
  `flagged: ${fabricatedAttribution("You said nature and adventure, so.", hers)}`);
check("'You told me relaxation' is caught too",
  fabricatedAttribution("You told me relaxation mattered most.", hers) !== undefined);
/*
 * She has to have typed it. `activities` is filled by the model too, so the
 * fixture carries her message as well as the parsed entry — a brief with an
 * entry and no record of her saying it is not a state the app produces.
 */
check("a tag she genuinely used is not caught",
  fabricatedAttribution("You said food, so we lead with the market.",
    { ...emptyBrief("food, mostly. markets and wine"),
      activities: ["food, mostly. markets and wine"] }) === undefined);
check("and prose that attributes nothing is left alone",
  fabricatedAttribution("Torres del Paine is the real answer here, not Bariloche.", hers) === undefined);

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
