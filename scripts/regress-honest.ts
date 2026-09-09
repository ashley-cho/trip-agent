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
import { applyOps, parseEditRules } from "@/lib/edit";
import { planTrip } from "@/lib/planner";
import { recommend } from "@/lib/recommend";
import { emptyProfile } from "@/lib/types";
import { alreadyInTheTrip } from "@/lib/answer";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mWHAT IT SAYS IS WHAT IT DID\x1b[0m\n");

// --- her words, not the taxonomy ----------------------------------------
{
  /*
   * Built from a message, not from a bare `activities` array.
   *
   * `activities` is also filled by the model and by freeform chips the model
   * writes, so "You said X" is now gated on X being words she actually typed.
   * A brief with entries and no record of her saying them is not a state the
   * app produces — the app records every message before deriving from it —
   * and testing against one was asserting that we would quote her on
   * something we had no evidence she said.
   */
  const said = "i want to see the northern lights and a city or two";
  const brief: Brief = {
    ...emptyBrief(said), days: 7, vibes: ["nature", "city"],
    activities: ["northern lights", "a city or two"],
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

// --- the tags are still the fallback, but not as a quote -----------------
// This used to assert `You said food`, which is the bug she reported later:
// vibes are our tags, so attributing them to her is a fabricated quote. They
// may still carry the line; they may not be put in her mouth.
{
  const brief: Brief = { ...emptyBrief(), days: 5, vibes: ["food"] };
  const trip = {
    concept: { days: 5, shape: [{ cityId: "lisbon", nights: 4 }] },
    days: [],
  } as unknown as Trip;
  check("with no echo, the tags still fill the line",
    /food/.test(whyLine(trip, brief)), whyLine(trip, brief));
  check("but she is not told she said them",
    !/[Yy]ou said/.test(whyLine(trip, brief)), whyLine(trip, brief));
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


// --- wanting a thing is asking for it ------------------------------------
//
// A real trip, because parseEditRules reads the plan for day numbers.
const aBrief: Brief = { ...emptyBrief(), days: 7, namedDestination: "iceland", vibes: ["nature"] };
const aTrip = planTrip(aBrief, recommend(aBrief, emptyProfile()), emptyProfile(), { startDate: "2026-10-10" });
//
// "i also really want to spend time in hot springs" parsed as `unknown` on an
// Iceland trip with Sky Lagoon and the Secret Lagoon unused in the pool, and
// the traveller got "tell me which day is wrong". The tag was recognisable
// the whole time; nothing was listening for the way people say it.
for (const said of [
  "i also really want to spend time in hot springs",
  "i'd love some hot springs",
  "would love a bit more wine",
  "hoping to see some art while we're there",
] as const) {
  const ops = parseEditRules(said, aTrip);
  check(`"${said}" is heard as a request`, ops.every((o) => o.kind !== "unknown"),
    JSON.stringify(ops));
}

/*
 * The part of the day she named is the instruction.
 *
 * "Add a free afternoon" cleared the LAST activity of the day and then said,
 * accurately, "day 2 morning is now clear". The sentence was honest and the
 * action was not what she asked for, which is the worse half of the pair this
 * file exists to keep together: she typed afternoon and got a morning.
 */
{
  const partOf = (start: string) => {
    const at = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
    return at >= 1020 ? "evening" : at >= 720 ? "afternoon" : "morning";
  };
  for (const part of ["morning", "afternoon", "evening"] as const) {
    const ops = parseEditRules(`add a free ${part}`, aTrip);
    check(`"add a free ${part}" carries the window she named`,
      ops.some((o) => o.kind === "add_downtime" && o.part === part), JSON.stringify(ops));

    /*
     * Keyed on day and start time, NOT on item id: `freeTime` mints a fresh
     * id for the downtime block it swaps in, so an id-keyed lookup never
     * matched and `cleared` was always empty — both assertions below passed
     * on any code at all, including the bug they were written for.
     */
    const before = new Map(aTrip.days.flatMap((d) => d.items.map((i) => [`${d.index}@${i.start}`, i.type] as const)));
    const res = applyOps(aTrip, ops, aBrief, emptyProfile());
    const cleared = res.trip.days.flatMap((d) => d.items.map((i) => ({ ...i, day: d.index })))
      .filter((i) => i.type === "downtime" && before.get(`${i.day}@${i.start}`) === "activity");
    check(`and something is actually cleared for "add a free ${part}"`,
      cleared.length > 0 || res.summary.some((l) => /nothing to clear/i.test(l)),
      res.summary.join(" | ").slice(0, 140));
    check(`and nothing outside the ${part} is cleared for it`,
      cleared.every((i) => partOf(i.start) === part),
      cleared.map((i) => `${i.start} ${i.name}`).join(", ") || "(nothing cleared)");
    // And it says which part, matching what it did rather than a fixed word.
    check(`and it does not report a different part of the day`,
      cleared.length === 0 || new RegExp(`\\b${part}\\b`).test(res.summary.join(" ")),
      res.summary.join(" | ").slice(0, 160));
  }
  /*
   * And the window comes from the ASK. Scanning the sentence for the first
   * day-word rebuilt the original bug: this cleared the morning market she
   * had just said to keep, and reported the morning, for a message that says
   * afternoon.
   */
  for (const [said, want] of [
    ["keep the morning market but add a free afternoon on day 2", "afternoon"],
    ["the morning is fine, i want a free evening", "evening"],
    ["mornings are precious, give me a free afternoon", "afternoon"],
  ] as const) {
    const ops = parseEditRules(said, aTrip);
    check(`"${said.slice(0, 34)}…" takes the window from the ask`,
      ops.some((o) => o.kind === "add_downtime" && o.part === want), JSON.stringify(ops));
  }
}

// ...without turning every sentence into an instruction.
//
// "dog sledding" is not one of our tags, so there is nothing to add and the
// op stays unknown. That is correct: the honest answer lives one layer up, in
// alreadyInTheTrip and the "nothing I have matches it" line, not in a parser
// inventing a tag it cannot fill.
for (const said of [
  "what's the weather like there in October?",
  "how far is the airport?",
  "i really want to do dog sledding",
] as const) {
  const ops = parseEditRules(said, aTrip);
  check(`"${said}" is still not an instruction`,
    ops.length === 1 && ops[0].kind === "unknown", JSON.stringify(ops));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
