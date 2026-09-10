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
import { emptyBrief, stating, type Brief, type Trip } from "@/lib/types";
import { researchPrompt } from "@/lib/research";
import { applyOps, parseEditRules } from "@/lib/edit";
import {
  claimAccuracy, qualifierFidelity, noiseRate, clauseAccounting, callEconomy,
  idempotence, tripSignature, wordsSurvive, purposePhrases, attributionAccuracy,
} from "@/evals/metrics";
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


/*
 * The two metrics themselves, because a metric with no test is a number that
 * can quietly stop meaning anything. Both were added after a bug that every
 * existing metric scored 100% on, so the thing worth pinning is that each one
 * can still go red.
 */
console.log("\n\x1b[1mTHE METRICS CAN STILL FAIL\x1b[0m\n");
{
  /*
   * A phrase the strict matcher cannot see but a name plainly serves. "gaudi"
   * against "Sagrada Família" is the real case: the accent was deleted before
   * comparison, so the trip announced a gap above its own centrepiece.
   */
  const item = (name: string, tags: string[]) => ({
    id: "x", type: "activity" as const, name, start: "10:00", durationMin: 90,
    reason: "A long enough reason to count.", costUsd: 0, tags,
  }) as unknown as Trip["days"][number]["items"][number];
  const tripWith = (name: string, tags: string[] = ["iconic"]): Trip =>
    ({ ...aTrip, days: [{ ...aTrip.days[0], items: [item(name, tags)] }] });
  const asked = (a: string): Brief => ({ ...aBrief, activities: [a] });

  const served = tripWith("Designmuseum Danmark", ["museum"]);
  check("a phrase the plan's own names serve is not left claimed missing",
    claimAccuracy(served, asked("design")).score === 1, claimAccuracy(served, asked("design")).raw);
  const gap = tripWith("Kaiseki dinner", ["food"]);
  check("and a real absence is not penalised",
    claimAccuracy(gap, asked("design")).score === 1, claimAccuracy(gap, asked("design")).raw);
  /*
   * The metric's own teeth: when the strict matcher misses something a name
   * plainly holds, it has to go red. Asserted through the metric rather than
   * through a mutation of the matcher, so it stays true if the matcher is
   * rewritten.
   */
  const missedByStrict = tripWith("Supermarket tour", ["food"]);
  check("but a claim contradicted by a name in the plan scores 0",
    claimAccuracy(missedByStrict, asked("market")).score === 0,
    claimAccuracy(missedByStrict, asked("market")).raw);

  const before = aTrip;
  const moveEvening = {
    ...before,
    days: before.days.map((d, n) => n !== 0 ? d : { ...d, items: d.items.map((i, k) =>
      k === d.items.length - 1 ? { ...i, name: `${i.name} (changed)` } : i) }),
  };
  const at = before.days[0].items[before.days[0].items.length - 1].start;
  const part = Number(at.slice(0, 2)) * 60 + Number(at.slice(3, 5)) >= 720 ? "morning" : "evening";
  check(`an edit that named the ${part} but changed something else scores below 1`,
    qualifierFidelity(before, moveEvening, `add a free ${part}`).score < 1,
    qualifierFidelity(before, moveEvening, `add a free ${part}`).raw);
  check("and an edit that named nothing is not judged on where it landed",
    qualifierFidelity(before, moveEvening, "make it less touristy").score === 1,
    qualifierFidelity(before, moveEvening, "make it less touristy").raw);
}

/*
 * The five added with the destination sweep. Same rule as the two above: each
 * was written for a defect every other metric scored 100% on, so what is
 * pinned here is that each one can still go red — and, for the two that are
 * red on today's code, that they are red for the reason claimed and not for a
 * rounding accident.
 */
{
  const item = (name: string, tags: string[]) => ({
    id: "x", type: "activity" as const, name, start: "10:00", durationMin: 90,
    reason: "A long enough reason to count.", costUsd: 0, tags,
  }) as unknown as Trip["days"][number]["items"][number];
  const tripWith = (name: string, tags: string[] = ["food"]): Trip =>
    ({ ...aTrip, days: [{ ...aTrip.days[0], items: [item(name, tags)] }] });
  const gap = tripWith("Kaiseki dinner");
  /** A brief carrying what she typed, exactly as the app records it. */
  const typed = (opening: string, activities: string[]): Brief =>
    ({ ...stating(emptyBrief(opening), opening, "typed"), days: 7, activities });

  // --- noise_rate --------------------------------------------------------
  {
    const asked = typed("i want to go to iceland for bungee jumping", ["bungee jumping"]);
    check("a thing she asked for and did not get is a statement worth making",
      noiseRate(gap, asked).score === 1, noiseRate(gap, asked).raw);

    const wondering = typed("is there anywhere good for bungee jumping?", ["bungee jumping"]);
    check("but the same words inside a question are not a request",
      noiseRate(gap, wondering).score === 0, noiseRate(gap, wondering).raw);

    const who = typed("i want to go to iceland for my honeymoon", ["my honeymoon"]);
    check("and a possessed phrase is who, not what",
      noiseRate(gap, who).score === 0, noiseRate(gap, who).raw);

    const invented = typed("i want to go to iceland", ["dog sledding"]);
    check("a phrase she never typed is never worth a sentence",
      noiseRate(gap, invented).score === 0, noiseRate(gap, invented).raw);

    const served = tripWith("Bungee jumping off the Kawarau bridge", ["adventure"]);
    check("and nothing is counted when there was nothing to say",
      noiseRate(served, typed("i want to go to iceland for bungee jumping", ["bungee jumping"])).score === 1,
      noiseRate(served, typed("i want to go to iceland for bungee jumping", ["bungee jumping"])).raw);
  }

  // --- words_survive -----------------------------------------------------
  //
  // Two failures, not one. A phrase that was on the brief and is not on it any
  // more, which is what the metric always caught; and a phrase she typed that
  // never reached the brief and is in nothing the app shows or says, which is
  // what it was blind to. Everything else here pins the boundary neither may
  // cross, because a metric that reds on correct behaviour gets switched off
  // within a week.
  {
    /** The brief as it stood at one point in the session. */
    const at = (opening: string, x: Partial<Brief>): Brief =>
      ({ ...stating(emptyBrief(opening), opening, "typed"), ...x });
    const OPEN = "i want to go to portugal for surfing, no early starts, six days";
    /** A session in which the app showed her nothing and said nothing. */
    const mute = (...typed: string[]) => ({ typed, plan: [], spoken: [] });

    const held = at(OPEN, { activities: ["surfing"], constraints: ["no early starts"], days: 6 });
    check("a phrase that lands and stays is kept",
      wordsSurvive([held, held, held], mute(OPEN)).score === 1,
      wordsSurvive([held, held, held], mute(OPEN)).raw);

    const dropped = at(OPEN, { activities: [], constraints: ["no early starts"], days: 6 });
    const lost = wordsSurvive([held, dropped], mute(OPEN));
    check("a phrase that was on the brief and later vanished is a loss, by name",
      lost.score < 1 && /"surfing"/.test(lost.raw), lost.raw);

    /*
     * THE ONE IT EXISTS FOR, and the one the first version of this metric was
     * written to ignore.
     *
     * A phrase refused at parse time reaches no snapshot, so a denominator
     * taken from the brief cannot see it and scored this 100%. It is the exact
     * shape of the `NOT_AN_ACTIVITY` widening: she typed it, the app took no
     * note of it, showed nothing about it and said nothing about it. The
     * denominator is now her sentence, so the refusal is visible.
     */
    const never = at(OPEN, { activities: [], constraints: ["no early starts"], days: 6 });
    const refused = wordsSurvive([never, never], mute(OPEN));
    check("a phrase refused at parse time, and mentioned nowhere, is a loss",
      refused.score < 1 && /"surfing"/.test(refused.raw), refused.raw);

    /*
     * And the boundary on that: refusing to file a phrase is fine when the app
     * still puts it in front of her. What is being measured is whether she can
     * find her words, not which field they are in.
     */
    const inPlan = wordsSurvive([never, never],
      { typed: [OPEN], plan: ["Surfing at Praia do Amado"], spoken: [] });
    check("a refused phrase that is plainly in the plan is not a loss",
      inPlan.score === 1, inPlan.raw);
    const saidBack = wordsSurvive([never, never],
      { typed: [OPEN], plan: [], spoken: ["surfing — I couldn't match that to anything in the plan"] });
    check("a refused phrase named back to her as not done is not a loss",
      saidBack.score === 1, saidBack.raw);

    /*
     * `namedDestination` is set on both ends because she typed "portugal" in
     * that sentence and the metric now reads her sentence, not only the brief.
     * Dropping the country from the fixture would be a real loss and the
     * metric is right to say so; what is being asserted here is about "dog
     * sledding", which is the app's invention and never hers to lose.
     */
    const said = { namedDestination: "portugal" };
    const invented = at("i want to go to portugal", { ...said, activities: ["dog sledding"] });
    const after = at("i want to go to portugal", said);
    check("a phrase she never typed is not hers to lose",
      wordsSurvive([invented, after], mute("i want to go to portugal")).score === 1,
      wordsSurvive([invented, after], mute("i want to go to portugal")).raw);

    // mergeActivities replaces a thinner wording with a fuller one. The phrase
    // is still there, inside the longer entry, and calling that a loss would
    // red the fix rather than the bug.
    const fuller = at(OPEN, { activities: ["surfing"], constraints: ["no early starts"], days: 6 });
    const merged = at(OPEN, { activities: ["surfing in the morning"], constraints: ["no early starts"], days: 6 });
    check("a fuller re-wording of the same phrase is not a loss",
      wordsSurvive([fuller, merged], mute(OPEN)).score === 1,
      wordsSurvive([fuller, merged], mute(OPEN)).raw);

    const stated6 = at(OPEN, { activities: ["surfing"], days: 6 });
    check("a stated length that is gone at the end is a loss",
      wordsSurvive([stated6, at(OPEN, { activities: ["surfing"] })], mute(OPEN)).score < 1,
      wordsSurvive([stated6, at(OPEN, { activities: ["surfing"] })], mute(OPEN)).raw);
    check("but one she withdrew by saying she was flexible is not",
      wordsSurvive([stated6, at(OPEN, { activities: ["surfing"], flexibleDuration: true })],
        mute(OPEN)).score === 1,
      wordsSurvive([stated6, at(OPEN, { activities: ["surfing"], flexibleDuration: true })],
        mute(OPEN)).raw);

    /*
     * The shortlist. An option she declined and a phrase that was deleted look
     * identical from here, so it is counted and named and kept out of the
     * ratio — the number is for a reader, not folded into a score that would
     * then mean two things.
     */
    const PICK = "japan or korea, help me pick";
    const shortlist = wordsSurvive([
      at(PICK, { candidates: ["japan", "korea"] }),
      at(PICK, { namedDestination: "korea" }),
    ], mute(PICK));
    check("a shortlist option narrowed away is reported, not scored",
      shortlist.score === 1 && /narrowed away/.test(shortlist.raw) && /"japan"/.test(shortlist.raw),
      shortlist.raw);

    /*
     * The segmentation, pinned on its own. `purposePhrases` has to read the
     * same span of the sentence `statedActivity` reads, or the metric is
     * grading a phrase the app never considered.
     */
    check("the purpose clause is read narrowest-first, per clause",
      JSON.stringify(purposePhrases("i wanna go to portugal for surfing")) === '["surfing"]',
      JSON.stringify(purposePhrases("i wanna go to portugal for surfing")));
    check("and a reason the parser refuses is still read as the purpose",
      JSON.stringify(purposePhrases("i want to go to greece for a rest")) === '["a rest"]',
      JSON.stringify(purposePhrases("i want to go to greece for a rest")));
  }

  // --- attribution_accuracy ----------------------------------------------
  {
    const typedAs = (opening: string, ...more: string[]): Brief =>
      more.reduce((b, t) => stating(b, t, "typed"), stating(emptyBrief(opening), opening, "typed"));
    const her = typedAs("i want to eat my way through a city for a week", "food and wine, and some markets");

    check("a quote of her own words is a quote",
      attributionAccuracy(["You said food and wine."], her).score === 1,
      attributionAccuracy(["You said food and wine."], her).raw);

    /*
     * The tag list read back as a quote. "city energy" is a vibe LABEL and she
     * typed "a city"; this is the fabrication the guard in whyLine exists for,
     * and it is live on the korea-food scenario today.
     */
    const tag = attributionAccuracy(["You said city energy. This is where it is."], her);
    check("a taxonomy label she never typed is not a quote",
      tag.score === 0 && /city energy/.test(tag.raw), tag.raw);

    /*
     * Stricter than lib/brief.ts `quotable` on purpose. Every word of "wine
     * markets" is somewhere in her text, so the bag test passes it; she never
     * said the two together, and this is the failure a bag test cannot see.
     */
    const stitched = attributionAccuracy(["You said wine markets."], her);
    check("a phrase stitched out of two sentences is not a quote",
      stitched.score === 0, stitched.raw);

    check("a claim that trails its subject is read off the subject",
      attributionAccuracy(["Markets were on your list, and this one still works."], her).score === 1,
      attributionAccuracy(["Markets were on your list, and this one still works."], her).raw);
    const trailed = attributionAccuracy(["Kayaking was on your list, and this one still works."], her);
    check("and the same sentence about something she never said goes red",
      trailed.score === 0 && /Kayaking/.test(trailed.raw), trailed.raw);

    // Naming our tags is fine. Putting them in her mouth is not — so prose
    // with no claim in it must not be scored at all.
    check("prose that attributes nothing is not judged on her vocabulary",
      attributionAccuracy(["Seven days, built around food, city rather than a checklist."], her).score === 1,
      attributionAccuracy(["Seven days, built around food, city rather than a checklist."], her).raw);

    // A chip is our taxonomy that she clicked, not a phrase she typed.
    const picked = stating(stating(emptyBrief("plan me a trip"), "plan me a trip", "typed"), "city energy", "picked");
    const chip = attributionAccuracy(["You said city energy."], picked);
    check("a chip label she clicked is not something she said", chip.score === 0, chip.raw);

    // And the one it was born for: "can you plan me a trip" names nothing, so
    // nothing may be attributed off it.
    const nothing = stating(emptyBrief("can you plan me a trip"), "can you plan me a trip", "typed");
    const gate = attributionAccuracy(["You asked for wine. This is the version that isn't a performance."], nothing);
    check("\"can you plan me a trip\" licenses no attribution at all",
      gate.score === 0 && /wine/.test(gate.raw), gate.raw);
  }

  // --- clause_accounting -------------------------------------------------
  {
    const parse = async (t: string) => parseEditRules(t, aTrip);
    const run = (said: string, unresolved: string[] = []) => clauseAccounting(said, parse, unresolved);
    void (async () => {
      const dropped = await run("more hot springs and more helicopters");
      check("a clause that produced nothing and was never mentioned is a silent drop",
        dropped.score < 1 && /helicopters/.test(dropped.raw), dropped.raw);

      const both = await run("fewer museums and more food");
      check("two clauses that both landed are both accounted for",
        both.score === 1, both.raw);

      /*
       * The false alarm the first version of this metric raised. Two clauses
       * asking for the SAME op: deleting either changes nothing, so pure
       * ablation called both of them dropped and scored a correct turn zero.
       */
      const same = await run("actually this is too busy, slow it down");
      check("two clauses asking for one thing are not two silent drops",
        same.score === 1, same.raw);

      const spoken = await run("more wine, can you book me a car", ["can you book me a car"]);
      check("a clause the engine cannot do is accounted for by saying so",
        spoken.score === 1, spoken.raw);

      // --- call_economy ----------------------------------------------------
      const log = (...names: string[]) => names.map((name) => ({ name }));
      check("notes plus pack for one place is the designed cost",
        callEconomy(log("researchStream", "researchPack"), ["x"]).score === 1,
        callEconomy(log("researchStream", "researchPack"), ["x"]).raw);
      const worst = callEconomy(
        log("researchStream", "researchStream", "researchPack", "researchPack"), ["x"]);
      check("and both retries firing for one place is visible, not free",
        worst.score < 1 && /4\.0 calls\/place/.test(worst.raw), worst.raw);
      check("what she typed does not count as a call about a place",
        callEconomy(log("interpret", "nextQuestion", "parseEdit", "pitch"), ["x"]).score === 1,
        callEconomy(log("interpret", "nextQuestion", "parseEdit", "pitch"), ["x"]).raw);

      // --- idempotence -----------------------------------------------------
      const other: Trip = { ...aTrip, days: aTrip.days.map((d, n) => n ? d : ({
        ...d, items: d.items.map((i, k) => k ? i : ({ ...i, name: `${i.name} (moved)` })) })) };
      check("the same plan twice is the same plan",
        idempotence({ a: aTrip, b: aTrip }).score === 1,
        idempotence({ a: aTrip, b: aTrip }).raw);
      const drifted = idempotence({ a: aTrip, b: other });
      check("and a plan that came back different says so, in the half that failed",
        drifted.score === 0 && /SAME BRIEF GAVE TWO DIFFERENT PLANS/.test(drifted.raw), drifted.raw);
      const halfway = idempotence({ a: aTrip, b: aTrip },
        [{ said: "no museums", back: "more museums", landed: true, restored: false }]);
      check("an edit that does not come back is half a failure, and named as one",
        halfway.score === 0.5 && /did not come back/.test(halfway.raw), halfway.raw);
      /*
       * A declined forward edit is not a round trip, and the skip has to be
       * visible: "Add more wine" on a trip with no wine left to add does not
       * move the plan, so blaming the undo for not restoring it was scoring
       * the app for a change it never made. Silently dropping it instead
       * would make this half free.
       */
      const declined = idempotence({ a: aTrip, b: aTrip },
        [{ said: "add more wine", back: "less wine", landed: false, restored: false }]);
      check("a declined edit is not counted as a failed round trip",
        declined.score === 1, declined.raw);
      check("and the skip is said out loud rather than hidden",
        /declined/.test(declined.raw), declined.raw);
      check("and the signature is what both halves compare",
        tripSignature(aTrip) !== tripSignature(other));

      console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
      process.exit(fails ? 1 : 0);
    })();
  }
}
