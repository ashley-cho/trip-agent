/**
 * The reply and the plan have to agree.
 *
 * Typing "i also really want to do dog sledding" at a finished Yellowknife
 * trip produced, in one turn:
 *
 *   "I didn't change anything — tell me more specifically what's off."
 *   "I'm not sure what to change for "i also really want to do dog sledding".
 *    Tell me which day, or which part is wrong."
 *
 * while the itinerary rebuilt underneath and the estimate moved. Both halves
 * ran: `replan` was true because the patch carried an interestEcho, so the
 * days were rebuilt against the fuller brief; then the editor found no
 * day-level operation, reported the sentence as unresolved, and said nothing
 * had happened. The rebuild and the editor did not know about each other.
 *
 * A sentence that changes the days is answered by the days changing.
 *
 * Also here: the "why I picked this" line, which read the vibe TAGS rather
 * than her words, and told a traveller who asked for the northern lights
 * "You said nature, city".
 */
import { whyLine } from "@/lib/concept";
import { emptyBrief, type Brief, type Trip } from "@/lib/types";
import { researchPrompt } from "@/lib/research";
import { alreadyInTheTrip } from "@/lib/answer";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mWHAT IT SAYS IS WHAT IT DID\x1b[0m\n");

// --- her words, not the taxonomy ----------------------------------------
{
  const brief: Brief = {
    ...emptyBrief(), days: 7, vibes: ["nature", "city"],
    interestEcho: "northern lights; a city or two",
  };
  const trip = {
    concept: { days: 7, shape: [{ cityId: "reykjavik", nights: 6 }] },
    days: [], 
  } as unknown as Trip;
  const line = whyLine(trip, brief);
  check("the reason line uses what she typed", /northern lights/i.test(line), line);
  check("and does not read back the tag list instead",
    !/^You said nature, city/.test(line), line);
}

// --- the tags are still the fallback ------------------------------------
{
  const brief: Brief = { ...emptyBrief(), days: 5, vibes: ["food"] };
  const trip = {
    concept: { days: 5, shape: [{ cityId: "lisbon", nights: 4 }] },
    days: [],
  } as unknown as Trip;
  check("with no echo, the tags still fill the line",
    /You said food/.test(whyLine(trip, brief)), whyLine(trip, brief));
}

// --- the pitch is told the arithmetic ------------------------------------
{
  const p = researchPrompt("Canada", 7, "San Francisco", "northern lights; a city or two");
  check("a 7-day trip is described to the model as 6 nights", /7 days is 6 nights/.test(p));
  check("and it is told they fly home from where they flew in",
    /fly home from the airport they flew/.test(p), "");
}


// --- what is already in the trip ----------------------------------------
//
// "i also really want to do dog sledding" on a trip whose day three IS dog
// sledding got "tell me which day, or which part is wrong". Twice.
{
  const trip = {
    concept: { days: 7, headline: "Edmonton & Yellowknife", shape: [] },
    days: [
      { items: [{ name: "Land and get into town", reason: "" }] },
      { items: [] },
      { items: [{ name: "Dog sledding or ice fishing on Great Slave Lake", reason: "The outdoor counterweight." }] },
    ],
  } as unknown as Trip;
  for (const said of ["i also really want to do dog sledding", "i want to try ice fishing too"]) {
    const hit = alreadyInTheTrip(trip, said);
    check(`"${said}" is found in the plan`, hit?.day === 3, JSON.stringify(hit));
  }
  check("and something genuinely absent is not claimed to be there",
    alreadyInTheTrip(trip, "i want to go scuba diving") === undefined);
  check("a sentence of filler words matches nothing",
    alreadyInTheTrip(trip, "ok sure that works") === undefined);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
