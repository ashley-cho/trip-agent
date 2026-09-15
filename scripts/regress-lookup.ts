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

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
