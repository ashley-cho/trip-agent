/**
 * Regression: naming a place we hold is a lookup, not an interpretation.
 *
 * "i wanna visit japan" was answered with "I'm stopping here: this
 * deployment's Anthropic account is out of credit." Japan is in the catalogue
 * with seven bases and a hundred and eleven places, all hand-written or
 * validated, and the scheduler that builds the trip is arithmetic with no
 * model in it anywhere. The app refused a question it could answer
 * completely.
 *
 * That was the no-floor rule applied too widely. The rule exists because
 * regexes INVENT meaning: "don't want south east asia" became a shortlist OF
 * Southeast Asia. Matching the word "japan" against a list of destinations
 * invents nothing. It is an exact string comparison against known data.
 *
 *   LOOKUP          does this name a thing we hold?  Deterministic. Allowed.
 *   INTERPRETATION  what did she mean by all this?   Model, or stop.
 *
 * The test it applies is not "is the message only a name". That was the first
 * version, and asked why "japan but somewhere cheap" stopped I answered "that
 * is intent" - a label, not an analysis. Measured:
 *
 *   "japan but not tokyo"     -> avoidPlaces ["tokyo"]. Every word lands.
 *   "japan on a budget"       -> budgetUsd, budgetInferred. Every word lands.
 *   "japan but somewhere cheap"           -> nothing. "cheap" vanishes.
 *   "japan with my mum who cant walk far" -> nothing. The clause vanishes.
 *
 * So the gate is: did every word she typed go SOMEWHERE. Answering a message
 * whose words the parser drops means silently throwing half her sentence
 * away, which is the Bali failure. Answering one it covers completely costs
 * her nothing. The honest limit: this catches words that go nowhere, not
 * words that go somewhere wrong.
 */
import { readFileSync, readdirSync } from "node:fs";
import { lookupOnly } from "@/lib/lookup";
import { resolvePlaceName } from "@/lib/places";
import { advance, type FlowAgent, type FlowIO, type FlowRefs } from "@/lib/flow";
import { NoModel } from "@/lib/client";
import { applyPatch } from "@/lib/brief";
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import { rulesDriver } from "@/lib/agent/rules";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA NAME IS A LOOKUP\x1b[0m\n");

// --- it answers the thing that was refused --------------------------------
check("\"i wanna visit japan\" resolves without a model",
  lookupOnly("i wanna visit japan")?.destinationId === "japan",
  "the exact message that got the out-of-credit stop");
check("a bare name works",
  lookupOnly("japan")?.destinationId === "japan");
check("and a length comes with it",
  lookupOnly("Japan for 10 days")?.patch.days === 10
  && lookupOnly("two weeks in new zealand")?.patch.days === 14,
  JSON.stringify(lookupOnly("two weeks in new zealand")));
check("a city names its destination and itself",
  lookupOnly("i want to go to kyoto")?.cityId === "kyoto");

// --- it refuses when a word of hers would be thrown away ------------------
for (const said of [
  // "cheap" produces nothing at all. Answering drops it.
  "i wanna visit japan but somewhere cheap",
  // The whole clause produces nothing, and it is the constraint that would
  // decide the entire itinerary.
  "japan with my mum who can't walk far",
  // No name in it to look up in the first place.
  "somewhere quiet and peaceful, not south east asia",
  "surprise me",
]) {
  check(`refuses "${said.slice(0, 44)}"`, lookupOnly(said) === undefined,
    JSON.stringify(lookupOnly(said)));
}

/*
 * And it carries through when the parser covers every word. These four used
 * to stop. Refusing them was not caution, it was a stop she did not need: the
 * catalogue holds Japan, the parser holds the rest of the sentence, and
 * nothing she typed goes missing.
 */
{
  const tokyo = lookupOnly("japan but not tokyo");
  check("\"japan but not tokyo\" carries the refusal through",
    tokyo?.destinationId === "japan" && (tokyo?.patch.avoidPlaces ?? []).includes("tokyo"),
    JSON.stringify(tokyo));

  const budget = lookupOnly("japan on a budget");
  check("\"japan on a budget\" carries the budget through",
    budget?.destinationId === "japan" && typeof budget?.patch.budgetUsd === "number",
    JSON.stringify(budget));

  check("a second destination in the remainder is ambiguity, and stops",
    lookupOnly("japan or korea") === undefined,
    JSON.stringify(lookupOnly("japan or korea")));
}

/*
 * A CATALOGUE THAT GROWS BY RESEARCH NEEDS NAMES THAT GROW WITH IT.
 *
 * NAMED_DESTINATIONS is a hand-written table of 24 entries, one per
 * destination that shipped with the app. Sixty-seven more arrived by research
 * and not one of them got a line in it, so a researched destination could be
 * found only by its own id, its title, or one of its town names. With Nepal
 * fully in the catalogue, "himalayas" found nothing.
 *
 * So the pack carries its own names and the resolver reads them. Checked as
 * whole strings, like the id and title checks and unlike the pattern table,
 * because an alias is a name rather than a pattern.
 */
{
  const packs = readdirSync("data/catalogue").filter((f) => f.endsWith(".json"));
  const withAliases = packs.filter((f) => {
    const row = JSON.parse(readFileSync(`data/catalogue/${f}`, "utf8"));
    return ((row.pack ?? row).destination.aliases ?? []).length > 0;
  });
  check("every researched pack carries its own names",
    withAliases.length === packs.length,
    `${withAliases.length} of ${packs.length}`);
  check("the resolver reads them",
    /const byAlias = DESTINATIONS\.find\(\(d\) => \(d\.aliases \?\? \[\]\)\.some\(same\)\)/
      .test(readFileSync("lib/places.ts", "utf8")),
    "a hand-written table cannot keep up with a catalogue that grows by research");
  check("and the gate keeps them when a pack is adopted",
    /const aliases = \[\.\.\.new Set\(/.test(readFileSync("lib/research.ts", "utf8")),
    "otherwise the next researched destination arrives nameless again");
  check("deriving them is a command, not something I did by hand once",
    /npm run catalogue names/.test(readFileSync("scripts/catalogue.ts", "utf8")),
    "the table grows; a one-off pass over today's packs is not a mechanism");
}

/*
 * AND A PACK THAT WENT UP THIN COULD NEVER BE FIXED.
 *
 * `restore` inserts only what the table LACKS, with the reason in its own
 * comment: there is no update policy, because the anon key is held by anyone
 * who can open the app and a visitor must not be able to overwrite the
 * catalogue. Correct, and it left no path for a correction at all. Four packs
 * with two to three times the places of their live rows could not be sent,
 * and neither could the aliases for any of the rest.
 */
{
  const cat = readFileSync("scripts/catalogue.ts", "utf8");
  check("there is an admin path that can update an existing pack",
    /async function push\(\)/.test(cat) && /resolution=merge-duplicates/.test(cat));
  check("and it needs the other key, so the app still cannot overwrite anything",
    /push[\s\S]{0,600}SUPABASE_SERVICE_ROLE_KEY/.test(cat),
    "the anon policy is insert-only on purpose and stays that way");
  check("it sends only what differs",
    /JSON\.stringify\(there\.pack\) === JSON\.stringify\(row\.pack\)/.test(cat),
    "re-uploading everything to change four makes the log useless");
  check("and pulling down says when it overwrote something better",
    /local pack\(s\) were RICHER than the table/.test(cat),
    "save writes over local work and nothing used to say a word");
}

/*
 * The trap. resolvePlaceName's name and id checks are equality, but its alias
 * check was a regex SEARCH, so "japan for 10 days" resolved to Japan whole:
 * the matcher read the entire message as a name and swallowed the length. A
 * loose matcher used as an exact one is the same mistake that put "glacier"
 * in Patagonia's write-up.
 */
check("the alias table matches a whole string only, when asked for exact",
  resolvePlaceName("japan for 10 days", { exact: true }) === undefined
  && resolvePlaceName("japan", { exact: true })?.destinationId === "japan",
  "exact must mean exact, including for aliases");
check("and the loose mode still scans a sentence, for the callers that need it",
  resolvePlaceName("japan for 10 days")?.destinationId === "japan");

// --- a number is only a length next to a length word ----------------------
check("a bare number is not a duration",
  lookupOnly("route 66") === undefined,
  "otherwise this is a 66-day trip");

// --- the wiring -----------------------------------------------------------
{
  const client = readFileSync("lib/client.ts", "utf8");
  /*
   * And, for a bare name only, tried before the CALL rather than after it.
   * There is provably nothing to interpret in "i wanna visit japan": every
   * word is the name or a carrier. Anything with residue still goes to the
   * model, because the gate promises the words land somewhere, not that they
   * land somewhere right, and being faithful beats being cheap.
   */
  check("a bare name skips the model entirely",
    /if \(bare && !Object\.keys\(bare\.patch\)\.length\)/.test(client)
    && client.indexOf("const bare = lookupOnly") < client.indexOf("turns.total++"),
    "the most common opening message in the product");
  check("but a message with anything else in it still pays for a model",
    /Deliberately NOT the full gate/.test(client),
    "a length, a budget, a refusal, a person she is travelling with");
  check("and a skipped turn is not counted as a turn that stopped",
    client.indexOf("const bare = lookupOnly") < client.indexOf("turns.total++"),
    "it never entered the stop accounting at all");

  check("the lookup is tried before the turn stops",
    /const only = lookupOnly\(String\(body\.input \?\? ""\)\);/.test(client)
    && client.indexOf("const only = lookupOnly") < client.indexOf("turns.stopped++"),
    "after the retries, before the stop");
  check("and a lookup answer is not counted as a stop",
    /turns\.stopped--/.test(client),
    "it would make the five percent ceiling read worse than it is");
  check("it is marked as coming from the catalogue, not from a model",
    /driver: "catalogue"/.test(client),
    "a vote against this turn must not be filed against the model");

  const flow = readFileSync("lib/flow.ts", "utf8");
  check("and the pitch falls to the floor rather than dying",
    /if \(noModel\(e\)\) break;/.test(flow),
    "otherwise the turn picks Japan out of 111 places and then dies on the paragraph");
}

/*
 * And the whole turn, run, with no model anywhere.
 *
 * Every check above passed while "i wanna visit japan" was still dead. The
 * lookup resolved, the wiring was in place, and the turn hit api.question in
 * discovery and threw; patching that, it reached the logistics question four
 * hundred lines later and threw again. Unit-green and product-broken is the
 * exact failure this project keeps having, so this runs advance() for real.
 */
async function main() {
  const dead = () => {
    throw new NoModel('400 {"type":"invalid_request_error","message":"Your credit balance is too low"}');
  };
  const agent = {
    // The four that have no floor.
    question: async () => dead(),
    pitch: async () => dead(),
    suggest: async () => ({ place: undefined, problem: "no model", driver: "rules" }),
    budget: async () => ({ ok: true }),
    researchStream: async () => ({ problem: "no model", driver: "rules" }),
    researchPack: async () => ({ pack: undefined, problem: "no model", driver: "rules" }),
    researchPlaces: async () => ({ places: [] }),
    pitchFloor: rulesDriver.pitch!,
    stays: async () => ({ stays: [], driver: "rules" }),
  } as unknown as FlowAgent;

  const turn = async (said: string) => {
    const only = lookupOnly(said);
    let b: Brief = emptyBrief(said);
    if (only) {
      b = applyPatch(b, { ...only.patch, namedDestination: only.destinationId });
    }
    const out = { said: [] as string[], trip: null as { days?: unknown[] } | null };
    const io: FlowIO = {
      say: (from, text) => { if (from === "agent") out.said.push(text); },
      ask: () => {}, noteDriver: () => {}, setBrief: () => {},
      setTrip: (t) => { out.trip = typeof t === "function" ? (t as (p: typeof out.trip) => typeof out.trip)(out.trip) : t; },
      setStage: () => {}, setQuestion: () => {}, setResearching: () => {},
      noteDrift: () => {}, openStream: () => "s", appendTo: () => () => {},
      closeStream: () => {}, rememberSeen: () => {},
    };
    const refs: FlowRefs = {
      history: { current: [] }, pitched: { current: null }, headline: { current: "" },
      failedResearch: { current: null }, gen: { current: 0 },
    };
    await advance(b, emptyProfile(), io, refs, agent);
    return out;
  };

  const japan = await turn("i wanna visit japan");
  check("the turn completes with no model at all and produces a trip",
    !!japan.trip && (japan.trip.days?.length ?? 0) > 0,
    `${japan.trip ? `${japan.trip.days?.length} days` : "NO TRIP"} · ${japan.said.join(" | ").slice(0, 90)}`);
  check("and it is Japan, pitched from the catalogue entry",
    /japan/i.test(japan.said.join(" ")),
    japan.said.join(" | ").slice(0, 100));
  check("nothing tells her it gave up",
    !/stopping here|couldn't turn that/i.test(japan.said.join(" ")),
    japan.said.join(" | ").slice(0, 120));

  const ten = await turn("Japan for 10 days");
  check("a stated length survives the lookup into the trip",
    (ten.trip?.days?.length ?? 0) === 10,
    `${ten.trip?.days?.length ?? 0} days`);

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}
void main();
