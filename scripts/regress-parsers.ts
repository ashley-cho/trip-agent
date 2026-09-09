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
  ] as const) {
    check(`"${text.slice(0, 38)}…" still keeps ${want}`,
      (statedActivity(text) ?? "").includes(want), String(statedActivity(text)));
  }
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
