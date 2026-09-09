/**
 * Regression: the destination stops moving once it has been chosen.
 *
 *   "i'm going to new orleans for a work trip, and i'm extending by 2 days"
 *   → "New Orleans is where you're going."
 *   → "i need a more detailed itinerary"
 *   → "Go to Paris and Provence."
 *
 * Nothing rejected New Orleans. The recommender simply re-ran on every message,
 * and `rememberSeen` had just added New Orleans to the profile so that "surprise
 * me" twice gives two answers. That penalty applied to the destination we were
 * actively planning, it slipped behind the runner-up, and asking for detail
 * moved the traveller to another continent.
 */
import { interpretRules } from "@/lib/discovery";
import { recommend } from "@/lib/recommend";
import { applyPatch } from "@/lib/brief";
import { emptyBrief, emptyProfile, type Brief, type TravelerProfile } from "@/lib/types";
import { destinationById } from "@/data/destinations";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

/** The page's rule, in one place so the test and the app can't disagree. */
function pick(brief: Brief, profile: TravelerProfile, pitched: string | null) {
  const pinned = pitched && (!brief.namedDestination || brief.namedDestination === pitched)
    ? pitched : undefined;
  return pinned
    ? recommend({ ...brief, namedDestination: pinned, candidates: undefined, regionIds: undefined }, profile)
    : recommend(brief, profile);
}

console.log("\n\x1b[1mTHE DESTINATION STAYS PUT\x1b[0m\n");

let brief = applyPatch(emptyBrief(), { days: 4, vibes: ["food", "city", "culture"] });
let profile = emptyProfile();

// First pass: it decides.
const first = pick(brief, profile, null);
const chosen = first.destinationId;
check("it picks something to start with", !!chosen, destinationById(chosen).name);

// Which it then remembers having shown, exactly as the app does.
profile = { ...profile, seenDestinationIds: [chosen] };

// Every later message must land on the same place.
let drifted = "";
let pitched = chosen;
for (const turn of ["budget answered", "more detail please", "what about food", "anything else"]) {
  const again = pick(brief, profile, pitched);
  if (again.destinationId !== chosen) { drifted = `${turn} → ${destinationById(again.destinationId).name}`; break; }
  profile = { ...profile, seenDestinationIds: [...profile.seenDestinationIds, again.destinationId].slice(-12) };
}
check("and four messages later it is still the same place", !drifted, drifted);

// The bug, proven: without the pin, the same sequence moves.
{
  let p2 = { ...emptyProfile(), seenDestinationIds: [chosen] };
  const loose = pick(brief, p2, null);
  check("without pinning, the novelty penalty does move it",
    loose.destinationId !== chosen,
    `${destinationById(chosen).name} → ${destinationById(loose.destinationId).name}`);
}

// Naming somewhere else is a real change of mind and must still win.
{
  const moved = pick({ ...brief, namedDestination: "iceland" }, profile, chosen);
  check("naming a different place still overrides the pin",
    moved.destinationId === "iceland", destinationById(moved.destinationId).name);
}

// And rejecting clears the pin, which is what the caller does.
{
  const after = pick(brief, { ...profile, rejectedDestinationIds: [chosen] }, null);
  check("with the pin released it is free to choose again", after.destinationId !== undefined,
    destinationById(after.destinationId).name);
}

// A shortlist must not beat the pin: it is matched before a named destination.
{
  const withList = pick({ ...brief, candidates: ["portugal", "japan"] }, profile, chosen);
  check("a leftover shortlist does not drag it off the decision",
    withList.destinationId === chosen, destinationById(withList.destinationId).name);
}

console.log("\n\x1b[1mAND SHE CAN CHANGE HER MIND\x1b[0m\n");
{
  /*
   * The naming block was skipped entirely once a destination was set, so after
   * turn one "actually make it italy", "can we do japan instead", "change it
   * to japan" and "how about iceland" produced an EMPTY patch — eleven of
   * twelve phrasings — and the agent carried on about Portugal with nothing
   * said. readPushback's clearest signal is a patch whose destination differs
   * from the current one, and the deterministic driver could never produce it.
   */
  let b: Brief = emptyBrief("i want to go to portugal for 9 days");
  b = applyPatch(b, interpretRules("i want to go to portugal for 9 days", b)) as Brief;
  const stuck: string[] = [];
  for (const [msg, want] of [
    ["actually make it italy", "italy"], ["can we do japan instead", "japan"],
    ["change it to japan", "japan"], ["how about iceland", "iceland"],
    ["japan please", "japan"], ["actually iceland", "iceland"],
    ["no, japan", "japan"], ["scrap that, iceland", "iceland"],
    ["actually i'd rather go to japan", "japan"],
  ] as const) {
    if (interpretRules(msg, b).namedDestination !== want) stuck.push(msg);
  }
  check("a destination she names later still wins", stuck.length === 0, stuck.join(" | "));
  // And an ordinary follow-up does not reopen the choice.
  for (const msg of ["i also want good food", "what about the food there"]) {
    check(`"${msg}" doesn't move the destination`,
      interpretRules(msg, b).namedDestination === undefined,
      String(interpretRules(msg, b).namedDestination));
  }
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
