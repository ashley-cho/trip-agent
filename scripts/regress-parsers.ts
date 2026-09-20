/**
 * One cleaner, so the two place parsers cannot disagree.
 *
 * detectNamedPlace (singular) stripped a leading article and cut at a
 * name-ending word. detectNamedPlaces (plural) did neither. The comment in the
 * singular one says the rule is shared "because two copies of it drifted apart
 * once already". There were still two copies, and they were still apart:
 *
 *   "i want to go to the faroe islands or the azores"
 *      singular -> faroe islands        plural -> nothing at all
 *   "i wanna go to turkey but not istanbul"
 *      singular -> turkey               plural -> "turkey but not"
 *
 * And interpretRules then overwrote the plural's list with the singular's one
 * answer, so a two-place message reached the brief as one place. Losing a
 * place she named is what the comment above NOT_A_PLACE calls the single most
 * trust-destroying thing this parser can do.
 *
 * This is the rules driver, so it is the no-key path and every path where the
 * model call fails. It is not the hot path; it is the floor.
 */
import { cleanPlacePhrase, detectNamedPlace, detectNamedPlaces, interpretRules, statedActivity } from "@/lib/discovery";
import { emptyBrief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  the two place parsers agree\n");

// --- the shared cleaner ---------------------------------------------------
for (const [raw, want] of [
  ["the faroe islands", "faroe islands"],
  ["turkey but not istanbul", "turkey"],
  ["japan for two weeks", "japan"],
  ["oaxaca with my sister", "oaxaca"],
  ["the azores", "azores"],
  ["portugal.", "portugal"],
] as const) {
  check(`"${raw}" -> ${want}`, cleanPlacePhrase(raw) === want, String(cleanPlacePhrase(raw)));
}
for (const raw of ["october", "3 nights", "the", "next week"]) {
  check(`"${raw}" is not a place`, cleanPlacePhrase(raw) === undefined, String(cleanPlacePhrase(raw)));
}

// --- and both callers now say the same thing ------------------------------
const agree = (text: string) => {
  const s = detectNamedPlace(text);
  const p = detectNamedPlaces(text);
  return { s, p, ok: !s.unknown || p.unknown.includes(s.unknown) };
};
for (const text of [
  "i want to go to the faroe islands or the azores",
  "i wanna go to turkey but not istanbul",
  "i want to go to japan for two weeks",
  "montenegro or albania",
]) {
  const { s, p, ok } = agree(text);
  check(`neither parser loses what the other found: "${text.slice(0, 44)}"`,
    ok, `sing ${JSON.stringify(s)} plur ${JSON.stringify(p.unknown)}`);
}

// --- the brief keeps every place she named --------------------------------
{
  const b = interpretRules("i want to go to the faroe islands or the azores", emptyBrief());
  check("a two-place message reaches the brief as two places",
    (b.unknownCandidates ?? []).length === 2, JSON.stringify(b.unknownCandidates));
  check("the cued one leads", b.unknownCandidates?.[0] === "faroe islands");
}
{
  const b = interpretRules("i wanna go to turkey but not istanbul", emptyBrief());
  check("and an exclusion does not become part of the country's name",
    JSON.stringify(b.unknownCandidates) === JSON.stringify(["turkey"]),
    JSON.stringify(b.unknownCandidates));
}
{
  const b = interpretRules("i want to go to japan", emptyBrief());
  check("a place we hold is still a named destination", b.namedDestination === "japan");
}

console.log("\n\x1b[1mWHO AND WHEN AND WHERE ARE NOT THINGS TO DO\x1b[0m\n");
{
  /*
   * `statedActivity` files what she wants to DO, and `unserved` reads it and
   * says out loud what the trip can't cover. So a bad entry is not a silent
   * one: "i want to go to japan for my mum" produced
   *
   *   "One thing this doesn't cover: my mum. Nothing I have for Japan does
   *    that, so I've left it out rather than pretend."
   *
   * and the why line read "You said my mum." Three of the fifteen entries the
   * project's own corpus produces were like this. They also feed the +0.6
   * `asked` weight, the largest single term in the scorer, so a place whose
   * blurb happens to contain "montenegro" outranked everything on a
   * Montenegro trip.
   */
  for (const text of [
    "going to montenegro in june",
    "i want to go to sri lanka with my partner",
    "i want to leave the country",
    "i want to go to japan for my mum",
    "we're going to iceland for our honeymoon",
    "planning a trip to japan for my mum",
    // A place we have never heard of is still a where, not a what.
    "going to bhutan for bhutan",
    // A reason for the trip that is not a thing to do on it. "flying to lisbon
    // for work" filed "work", and the app then said out loud "Nothing I have
    // for Portugal does that". Nothing does.
    "flying to lisbon for work",
    "going to tokyo for a conference",
    "i want to go to japan for a meeting",
    // An ordinal is an occasion: "portugal for my 40th" filed "my 40th".
    "portugal for my 40th",
  ]) {
    check(`"${text}" is not a thing to do`,
      statedActivity(text) === undefined, String(statedActivity(text)));
  }

  // And the ones that ARE still are, or the gate is just off.
  for (const [text, want] of [
    ["i wanna go to portugal for surfing", "surfing"],
    ["10 days in vietnam for hiking", "hiking"],
    ["i want to go to iceland to see the northern lights. give me an itinerary", "northern lights"],
    // But the place name inside a real request is how she said WHICH one.
    ["i want to go to montenegro for the montenegro coast", "coast"],
    /*
     * The three signals that let a phrase IN, one case each. The first version
     * of the gate had only the first two and dropped all three "see ..."
     * entries, which are three of the seven this project's own corpus
     * produces — so a verb-led phrase is the third.
     */
    ["i want to go to portugal for surfing", "surfing"],            // gerund
    ["i want to go to greece for the beaches", "beaches"],          // tag vocabulary
    ["i want to go to kyoto to see temples", "see temples"],        // verb-led
    ["i want to go to the faroe islands to see puffins", "puffins"],
    ["i want to go to iceland to see the northern lights", "northern lights"],
    ["i want to go to hokkaido to eat", "eat"],
    ["i want to go to vietnam for street food", "street food"],
    /*
     * A place the codebase has never seen is KEPT, deliberately.
     *
     * A first attempt dropped it here, and that cost the ranking, the pitch
     * echo, the "You said" line and the research prompt: "portugal for the
     * cliffs" went from three cliff items to one and said nothing about it.
     * Everything she typed stays on the brief. What the flow says about a
     * phrase it cannot place is asserted in scripts/regress-turn.ts.
     */
    // Was "chile for patagonia". Patagonia is in the catalogue now, so
    // `isKnownDestination` correctly stops treating it as a thing to do —
    // which is the case the comment beside that check in lib/discovery.ts
    // predicted. The assertion here is about a place we do NOT hold, so it
    // needs one that is still unheld.
    ["i want to go to chile for atacama", "atacama"],
    ["i want to go to japan for hokkaido", "hokkaido"],

    // Was "peru for machu picchu". Peru is in the catalogue now and Machu
    // Picchu resolves to it, so it is a WHERE rather than a what — the same
    // rule the patagonia line above hit. A Peruvian place we still do not
    // hold keeps the assertion honest.
    ["i want to go to peru for the nazca lines", "nazca lines"],
    // And the reason filter below stays a REASON filter: a thing to do that
    // sits beside one of its words is still filed.
    ["i want to go to japan for the temples", "temples"],
  ] as const) {
    check(`"${text.slice(0, 38)}…" still keeps ${want}`,
      (statedActivity(text) ?? "").includes(want), String(statedActivity(text)));
  }
}




console.log("\n\x1b[1mHER SPELLING OF A PLACE WE ALREADY HOLD\x1b[0m\n");
{
  /*
   * The stem entries in NAMED_DESTINATIONS were written as prefixes and then
   * given a trailing word boundary by the group, so "andaluc" could only match
   * the exact string "andaluc". The Spanish spelling she is most likely to
   * type matched nothing, and the app treated Andalusia as somewhere it had
   * never heard of and went off to research a destination it already holds.
   */
  for (const [text, want] of [
    ["i want to go to andalucia", "andalusia"],
    ["i want to go to andalusia", "andalusia"],
    ["i want to go to tuscany", "italy"],
    ["i want to go to cadaques", "catalonia"],
    ["i want to go to teotihuacan", "mexico"],
  ] as const) {
    const got = detectNamedPlaces(text);
    check(`"${text.slice(15)}" is a place we hold, not one to research`,
      got.known.includes(want) && !got.unknown.length, JSON.stringify(got));
  }
  // And the stems did not start matching things they shouldn't.
  for (const text of ["i want to go to portugal", "i want to go to porto"]) {
    check(`"${text.slice(15)}" still resolves`,
      detectNamedPlaces(text).known.includes("portugal"), JSON.stringify(detectNamedPlaces(text)));
  }
}

/*
 * A PLACE IS ALSO THE THING SHE IS GOING TO DO TO IT.
 *
 * "i wanna climb the himalayas. duration of the trip - i'm flexible" came out
 * of the parser as {vibes: ["adventure"]}. Both halves of her message were
 * gone and the recommender, handed one bare vibe, offered Costa Rica.
 *
 * Both place patterns required a movement preposition — "go TO x", "a week IN
 * x". "climb the himalayas" has none, so the only noun in the sentence was
 * dropped. The guard is that the object has to be something other than the
 * generic noun for the landscape, which is what keeps "climb the mountains"
 * out without taking "sail the greek islands" with it.
 */
{
  const read = (t: string) => interpretRules(t, emptyBrief(t));
  const place = (t: string) => read(t).unknownCandidates?.[0] ?? read(t).namedDestination;

  for (const [said, want] of [
    ["i wanna climb the himalayas", "himalayas"],
    ["i wanna trek the himalayas", "himalayas"],
    ["i wanna hike the dolomites", "dolomites"],
    ["i want to climb kilimanjaro", "kilimanjaro"],
    ["sail the greek islands", "cyclades"],
  ] as const) {
    check(`"${said}" keeps the place`, place(said) === want,
      JSON.stringify(read(said)));
  }

  // And the landscape itself is still not a destination.
  for (const said of [
    "i wanna climb the mountains",
    "i wanna hike some trails",
    "i love hiking and volcanoes",
    "i wanna walk a bit",
  ]) {
    check(`"${said}" names nowhere`, place(said) === undefined,
      JSON.stringify(read(said)));
  }

  /*
   * And "I'm flexible" about WHAT.
   *
   * She named the slot herself, in the app's own word, and this asked
   * `nextQuestionRules` which question was pending instead. On an opening
   * turn that is vibes — so "flexible about how long" was filed as "surprise
   * me, I don't care where". A different answer to a different question.
   */
  check("\"duration of the trip - i'm flexible\" is about the duration",
    read("duration of the trip - i'm flexible").flexibleDuration === true
    && read("duration of the trip - i'm flexible").surpriseMe === undefined,
    JSON.stringify(read("duration of the trip - i'm flexible")));
  check("and so is \"i'm flexible on the duration\"",
    read("i'm flexible on the duration").flexibleDuration === true
    && read("i'm flexible on the duration").surpriseMe === undefined,
    JSON.stringify(read("i'm flexible on the duration")));
  check("\"i'm flexible on budget\" is about the budget",
    read("i'm flexible on budget").flexibleBudget === true
    && read("i'm flexible on budget").flexibleDuration === undefined,
    JSON.stringify(read("i'm flexible on budget")));
  check("a bare \"i'm flexible\" still falls back to the open question",
    read("i'm flexible").surpriseMe === true,
    "she named no slot, so the pending one is the best reading there is");

  // The whole message, both halves, intact.
  const both = read("i wanna climb the himalayas. duration of the trip - i'm flexible");
  check("both halves of the himalayas message survive",
    both.unknownCandidates?.includes("himalayas") === true
    && both.flexibleDuration === true && both.surpriseMe === undefined,
    JSON.stringify(both));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
