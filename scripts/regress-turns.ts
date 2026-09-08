/**
 * How many turns before she gets a trip.
 *
 * Her value proposition, in her words: "you don't have to plan your itinerary
 * to go somewhere / no more planning, just leave." Nothing in this codebase
 * measured that, so nothing stopped it drifting. Four turns into a Turkey
 * conversation the app was still asking questions, and one of them was
 * "what sounds good right now?" about a message that had already said.
 *
 * The old ceiling was the constant 4, regardless of what she had told us. A
 * message carrying destination, interests, length, budget AND origin still
 * bought four more questions. This asserts the ceiling reads the brief.
 */
import { discoveryGate, interpretRules, nextQuestionRules } from "@/lib/discovery";
import { applyPatch } from "@/lib/brief";
import { SEEDED_ORIGIN } from "@/lib/origin";
import { emptyBrief, type Brief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `  ${d}` : ""}`);
  if (!ok) fails++;
};

/** Worst case questions between this opener and an itinerary. */
function questions(said: string): { discovery: number; logistics: number; total: number } {
  const b: Brief = applyPatch({ ...emptyBrief(), origin: SEEDED_ORIGIN },
    interpretRules(said, emptyBrief()));
  let discovery = 0;
  while (discovery < 8 && discoveryGate(b, discovery) !== "stop") discovery++;
  let logistics = 0;
  if (nextQuestionRules(b, "logistics")) logistics++;
  return { discovery, logistics, total: discovery + logistics };
}

/** said, the most questions it may cost. */
const CASES: [string, number][] = [
  // Everything supplied. Should cost nothing.
  ["i want to go to hokkaido for 10 days. food, onsen and driving. budget about $3,000, flying from san francisco.", 1],
  // Where and why, no length. One question at most.
  ["i wanna go to turkey but not istanbul or anywhere touristy. heard good things about their coastal lines", 2],
  ["i want to go to iceland to see the northern lights. give me an itinerary", 1],
  ["10 days in portugal, food and wine", 1],
  ["i want to go to oaxaca for 6 days. food, markets and craft.", 1],
  // Where only.
  ["i want to go to japan", 2],
  // Why only.
  ["somewhere warm with good food", 2],
  // Nothing at all is the one case that earns real questions.
  ["i need a vacation. surprise me.", 3],
  ["hi", 3],
];

console.log("\n\x1b[1mTURNS TO A TRIP\x1b[0m\n");
for (const [said, cap] of CASES) {
  const q = questions(said);
  check(`≤${cap}  "${said.slice(0, 52)}${said.length > 52 ? "…" : ""}"`,
    q.total <= cap, `costs ${q.total} (${q.discovery} discovery + ${q.logistics} logistics)`);
}

/*
 * The two rules underneath, asserted directly so a future change to the
 * ceiling has to break them explicitly rather than by drift.
 */
const withBoth: Brief = { ...emptyBrief(), namedDestination: "portugal", vibes: ["food"] };
check("knowing where and why ends discovery after one question",
  discoveryGate(withBoth, 1) === "stop");
const exclusionsOnly: Brief = {
  ...emptyBrief(), namedDestination: "portugal",
  constraints: ["not istanbul or anywhere touristy"], avoidTags: ["iconic"],
};
check("saying what she does NOT want counts as saying what she wants",
  discoveryGate(exclusionsOnly, 1) === "stop");
check("budget is never a blocking question",
  nextQuestionRules({ ...emptyBrief(), namedDestination: "portugal", days: 7 }, "logistics") === null);
check("but length is still asked for somewhere we have to research",
  nextQuestionRules({ ...emptyBrief(), unknownCandidates: ["hokkaido"] }, "logistics")?.id === "duration");

/*
 * The generic question must not be asked about a message that named a place.
 *
 * "i wanna go to canada to see the northern lights, heard about this cute
 * little town up there" came back as "a surprise-me brief is the fun one".
 * The structural question checked namedDestination and candidates only, and
 * anywhere the catalogue does not hold lands in unknownCandidates — so a
 * fully specified message looked identical to an empty one, and the model was
 * handed the generic vibes question to reword. Her options came back as a
 * paraphrase of the vibe chips, which is the fingerprint.
 *
 * Since tonight the catalogue holds a small fraction of the world on purpose,
 * so this was going to fire on almost every real message.
 */
for (const [label, b] of [
  ["a place we don't hold", { ...emptyBrief(), unknownCandidates: ["canada"], unknownDestination: "canada" }],
  ["a place we do hold", { ...emptyBrief(), namedDestination: "portugal" }],
  ["a city", { ...emptyBrief(), namedDestination: "mexico", focusCityId: "oaxaca" }],
  ["a shortlist", { ...emptyBrief(), candidates: ["italy", "france"] }],
  ["a region", { ...emptyBrief(), region: "europe" }],
  ["a reason but no place", { ...emptyBrief(), interestEcho: "northern lights" }],
  ["only an exclusion", { ...emptyBrief(), constraints: ["not istanbul or anywhere touristy"] }],
] as [string, Brief][]) {
  check(`no generic "what sounds good" after ${label}`,
    nextQuestionRules(b, "discovery") === null,
    nextQuestionRules(b, "discovery")?.prompt ?? "");
}
check("but it is still there when she has said nothing at all",
  nextQuestionRules(emptyBrief(), "discovery")?.id === "vibes");

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
