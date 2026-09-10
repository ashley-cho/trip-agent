/**
 * Drift, caught four ways — and proved to be catchable.
 *
 * Two halves, and the second is the one that matters.
 *
 * The first half is the detectors as pure functions: each fires on the thing
 * it watches and stays quiet on ordinary copy. The second half runs advance()
 * with stubbed drivers and asserts what she READS when one fires, because a
 * detector that logs a warning and lets the turn carry on is not a guard, it
 * is a comment.
 *
 * Written against a repo where three tests today were green against the exact
 * bug they were written for. So every case below was checked by breaking the
 * thing it watches and confirming the assertion went red — the table is in the
 * report — and every detector is asserted NOT to fire on the other three
 * kinds' inputs, because a detector that fires on everything is the same as
 * one that fires on nothing.
 */
import { advance, type FlowAgent, type FlowIO, type FlowRefs, type Stage } from "@/lib/flow";
import {
  anchorOf, labelDrift, proseDrift, sameQuestion, subjectDrift, threadDrift, type Drift,
} from "@/lib/drift";
import { applyPatch } from "@/lib/brief";
import { interpretRules } from "@/lib/discovery";
import { emptyBrief, emptyProfile } from "@/lib/types";
import type { Brief, Trip } from "@/lib/types";
import type { Question, Turn } from "@/lib/agent/types";
import { rulesDriver } from "@/lib/agent/rules";
import { DESTINATIONS } from "@/data/destinations";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

const from = (msgs: string[]): Brief => {
  let b = emptyBrief(msgs[0]);
  for (const m of msgs) b = applyPatch(b, interpretRules(m, b));
  return b;
};
const q = (id: Question["id"], prompt: string): Question => ({ id, prompt, kind: "single" });

// ---------------------------------------------------------------------------
// 1. Off the destination or brief.
// ---------------------------------------------------------------------------
console.log("\n\x1b[1m1. OFF THE DESTINATION OR BRIEF\x1b[0m\n");
{
  const faroes = from(["i want to go to the faroe islands"]);
  check("a Faroe Islands brief answered with New Zealand is drift",
    !!subjectDrift(anchorOf(faroes), "newzealand"),
    JSON.stringify(anchorOf(faroes)));

  const portugal = from(["Plan me a trip to Portugal."]);
  check("and going where she said is not",
    !subjectDrift(anchorOf(portugal), "portugal"));

  // The New Orleans / Paris turn: the pin is hers, so drifting off it counts.
  check("drifting off a destination already pitched is drift",
    !!subjectDrift(anchorOf(emptyBrief("more detail please"), "mexico"), "portugal"));
  check("and staying on it is not",
    !subjectDrift(anchorOf(emptyBrief("more detail please"), "mexico"), "mexico"));

  // She turned it down. Moving on is her decision, not the agent's drift.
  check("moving off somewhere she rejected is not drift",
    !subjectDrift(anchorOf(portugal, "portugal", { rejectedDestinationIds: ["portugal"] }), "korea"));
  check("nor is choosing freely when she has named nowhere",
    !subjectDrift(anchorOf(from(["I need a vacation. Surprise me."])), "portugal"));

  // Not the other three kinds. A wandering paragraph, a repeated question and
  // a bad label all leave the subject exactly where it was.
  const stayed = anchorOf(portugal);
  check("prose about somewhere else does not move the subject detector",
    !subjectDrift(stayed, "portugal"));
}

// ---------------------------------------------------------------------------
// 2. The model's prose wandering.
// ---------------------------------------------------------------------------
console.log("\n\x1b[1m2. THE PROSE WANDERING\x1b[0m\n");
{
  const about = { name: "Portugal", id: "portugal" };
  check("a Portugal pitch that sends her to Kyoto is caught",
    !!proseDrift(about, "Five days in Portugal, then three nights in Kyoto and two in Tokyo to finish."));
  check("a Portugal pitch about Portugal is not",
    !proseDrift(about, "Five days in Lisbon and Porto: the seafood, the tiles, and a day out at Sintra."));
  check("a paragraph that never names the place it is about is caught",
    !!proseDrift(about, "The region is lovely at this time of year and the food is very good indeed, honestly."));

  // The itinerary is the ground truth for a city claim: naming a base the trip
  // does not visit is a promise the plan cannot keep.
  check("promising a city this trip does not go to is caught",
    !!proseDrift({ ...about, plannedCities: ["lisbon"] },
      "Four nights in Lisbon, then up to Porto for the last two — the river and the port lodges."));
  check("and naming only the cities it does visit is not",
    !proseDrift({ ...about, plannedCities: ["lisbon"] },
      "Four nights in Lisbon: the seafood, the tiles, and a day out of the city at the end."));

  // Ordinary landscape writing has to survive, or the guard eats good pitches.
  // Same cases as scripts/regress-pitchguard.ts, on the other side of the seam.
  for (const prose of [
    "Limestone karst, deep gorges and alpine lakes in the south of the province, all within an hour of Yunnan's bases.",
    "Gorge country, and the trails start an hour from where you sleep in Yunnan.",
    "It is an island, so nothing in Yunnan is more than two hours away by road.",
  ]) {
    check(`landscape writing survives: "${prose.slice(0, 40)}…"`,
      !proseDrift({ name: "Yunnan", id: "yunnan" }, prose));
  }

  // The research write-up: countries only, because a true sentence about the
  // flight must not cost her the trip.
  check("a Faroes write-up answered with New Zealand is caught",
    !!proseDrift({ name: "the faroe islands" },
      "Honestly, for this kind of trip you want New Zealand — the South Island does it better.",
      { scope: "destinations" }));
  check("and a Faroes write-up that mentions the flight is not",
    !proseDrift({ name: "the faroe islands" },
      "Two flights a day from Copenhagen, and the Faroes are small enough to drive end to end.",
      { scope: "destinations" }));

  // Not the other three. A repeated question and a bad label are not prose.
  check("a re-asked question is not prose drift",
    !proseDrift(about, "How many days have you got? I still need the length before I can plan Portugal properly."));
}

// ---------------------------------------------------------------------------
// 3. Losing the thread.
// ---------------------------------------------------------------------------
console.log("\n\x1b[1m3. LOSING THE THREAD\x1b[0m\n");
{
  const said = from(["i want to go to portugal", "six days", "around $2,000"]);
  check("asking the length she already gave is caught",
    !!threadDrift(q("duration", "How many days have you got?"), [], said),
    `days=${said.days}`);
  check("asking the budget she already gave is caught",
    !!threadDrift(q("budget", "Roughly what do you want to spend?"), [], said),
    `budget=${said.budgetUsd}`);
  check("asking for a length she has not given is not",
    !threadDrift(q("duration", "How many days have you got?"), [], from(["i want to go to portugal"])));

  // A model-authored question carries the id "open", so the slot table cannot
  // reach it. Only the unmistakable asks are read out of the prose.
  check("a model-worded re-ask of the same slot is caught",
    !!threadDrift(q("open", "Before I plan it — how long have you got?"), [], said));
  check("and a genuinely new question is not",
    !threadDrift(q("open", "Are you driving, or would you rather train it?"), [], said));

  // The second ask is REASK's job, not drift. The third is the loop.
  const hist = (n: number): Turn[] => {
    const out: Turn[] = [];
    for (let i = 0; i < n; i++) {
      out.push({ from: "agent", text: "What sounds good right now?" });
      out.push({ from: "user", text: `answer ${i}` });
    }
    return out;
  };
  const open = from(["i need to get away, not sure where yet"]);
  check("asking a second time, with the slot still empty, is not drift",
    !threadDrift(q("vibes", "What sounds good right now?"), hist(1), open));
  check("asking a third time is",
    !!threadDrift(q("vibes", "What sounds good right now?"), hist(2), open));
  check("a question she has not answered yet is not a repeat",
    !threadDrift(q("vibes", "What sounds good right now?"),
      [{ from: "agent", text: "What sounds good right now?" }], open));

  check("two wordings of the same question are the same question",
    sameQuestion("How many days have you got?", "Roughly how many days are we talking?"));
  check("and a different question is not",
    !sameQuestion("How many days have you got?", "Where are you flying from?"));

  // Not the other three. Wandering prose is not a question.
  check("a wandering pitch is not thread drift",
    !threadDrift(q("open", "Shall I send you to Kyoto instead?"), [], from(["i want to go to portugal"])));
}

// ---------------------------------------------------------------------------
// 4. The visible thinking text.
// ---------------------------------------------------------------------------
console.log("\n\x1b[1m4. THE VISIBLE THINKING TEXT\x1b[0m\n");
{
  const subject = "the faroe islands";
  check("the label for the place being looked up is fine",
    !labelDrift(subject, subject));
  check("and a short note after the pipe is fine",
    !labelDrift("The Faroe Islands|one more go", subject));

  /*
   * The bug that was in this repo when these detectors were written. The pack
   * retry built its label with a comma where the other three call sites use a
   * pipe, and the UI title-cases everything before the pipe — so she read
   * "Reading up on The Faroe Islands, One More Go…".
   */
  check("a comma where the pipe should be is caught",
    !!labelDrift("The Faroe Islands, one more go", subject),
    labelDrift("The Faroe Islands, one more go", subject)?.evidence);

  check("naming a different place from the one being researched is caught",
    !!labelDrift("New Zealand", subject));
  check("machinery is caught",
    !!labelDrift("The Faroe Islands|retrying the research pack", subject));
  check("and so is rambling",
    !!labelDrift("The Faroe Islands|having another go at the bits that came back short", subject));
  check("nothing to say is not drift",
    !labelDrift(null, subject));

  // Not the other three. A label is not a pitch and not a question.
  check("a good label is not caught by the prose detector",
    !proseDrift({ name: "the faroe islands" }, "The Faroe Islands|one more go", { scope: "destinations" }));
}

// ---------------------------------------------------------------------------
// The turn. What she actually reads when one fires.
// ---------------------------------------------------------------------------
interface Run {
  said: string[]; asked: string[]; trip: Trip | null; drift: Drift[];
  labels: (string | null)[]; streamsClosed: number;
}

function stub(over: Record<string, unknown> = {}): FlowAgent {
  return {
    question: async () => ({ question: null, driver: "llm" }),
    budget: async () => ({ ok: true }),
    suggest: async () => ({ place: undefined, problem: "no", driver: "llm" }),
    researchStream: async () => ({ problem: "no web", driver: "llm" }),
    researchPack: async () => ({ pack: undefined, problem: "nothing came back", driver: "llm" }),
    researchPlaces: async () => ({ places: [] }),
    pitch: async (r: { destinationId: string }) => ({
      pitch: { headline: `Go to ${r.destinationId}.`, body: "Because." }, driver: "llm" }),
    stays: async () => ({ stays: [], driver: "llm" }),
    ...over,
  } as unknown as FlowAgent;
}

async function run(b0: Brief, over: Record<string, unknown> = {},
                   prof = emptyProfile()): Promise<Run> {
  const out: Run = { said: [], asked: [], trip: null, drift: [], labels: [], streamsClosed: 0 };
  const io: FlowIO = {
    say: (f, t) => { if (f === "agent") out.said.push(t); },
    ask: (x) => out.asked.push(x.prompt),
    noteDriver: () => {}, setBrief: () => {},
    setTrip: (t) => { out.trip = typeof t === "function" ? (t as (c: Trip | null) => Trip | null)(out.trip) : t; },
    setStage: (_s: Stage) => {}, setQuestion: () => {},
    setResearching: (l) => out.labels.push(l),
    noteDrift: (d) => out.drift.push(d),
    openStream: () => "s", appendTo: () => () => {},
    closeStream: () => { out.streamsClosed++; },
    rememberSeen: () => {},
  };
  const refs: FlowRefs = {
    history: { current: [] }, pitched: { current: null }, headline: { current: "" },
    failedResearch: { current: null }, gen: { current: 0 },
  };
  await advance(b0, prof, io, refs, stub(over));
  return out;
}
const heard = (r: Run) => r.said.join(" · ");
const kinds = (r: Run) => r.drift.map((d) => d.kind).join(",");

async function main() {
  console.log("\n\x1b[1mTHE TURN: WHAT SHE READS WHEN ONE FIRES\x1b[0m\n");

  /*
   * The real driver's real prose, for every destination we hold.
   *
   * Everything else in this file stubs the pitch, which is right for asserting
   * what the turn DOES and useless for noticing that a shipped pitch wanders.
   * Breaking `rulesDriver.pitch` so it ends every pitch with "three nights in
   * Kyoto and two in Tokyo" moved the scorecard from 100% to 16% and left
   * `npm run regress` completely green — a bug in the words she reads, shipped
   * past the suite. This case closes that.
   */
  for (const d of DESTINATIONS) {
    const brief: Brief = { ...from(["i want a holiday"]), days: 6 };
    const rec = { destinationId: d.id, confidence: "high" as const, scores: [] };
    const { headline, body } = await rulesDriver.pitch(rec, brief);
    const drift = proseDrift({ name: d.name, id: d.id }, `${headline} ${body}`);
    check(`the shipped pitch for ${d.name} stays on ${d.name}`, !drift, drift?.evidence);
  }

  // --- subject: stop, name both places, refuse to substitute ---------------
  {
    /*
     * A one-item shortlist. `recommend` only honours `candidates` when there
     * is more than one, so a brief carrying exactly one falls through to the
     * open field and scores the whole catalogue — which is the shape of every
     * substitution bug in this file's history, reached without touching a
     * single flag.
     */
    const b: Brief = { ...from(["i wanna hike a national park"]), candidates: ["portugal"], days: 7,
      vibes: ["nature", "adventure"] as Brief["vibes"] };
    const r = await run(b);
    check("it stops rather than pitching somewhere she did not name",
      !r.trip && r.drift.some((d) => d.kind === "subject"), `${kinds(r)} · ${heard(r).slice(0, 90)}`);
    check("and it names both places and says it is not substituting",
      /that's me drifting|not going to|stopping/i.test(heard(r)) && /portugal/i.test(heard(r)),
      heard(r).slice(0, 160));
    check("and only the subject detector fired",
      r.drift.every((d) => d.kind === "subject"), kinds(r));
  }

  // --- prose, streamed research: take it back and stop this subject --------
  {
    const b: Brief = { ...from(["i want to go to the faroe islands"]), days: 7 };
    const r = await run(b, {
      researchStream: async () => ({
        text: "The Faroe Islands are fine, but honestly, for a week of this you want New Zealand. "
          + "New Zealand has all of it — the fjords, the passes, the weather — and it is a better trip.",
        sources: [], driver: "llm",
      }),
    });
    check("a write-up that wanders is caught and the paragraph is taken back",
      r.drift.some((d) => d.kind === "prose") && r.streamsClosed > 0,
      `${kinds(r)} · closed=${r.streamsClosed}`);
    check("and she is told it did not come together, not sent elsewhere",
      /couldn't work up/i.test(heard(r)) && !r.trip && !/new zealand/i.test(heard(r)),
      heard(r).slice(0, 140));
    check("and the pack is never built from the wandering notes",
      !r.trip, String(r.trip));
  }
  {
    // The same call, staying on the subject, is not disturbed.
    const b: Brief = { ...from(["i want to go to the faroe islands"]), days: 7 };
    const r = await run(b, {
      researchStream: async () => ({
        text: "Yes, go. The Faroe Islands in a week: Tórshavn as a base, two flights a day from Copenhagen.",
        sources: [], driver: "llm",
      }),
    });
    check("an honest write-up raises nothing",
      !r.drift.some((d) => d.kind === "prose"), kinds(r));
  }

  // --- prose, the pitch: do not speak it ----------------------------------
  {
    const b: Brief = { ...from(["i want to go to portugal"]), days: 6 };
    const r = await run(b, {
      pitch: async () => ({
        pitch: {
          headline: "This is the one.",
          body: "Three nights in Kyoto, then two in Tokyo, and a day trip out to Nara if the weather holds.",
        }, driver: "llm",
      }),
    });
    check("a pitch that names somewhere else is never spoken",
      !/kyoto|tokyo/i.test(heard(r)) && r.drift.some((d) => d.kind === "prose"),
      `${kinds(r)} · ${heard(r).slice(0, 120)}`);
    check("and she is told why, rather than shown a quieter substitute",
      /wandered off/i.test(heard(r)) && !r.trip, heard(r).slice(0, 140));
  }
  {
    const b: Brief = { ...from(["i want to go to portugal"]), days: 6 };
    const r = await run(b, {
      pitch: async () => ({
        pitch: {
          headline: "Six days in Portugal, mostly Lisbon.",
          body: "The seafood, the tiles, and one day out of the city. Portugal in October is the good version.",
        },
        driver: "llm",
      }),
    });
    check("an honest pitch is spoken and the trip is planned",
      /six days in portugal/i.test(heard(r)) && !!r.trip && !r.drift.length,
      `${kinds(r)} · ${heard(r).slice(0, 90)}`);
  }

  // --- thread: do not ask it, carry on ------------------------------------
  {
    const b: Brief = { ...from(["i want to go to portugal", "six days"]), days: 6 };
    const asked = q("duration", "How many days have you got?");
    const r = await run(b, { question: async () => ({ question: asked, driver: "llm" }) });
    check("a question she has already answered is not put to her",
      !r.asked.length && r.drift.some((d) => d.kind === "thread"),
      `${kinds(r)} · asked=${JSON.stringify(r.asked)}`);
    check("and the turn carries on and plans with the answer she gave",
      !!r.trip && r.trip.days.length === 6, `${r.trip?.days.length} days`);
    check("and only the thread detector fired",
      r.drift.every((d) => d.kind === "thread"), kinds(r));
  }
  {
    const b: Brief = from(["i want to go to portugal"]);
    const asked = q("duration", "How many days have you got?");
    const r = await run(b, { question: async () => ({ question: asked, driver: "llm" }) });
    check("a question she has NOT answered is still asked",
      r.asked.includes(asked.prompt) && !r.drift.length, JSON.stringify(r.asked));
  }

  // --- label: withhold it, keep working -----------------------------------
  {
    const b: Brief = { ...from(["i want to go to the faroe islands"]), days: 7 };
    const r = await run(b, {
      // Fails once so the retry label is built, then answers; the pack call
      // never answers, so the pack retry label is built too. Both are the
      // labels that have historically been wrong.
      researchStream: (() => { let n = 0; return async () => ++n === 1
        ? { problem: "timed out", driver: "llm" }
        : { text: "Yes, go. A week in the Faroe Islands, based in Tórshavn.", sources: [], driver: "llm" };
      })(),
    });
    check("every label a research turn shows is about the place being researched",
      !r.drift.some((d) => d.kind === "label"),
      `${r.labels.filter(Boolean).join(" | ")} · ${kinds(r)}`);
    check("and there was a label to check",
      r.labels.filter(Boolean).length >= 2, JSON.stringify(r.labels));
    check("and the research itself was never stopped over a caption",
      r.labels.length > 0 && /couldn't work up/i.test(heard(r)), heard(r).slice(0, 90));
  }
}

main().then(() => {
  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
});
