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
import { registerPack } from "@/data/registry";
import { lookupOnly, orphanWords } from "@/lib/lookup";
import { OPENERS } from "@/lib/openers";
import { offlineInterpret } from "@/lib/offline";
import { resolvePlaceName } from "@/lib/places";
import { interpretRules } from "@/lib/discovery";
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
 * AND THE PARSER GETS HER TEXT, NOT THE FOLDED WORDS.
 *
 * Every test of the range work called `interpretRules` directly and passed.
 * The only path that reaches it in production goes through here, and here it
 * was being handed the matcher's output: folded, punctuation replaced by
 * spaces, so "1-2" arrives as two tokens. Parsing "for 1 2 weeks" reads
 * fourteen days, and the deployed app refused "i wanna go to croatia for 1-2
 * weeks" against a number she had not typed — with the fix for exactly that
 * shipped, green, and never once exercised through this function.
 *
 * These go through lookupOnly on purpose.
 */
{
  const got = lookupOnly("i wanna go to croatia for 1-2 weeks");
  check("\"1-2 weeks\" survives the lookup as a range",
    got?.patch.daysRange?.min === 7 && got?.patch.daysRange?.max === 14,
    JSON.stringify(got));
  check("and the length it plans is inside it, not the top of it",
    got?.patch.days === 11, JSON.stringify(got?.patch));

  for (const [said, want] of [
    ["japan, 10 days", 10],
    ["portugal for 10-14 days", 12],
    ["two weeks in new zealand", 14],
    ["iceland: 5 nights", 5],
  ] as const) {
    check(`"${said}" keeps its length through the lookup`,
      lookupOnly(said)?.patch.days === want,
      JSON.stringify(lookupOnly(said)));
  }

  check("a name with punctuation still resolves",
    lookupOnly("japan!")?.destinationId === "japan"
    && lookupOnly("i wanna go to japan.")?.destinationId === "japan",
    JSON.stringify(lookupOnly("japan!")));
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
  /*
   * Behaviour, through lib/offline.ts, which is the rule both the client and
   * the eval harness call. This block used to regex-match lib/client.ts for
   * variable names, and broke the day the rule moved into a module of its
   * own -- which is the change that made the harness measure the product.
   */
  check("a message the lookup can read skips the model entirely",
    (() => { const r = offlineInterpret("i wanna visit japan", emptyBrief("x")); return "patch" in r && r.how === "name"; })(),
    "the most common opening message in the product");
  check("and so does one that names nowhere but still lands whole",
    (() => { const r = offlineInterpret("Northern lights, and I can drive.", emptyBrief("x")); return "patch" in r; })(),
    "twelve of the app's own twelve openers were refused before this");
  check("with the narrow gate one env var away",
    (() => { const r = offlineInterpret("somewhere warm for a week", emptyBrief("x"), undefined, "name"); return "refused" in r; })()
    && (() => { const r = offlineInterpret("somewhere warm for a week", emptyBrief("x"), undefined, "words"); return "patch" in r; })(),
    "a widening measured on twenty-three scenarios needs a way back without a deploy");
  check("and a word that goes nowhere still stops the turn",
    (() => { const r = offlineInterpret("japan but somewhere cheap", emptyBrief("x")); return "refused" in r && r.refused.includes("cheap"); })(),
    "it catches words that go nowhere, not words that go somewhere wrong");
  check("and a skipped turn is not counted as a turn that stopped",
    client.indexOf("offlineInterpret(said") < client.indexOf("turns.total++"),
    "it never entered the stop accounting at all");

  check("the lookup is tried before the turn stops",
    client.indexOf("offlineInterpret(said") < client.indexOf("turns.stopped++"),
    "before the model is even asked; a stop can only follow a refusal");
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

  /*
   * A place we do not hold, with no model: one sentence, one attempt.
   *
   * "african island" and "zanzibar" each ran the research loop three times
   * against a dead key and then said "I tried 3 times to work up Africa
   * and couldn't ... tell me a length and I'll go again". Not the length,
   * and going again would not help.
   */
  {
    let calls = 0;
    const counting = { ...agent, researchStream: async () => { calls++; return { problem: "no model", driver: "fallback", reason: "Your credit balance is too low" }; } } as unknown as FlowAgent;
    const run = async (said: string) => {
      calls = 0;
      const b = applyPatch(emptyBrief(said), interpretRules(said, emptyBrief(said)));
      const out = { said: [] as string[] };
      const io: FlowIO = {
        say: (from, text) => { if (from === "agent") out.said.push(text); },
        ask: () => {}, noteDriver: () => {}, setBrief: () => {}, setTrip: () => {},
        setStage: () => {}, setQuestion: () => {}, setResearching: () => {},
        noteDrift: () => {}, openStream: () => "s", appendTo: () => () => {},
        closeStream: () => {}, rememberSeen: () => {},
      };
      const refs: FlowRefs = { history: { current: [] }, pitched: { current: null }, headline: { current: "" },
        failedResearch: { current: null }, gen: { current: 0 } };
      await advance(b as Brief, emptyProfile(), io, refs, counting);
      return out.said.join(" | ");
    };
    const africa = await run("african island");
    check("a region we hold nothing in, no model: one attempt", calls === 1, `${calls} attempts`);
    check("  and it says so, not 'tried 3 times' or 'tell me a length'",
      /I hold nowhere in Africa/.test(africa) && !/tried|length/.test(africa), africa.slice(0, 160));
    const zanzibar = await run("zanzibar");
    check("a place we do not hold, no model: one attempt", calls === 1, `${calls} attempts`);
    check("  and it says so", /Zanzibar isn't somewhere I hold/.test(zanzibar), zanzibar.slice(0, 160));
  }

  const ten = await turn("Japan for 10 days");
  check("a stated length survives the lookup into the trip",
    (ten.trip?.days?.length ?? 0) === 10,
    `${ten.trip?.days?.length ?? 0} days`);

  /*
   * THE APP HAS TO BE ABLE TO ANSWER ITS OWN SUGGESTIONS.
   *
   * OPENERS in app/page.tsx are the twelve example prompts printed in the box
   * she types into. With no credit, the narrow gate refused all twelve --
   * including "Northern lights, and I can drive.", which the rules parser
   * reads correctly as Iceland. An app that refuses the prompt it just
   * offered her is worse than one with a gap in it.
   *
   * Read out of page.tsx rather than copied, so editing that list is what
   * updates this.
   */
  {
    // lib/openers.ts is what the page renders, so this reads the same list.
    const openers = OPENERS;
    check("the openers are still findable in the page", openers.length >= 10, `${openers.length} found`);
    const refused = openers.filter((o) => orphanWords(o).length);
    /*
     * Seven of twelve, up from none, and the five that remain are a list of
     * parser gaps rather than a mystery. Each one drops a real signal:
     *
     *   "walk a lot"          walk, lot        walking is a tag we hold
     *   "nowhere decided"     decided          and it reads "planned" as a
     *                                          PLACE she is avoiding, which
     *                                          is a wrong reading this gate
     *                                          cannot see and does not claim
     *                                          to
     *   "and I can drive"     can, drive       roadTrip is a field
     *   "tired of cities"     tired, cities    an explicit avoid
     *   "a long dinner"       long, dinner     a food signal
     *
     * A ratchet, not a blocker: the count may not get worse, and closing any
     * of them means editing this number down.
     */
    check("the app can answer most of the openers it suggests, with no model",
      openers.length - refused.length >= 7,
      `${openers.length - refused.length}/${openers.length} answered; refuses: ${refused.join(" | ")}`);
    check("and the ones it refuses are refused for dropping a word, not at random",
      refused.every((o) => orphanWords(o).length > 0));
    check("\"Northern lights, and I can drive.\" is Iceland",
      interpretRules("Northern lights, and I can drive.", emptyBrief("x")).namedDestination === "iceland");
  }

  /*
   * And the country she typed is the country she gets.
   *
   * "croatia" landed on Dalmatia -- Split, Trogir, Hvar, Dubrovnik -- one
   * coastal strip, with no Zagreb, no Istria, no Plitvice, and nothing saying
   * so. It is also why "1-2 weeks" read as too long: twelve days of material
   * is honest about Dalmatia and misleading about Croatia, which she never
   * asked for.
   */
  {
    /*
     * The researched packs arrive from the table at runtime, so a bare node
     * process holds only the twenty-four that ship in the repo. Croatia is a
     * pack, so it has to be registered before it can be looked up.
     */
    for (const f of readdirSync("data/catalogue").filter((x) => x.endsWith(".json"))) {
      const row = JSON.parse(readFileSync(`data/catalogue/${f}`, "utf8"));
      try { registerPack(row.pack ?? row); } catch { /* already held */ }
    }
    check("croatia is Croatia, not one of its coasts",
      lookupOnly("croatia")?.destinationId === "croatia",
      JSON.stringify(lookupOnly("croatia")));
    check("and the rest of the country is reachable by name",
      ["istria", "zagreb", "plitvice", "rovinj"]
        .every((n) => lookupOnly(n)?.destinationId === "croatia"),
      ["istria", "zagreb", "plitvice", "rovinj"]
        .map((n) => `${n}=${lookupOnly(n)?.destinationId}`).join(" "));
    check("a fortnight in Croatia is no longer refused",
      lookupOnly("i wanna go to croatia for 1-2 weeks")?.patch.daysRange?.max === 14,
      JSON.stringify(lookupOnly("i wanna go to croatia for 1-2 weeks")));
  }

  console.log("\n\x1b[1mA COMPASS WORD IS PART OF THE PLACE\x1b[0m\n");
  {
    /*
     * "southern france" was France plus an activity called "southern": the
     * pitch answered it with a restaurant whose note said the word, and the
     * planner based her in Paris. "northern italy" did the same with Rome.
     * The word picks the base when the pack has a bed on that side, and
     * says which side the pack IS when it does not.
     */
    const read = (t: string) => offlineInterpret(t, emptyBrief(t));
    for (const [text, city] of [["southern france", "provence"], ["south of france", "provence"],
      ["north of portugal", "porto"], ["western japan", "kyoto"], ["southern mexico", "oaxaca"]] as const) {
      const r = read(text);
      check(`"${text}" is based in ${city}`, "patch" in r && r.patch.focusCityId === city && !r.patch.activities?.length,
        JSON.stringify(r));
    }
    for (const text of ["northern italy", "northern spain", "northern mexico"]) {
      const r = read(text);
      check(`"${text}" is not planned as somewhere else`, "refused" in r && /I don't hold/.test(r.unheld ?? ""),
        JSON.stringify(r));
    }
    const italy = read("northern italy");
    check("the sentence names what we do hold",
      "unheld" in italy && /Italy for me is Rome and Tuscany/.test(italy.unheld ?? ""));
    const spain = read("southern spain");
    check("\"southern spain\" agrees with the pack and is dropped, not refused",
      "patch" in spain && !spain.patch.activities?.length);
    const korea = read("south korea");
    check("\"south korea\" is a name, not a direction",
      "patch" in korea && korea.patch.namedDestination === "korea");
    const prov = read("provence");
    check("naming a city offline pins it", "patch" in prov && prov.patch.focusCityId === "provence");
  }

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}
void main();
