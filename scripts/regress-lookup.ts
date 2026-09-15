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
 * The lookup is deliberately unwilling: one leftover content word and it
 * refuses, because that word is intent. A conservative miss costs a stop she
 * could have been spared. A generous one costs her Bali.
 */
import { readFileSync } from "node:fs";
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
  lookupOnly("Japan for 10 days")?.days === 10
  && lookupOnly("two weeks in new zealand")?.days === 14,
  JSON.stringify(lookupOnly("two weeks in new zealand")));
check("a city names its destination and itself",
  lookupOnly("i want to go to kyoto")?.cityId === "kyoto");

// --- and refuses the moment there is meaning in the message ---------------
for (const said of [
  "i wanna visit japan but somewhere cheap",
  "japan but not tokyo",
  "somewhere quiet and peaceful, not south east asia",
  "surprise me",
  "japan with my mum who can't walk far",
]) {
  check(`refuses "${said.slice(0, 44)}"`, lookupOnly(said) === undefined,
    JSON.stringify(lookupOnly(said)));
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
      b = applyPatch(b, {
        namedDestination: only.destinationId,
        ...(only.days ? { days: only.days } : {}),
      });
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
