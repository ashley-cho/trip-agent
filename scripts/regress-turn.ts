/**
 * A turn, actually run.
 *
 * lib/flow.ts is the product: advance() is what happens when she presses
 * enter. Until now no test had ever called it. Six regress scripts read the
 * file with readFileSync and regex-match its source, so they assert that an
 * edit was made, and the eval reimplements the turn rather than calling it. A
 * green suite sat on top of a broken product all day, and every fix I reported
 * without running one of these was a guess.
 *
 * advance() now takes its agent as a parameter, so the model can be a stub and
 * the turn can be executed. What is asserted here is what she READS.
 */
import { advance, type FlowAgent, type FlowIO, type FlowRefs, type Stage } from "@/lib/flow";
import { applyPatch } from "@/lib/brief";
import { interpretRules } from "@/lib/discovery";
import { registerPack } from "@/data/registry";
import { emptyBrief, emptyProfile } from "@/lib/types";
import type { Brief, Trip } from "@/lib/types";
import type { DestinationPack } from "@/lib/research";
import type { Drift } from "@/lib/drift";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

/** Everything the screen was told, plus what the turn asked the model for. */
interface Run {
  said: string[]; asked: string[]; trip: Trip | null; brief: Brief; stage: Stage;
  calls: { name: string; args: unknown[] }[];
  /** Every drift the turn caught, and every label it actually put on screen. */
  drift: Drift[]; labels: (string | null)[];
}

const noPack = { pack: undefined, problem: "nothing came back", driver: "llm" };

function stub(over: Partial<Record<string, any>> = {}, calls: Run["calls"] = []): FlowAgent {
  const rec = (name: string, fn: (...a: any[]) => any) =>
    (...args: any[]) => { calls.push({ name, args }); return fn(...args); };
  return {
    question: rec("question", async () => ({ question: null, driver: "llm" })),
    budget: rec("budget", async () => ({ ok: true })),
    suggest: rec("suggest", async () => ({ place: undefined, problem: "no", driver: "llm" })),
    researchStream: rec("researchStream", async () => ({ problem: "no web", driver: "llm" })),
    researchPack: rec("researchPack", async () => noPack),
    researchPlaces: rec("researchPlaces", async () => ({ places: [] })),
    pitch: rec("pitch", async (r: any) => ({ pitch: { headline: `Go to ${r.destinationId}.`, body: "Because." }, driver: "llm" })),
    stays: rec("stays", async () => ({ stays: [], driver: "llm" })),
    ...over,
  } as unknown as FlowAgent;
}

async function run(b0: Brief, over: Partial<Record<string, any>> = {}): Promise<Run> {
  const calls: Run["calls"] = [];
  const out: Run = { said: [], asked: [], trip: null, brief: b0, stage: "chat", calls,
    drift: [], labels: [] };
  const streams: Record<string, string> = {};
  const io: FlowIO = {
    say: (from, text) => { if (from === "agent") out.said.push(text); },
    ask: (q) => out.asked.push(q.prompt),
    noteDriver: () => {},
    setBrief: (b) => { out.brief = b; },
    setTrip: (t) => { out.trip = typeof t === "function" ? (t as any)(out.trip) : t; },
    setStage: (s) => { out.stage = s; },
    setQuestion: (q) => { if (q) out.asked.push(q.prompt); },
    setResearching: (l) => { out.labels.push(l); },
    noteDrift: (d) => { out.drift.push(d); },
    openStream: () => { const id = `s${Object.keys(streams).length}`; streams[id] = ""; return id; },
    appendTo: (id) => (c) => { streams[id] += c; },
    closeStream: () => {},
    rememberSeen: () => {},
  };
  const refs: FlowRefs = {
    history: { current: [] }, pitched: { current: null }, headline: { current: "" },
    failedResearch: { current: null }, gen: { current: 0 },
  };
  await advance(b0, emptyProfile(), io, refs, stub(over, calls));
  return out;
}

const heard = (r: Run) => r.said.join(" · ");
const from = (msgs: string[]): Brief => {
  let b = emptyBrief(msgs[0]);
  for (const m of msgs) b = applyPatch(b, interpretRules(m, b));
  return b;
};

async function main() {
  console.log("\n  a turn, actually run\n");

  // --- she named nowhere, and what she said is on the shelf ----------------
  {
    /*
     * This used to assert a refusal: "with nothing of hers on the brief it
     * refuses to rank the catalogue". Nature, adventure and a week ARE hers,
     * and every one of them is a field the ranker reads. The catalogue exists
     * so that a brief it can represent costs no tokens and survives no model;
     * lib/shelf.ts says whether it can, and here it can, so the turn plans
     * from the shelf and never asks the model where to go.
     */
    const r = await run({ ...from(["i want a holiday"]), vibes: ["nature", "adventure"] as any, days: 7 });
    const tie = r.asked.find((q) => /I'm between/.test(q));
    check("with only vibes and a length on the brief it answers from the catalogue: a plan, or a tie-break between two of its own",
      (!!r.trip && r.stage === "proposal") || !!tie,
      `trip=${r.trip?.concept.destinationId} stage=${r.stage} asked=${r.asked.join("|").slice(0, 80)}`);
    check("and never asks the model to suggest", !r.calls.some((c) => c.name === "suggest"));
    const nature = ["Costa Rica", "Iceland", "New Zealand", "Patagonia", "Nepal", "Norway", "Highlands", "Utah", "Albania", "Zion", "Faroe"];
    check("and what it offers carries nature and adventure",
      nature.some((n) => (tie ?? "").includes(n)) || nature.some((n) => (r.trip?.concept.headline ?? "").includes(n))
        || ["costarica", "iceland", "newzealand", "patagonia", "nepal", "norway", "highlands", "southwest", "albania"]
          .some((id) => (r.trip?.concept.destinationId ?? "").includes(id)),
      (tie ?? r.trip?.concept.destinationId ?? "").slice(0, 80));
  }

  // --- she named nowhere and said something the catalogue cannot serve ------
  {
    /*
     * "scuba dive coral reefs" is a thing to do that no place we hold matches.
     * The model is asked (it could name somewhere), it fails, and the stop
     * names her words rather than "I couldn't turn that into a place" about
     * a sentence that was read perfectly well.
     */
    const b = { ...from(["i want a holiday"]), activities: ["scuba dive coral reefs"], days: 7 };
    const r = await run(b);
    check("with an activity the catalogue cannot serve it asks the model",
      r.calls.some((c) => c.name === "suggest"));
    check("and when the model cannot answer it stops, naming her words",
      /scuba dive coral reefs/i.test(heard(r)) && !r.trip, heard(r).slice(0, 140));
    check("and does not locate the shortfall in her message",
      !/enough from you|you haven't|you didn't|tell me more about what you/i.test(heard(r)),
      heard(r).slice(0, 140));
    check("and does not pitch anywhere", !r.calls.some((c) => c.name === "pitch"));
  }

  // --- a place she named is the trip ---------------------------------------
  {
    const r = await run({ ...from(["i want to go to portugal"]), days: 7 });
    check("a place she named is planned, not re-decided",
      r.trip?.concept.destinationId === "portugal", String(r.trip?.concept.destinationId));
    check("and the pitch is about that place",
      /portugal/i.test(heard(r)), heard(r).slice(0, 90));
  }

  // --- the Patagonia case: a held place must not drift ---------------------
  {
    registerPack({
      destination: { id: "patagonia", name: "Patagonia", hubCityId: "patagonia-pn", pitch: "Wind.",
        strengths: { nature:5, exploration:3, food:1, relaxation:1, culture:1, adventure:5, city:0 },
        paceFit:["mixed"], flightUsd:1200, floorPerDayUsd:90, minDays:5, warmth:2, arrival:"fly",
        caveat:"Wind.", because:{ adventure:"Long days on foot." } },
      cities:[{ id:"patagonia-pn", name:"Puerto Natales", destinationId:"patagonia", lat:-51.72, lng:-72.48,
        nightlyUsd:120, minNights:2, maxNights:6, base:"Waterfront.", scale:"walkable" }],
      outings: [],
      places: Array.from({ length: 14 }, (_, i) => ({
        id:`pat-${i}`, cityId:"patagonia-pn", name:`Thing ${i}`, kind: i % 4 === 0 ? "meal" : "walk",
        tags:["nature"], neighborhood:"Town", lat:-51.72, lng:-72.48, durationMin:120, costUsd:0,
        slot:"any", reason:"Because." })),
      sources: [],
    } as unknown as DestinationPack);

    const b: Brief = { ...from(["i wanna hike a national park", "hm i wanna go to patagonia"]),
      vibes: ["nature", "adventure"] as any, days: 7 };
    const r = await run(b);
    check("a place she named that we already hold does not drift",
      r.trip?.concept.destinationId === "patagonia",
      `${r.trip?.concept.destinationId} | ${heard(r).slice(0, 80)}`);
    check("and it is settled onto the brief rather than left as an unknown",
      r.brief.namedDestination === "patagonia" && !(r.brief.unknownCandidates ?? []).length,
      JSON.stringify({ named: r.brief.namedDestination, unknown: r.brief.unknownCandidates }));
  }

  // --- research that fails never becomes a different country ---------------
  {
    const r = await run({ ...from(["i want to go to the faroe islands"]), days: 7 });
    check("failed research says so and pitches nowhere else",
      /couldn't work up|not going to send you somewhere else|haven't actually looked/i.test(heard(r))
      && !r.trip, heard(r).slice(0, 110));
  }

  // --- it says what the trip does not cover -------------------------------
  {
    const b: Brief = { ...from(["i wanna go to portugal for surfing"]), days: 6 };
    const r = await run(b);
    check("activities survive the front door", JSON.stringify(b.activities) === JSON.stringify(["surfing"]),
      JSON.stringify(b.activities));
    check("a trip she asked for is still planned", r.trip?.concept.destinationId === "portugal");
    check("and the thing it cannot match is named out loud",
      /surfing — I couldn't match/i.test(heard(r)), heard(r).slice(-160));
    /*
     * The wording is the assertion, not decoration. This branch runs on a word
     * match, and a word match cannot tell whether the Louvre covers "the
     * galleries", so it may report its own failure and may NOT report the
     * trip's. Measured over 150 briefs, the claiming version was false 18
     * times with the contradicting item on screen.
     */
    check("and it does not claim the trip lacks it",
      !/nothing in this trip|doesn't cover|left it out/i.test(heard(r)), heard(r).slice(-160));
  }
  {
    const b: Brief = { ...from(["i wanna go to portugal for the wine"]), days: 6 };
    const r = await run(b);
    check("something the catalogue DOES serve is not flagged",
      !/couldn't match/i.test(heard(r)), heard(r).slice(-120));
  }

  // --- and it tells the truth about WHY something is missing --------------
  {
    const r = await run({ ...from(["i wanna go to iceland for hiking"]), days: 6 });
    check("something the catalogue serves under another word is not called missing",
      !/couldn't match/i.test(heard(r)),
      heard(r).slice(-140));
  }
  {
    /*
     * Copenhagen's jazz club closes at 01:00, so until the opening-hours wrap
     * was fixed it could never be scheduled and this asserted the
     * held-but-unscheduled branch. Now it IS scheduled, which is the better
     * outcome, and the right assertion is that nothing is claimed missing.
     */
    const r = await run({ ...from(["i wanna go to denmark for jazz"]), days: 3 });
    check("a late-night venue is schedulable, so nothing is claimed missing",
      !/couldn't match|didn't fit/.test(heard(r)), heard(r).slice(-140));
  }
  {
    /*
     * This fixture used to reach the held-but-unscheduled branch; once
     * `servesActivity` learned to see inside compound names, the castle tram
     * gets scheduled and nothing is said at all, which is the right outcome.
     * The positive side of that branch is asserted on the Japan fixture below
     * ("I have something for the temples here"). What is asserted here is the
     * pairing: a phrase the catalogue holds is never reported as unmatched.
     */
    const b: Brief = { ...from(["i wanna go to portugal"]), days: 3,
      activities: ["ride the tram to the castle and back"] };
    const r = await run(b);
    check("something the catalogue holds is never reported as unmatched",
      !/couldn't match/i.test(heard(r)), heard(r).slice(-140));
  }

  // --- out of allowance: stop, do not research, do not plan ---------------
  {
    const r = await run({ ...from(["i want to go to the faroe islands"]), days: 7 },
      { budget: async () => ({ ok: false, reason: "visitor", retryAfter: 1800 }) });
    check("with no allowance left it says so and researches nothing",
      /limit for the hour|budget for the whole day/i.test(heard(r))
      && !r.calls.some((c) => c.name === "researchStream"),
      heard(r).slice(0, 90));
    check("and plans nothing rather than planning it worse", !r.trip);
  }

  // --- a length she never gave never reaches the researcher ----------------
  {
    const b = from(["i wanna go abroad to hike"]);
    const r = await run({ ...b, unknownCandidates: ["nepal's khumbu region"] });
    const call = r.calls.find((c) => c.name === "researchStream");
    check("the researcher is told she gave no length, not seven days",
      !!call && call.args[1] === undefined, `days arg = ${JSON.stringify(call?.args[1])}`);
  }

  /*
   * A flaky first call costs a second attempt, not her trip.
   *
   * The pack call retried once; this one, the long call that actually runs
   * the web searches, did not. So the most timeout-prone step was the one
   * step with no second attempt, and she got "I couldn't work up the
   * Deschutes River region properly just now. Say try again" — and saying
   * "try again" worked, which is the tell.
   */
  {
    let n = 0;
    const seen: unknown[][] = [];
    const b = from(["i wanna go abroad to hike"]);
    const r = await run({ ...b, unknownCandidates: ["nepal's khumbu region"], days: 14 }, {
      // Times out once, then answers. Nothing about the request changed.
      researchStream: async (...a: unknown[]) => (seen.push(a), ++n === 1
        ? { problem: "Researching it took longer than this deployment allows.", driver: "llm" }
        : { text: "A verdict.\n\nNotes about the Khumbu.", sources: [], driver: "llm" }),
    });
    check("a research call that times out once is retried, not surrendered",
      n === 2, `${n} call(s)`);
    /*
     * The pack stub here still returns nothing, so this run gives up anyway
     * and the give-up sentence is correct. What is asserted is the retry
     * itself; the sentence is asserted on the two-failure case below, where
     * it is the right thing to say.
     */
    // The retry asks for the same thing. A "retry" that quietly narrows the
    // request is a different answer wearing the same word.
    check("and the retry asks for the same place and the same length",
      seen.length === 2 && seen[0][0] === seen[1][0] && seen[0][1] === seen[1][1],
      JSON.stringify(seen.map((a) => [a[0], a[1]])));
  }
  {
    /*
     * It keeps going without being asked, and it stops without being told.
     *
     * One retry was not enough in the real world: a ten-day Italian Coast
     * burned both attempts and the traveller was handed "Say 'try again' and
     * I'll have another go" — the app asking her to press the button it could
     * press itself. It makes three attempts now.
     *
     * Three, not forever: this runs on her API bill, and a place that is
     * never coming back must not be retried into the ground.
     */
    let n = 0;
    const b = from(["i wanna go abroad to hike"]);
    const r = await run({ ...b, unknownCandidates: ["nepal's khumbu region"], days: 14 }, {
      researchStream: async () => { n++; return { problem: "timed out", driver: "llm" }; },
    });
    check("it tries three times before it says anything",
      n === 3, `${n} call(s)`);
    check("and then stops, rather than looping on her bill",
      /tried 3 times/i.test(heard(r)), heard(r).slice(0, 120));
    /*
     * And the sentence does not ask her to do what the app just did. Offering
     * "say try again" after three attempts would be a lie about what happened
     * as well as a waste of her time.
     */
    check("and never asks her to say \"try again\"",
      !/say "?try again"?/i.test(heard(r)), heard(r).slice(0, 160));
    // What IS left is the two things only she can settle.
    check("but still offers the two calls that are hers",
      /shorter trip|tell me a length/i.test(heard(r)) && /somewhere else/i.test(heard(r)),
      heard(r).slice(0, 200));
  }
  {
    // And a call that lands on the third attempt is not surrendered on the
    // second. The bound is a ceiling, not a target.
    let n = 0;
    const b = from(["i wanna go abroad to hike"]);
    const r = await run({ ...b, unknownCandidates: ["nepal's khumbu region"], days: 14 }, {
      researchStream: async () => (++n < 3
        ? { problem: "timed out", driver: "llm" }
        : { text: "A verdict.\n\nNotes about the Khumbu.", sources: [], driver: "llm" }),
    });
    /*
     * The pack stub in this harness returns nothing, so this run still ends
     * without a trip and the give-up sentence is still correct. What is
     * asserted here is only that the STREAM was not abandoned at two: the
     * bound is a ceiling, not a target.
     */
    check("a call that lands on the third attempt is not given up on the second",
      n === 3, `${n} call(s)`);
  }

  /*
   * A pack that comes back THIN is not retried, and the sentence says so.
   *
   * This is the failure that started it: a ten-day Italian Coast, research
   * succeeding both times, nine usable places against a bar of ten. It is
   * deterministic — the same request returns the same pack — so a retry loop
   * around it is a charge on her API bill with a guaranteed outcome, and
   * "say try again" is an instruction that could never have worked. I
   * diagnosed it as a timeout twice, because the branch that rejects a thin
   * pack logged nothing at all.
   */
  {
    let streams = 0;
    const b = from(["i wanna go abroad to hike"]);
    const thinPack = {
      pack: {
        destination: { id: "italiancoast", name: "The Italian Coast", minDays: 4, strengths: {}, because: {} },
        cities: [{ id: "amalfi", name: "Amalfi", lat: 40.63, lng: 14.6 }],
        // Nine usable, which is one short of what ten days needs.
        places: Array.from({ length: 9 }, (_, i) => ({
          id: `p${i}`, cityId: "amalfi", name: `Place ${i}`, kind: "sight",
          tags: ["nature"], lat: 40.63, lng: 14.6, costUsd: 0, durationMin: 90, touristy: 3,
        })),
      },
      driver: "llm",
    };
    const r = await run({ ...b, unknownCandidates: ["the italian coast"], days: 10 }, {
      researchStream: async () => { streams++; return { text: "A verdict.\n\nNotes.", sources: [], driver: "llm" }; },
      researchPack: async () => thinPack,
      researchPlaces: async () => ({ places: [] }),
    });
    check("a thin pack is not retried, because the answer will not change",
      streams === 1, `${streams} research call(s)`);
    check("and she is told what it DID find, in days she can act on",
      /only enough of it to fill about \d+ days/i.test(heard(r)), heard(r).slice(0, 200));
    check("and is not told to say \"try again\" at something deterministic",
      !/try again/i.test(heard(r)) && !/tried 3 times/i.test(heard(r)), heard(r).slice(0, 200));
    check("and no trip is built from a pack that cannot carry it",
      !r.trip, String(!!r.trip));
  }

  // --- and a stated length is passed through as stated ---------------------
  {
    const b = from(["i wanna go abroad to hike"]);
    const r = await run({ ...b, unknownCandidates: ["nepal's khumbu region"], days: 14 });
    const call = r.calls.find((c) => c.name === "researchStream");
    check("a length she DID give is passed through", call?.args[1] === 14, `days arg = ${JSON.stringify(call?.args[1])}`);
  }

  console.log("\n\x1b[1mA PHRASE IT CANNOT PLACE IS ASKED ABOUT, NOT ASSERTED\x1b[0m\n");
  {
    /*
     * "i want to go to chile for patagonia" filed patagonia as an activity and
     * the turn announced "One thing this doesn't cover: patagonia" about a trip
     * to Patagonia's own country.
     *
     * The first fix dropped the phrase in the parser, which cost the ranking,
     * the pitch echo, the "You said" line and the research prompt. The phrase
     * stays now; only the SENTENCE is gated, and the gap is raised as a question
     * rather than as silence — silence about a real gap is its own dishonesty.
     */
    const withActivity = (a: string) => ({
      ...from(["i want to go to portugal"]), days: 7,
      activities: [a],
    }) as Brief;

    const unplaceable = await run(withActivity("patagonia"));
    check("a word it can't place is reported as its own failure to match",
      /patagonia — I couldn't match/i.test(heard(unplaceable)), heard(unplaceable).slice(0, 200));
    check("and it is not asserted as a gap in the trip",
      !/nothing in this trip|doesn't cover|left it out/i.test(heard(unplaceable)),
      heard(unplaceable).slice(0, 150));
    check("and she is not asked to classify her own word",
      !/somewhere you want to go, or something you want to do/i.test(heard(unplaceable)),
      heard(unplaceable).slice(0, 200));
    check("and the phrase is still on the brief",
      (unplaceable.brief.activities ?? []).includes("patagonia"),
      JSON.stringify(unplaceable.brief.activities ?? []));

    // A real activity this catalogue lacks is still asserted, in her words.
    const missing = await run(withActivity("bungee jumping"));
    check("a thing to do that the trip can't match is still said plainly",
      /bungee jumping — I couldn't match/i.test(heard(missing)), heard(missing).slice(0, 150));

  /*
   * The two branches for a phrase the catalogue DOES hold. "the shrines" is an
   * unsure phrase — no gerund, no tag word, no leading verb — and Japan holds
   * shrines, so neither the assertion nor the question may fire about it.
   * Both branches were untested, and both shipped a false sentence because of
   * it: one version asked "the shrines — I couldn't place that" about a plan
   * with shrines in it, and another offered "I have something for patagonia
   * here, but it didn't fit" for a thing we hold nothing for.
   *
   * The phrase was "the temples" and had to move. Kyoto held four temples and
   * a nine-day plan scheduled none of them, so the offer fired; Kyoto now
   * holds eight and the plan schedules one, so the phrase is SERVED and the
   * offer correctly goes quiet. That is the product getting better, not this
   * branch getting weaker. Then it moved again: "the shrines" went quiet when
   * the return-leg rule stopped cutting Kyoto to a single night and the
   * second Kyoto day scheduled a shrine. "kaiseki" is the same shape of
   * phrase against the same catalogue: one place holds it, in Kyoto, and a
   * nine-day plan leaves it on the shelf. Only the fixture moved. If this
   * ever goes green for the wrong reason, it will be because kaiseki got
   * scheduled, and the fix is another phrase, not a weaker assertion.
   */
  {
    const japan = (days: number) =>
      ({ ...from(["i want to go to japan"]), days, activities: ["kaiseki"] }) as Brief;

    const roomy = await run(japan(9));
    check("nothing is questioned that the trip actually covers",
      !/couldn't match/i.test(heard(roomy)), heard(roomy).slice(0, 170));

    // The offer itself, for an unsure phrase. This is the branch that may not
    // be filtered by confidence: it offers to make room for something the
    // catalogue HAS, so it never asserts a gap and is safe for any phrase.
    check("and it is offered, in her words, even though we can't vouch for the phrase",
      /I have something for kaiseki here/i.test(heard(roomy)), heard(roomy).slice(0, 170));
  }

  /*
   * And the offer is never made about something we do NOT hold. An earlier
   * partition computed `notToday` by subtracting `nowhere`, so once `nowhere`
   * was filtered by confidence an unsure phrase we hold nothing for leaked
   * into the offer: "I have something for patagonia here, but it didn't fit".
   */
  check("no offer to make room for something we do not have",
    !/I have something for patagonia/i.test(heard(unplaceable)), heard(unplaceable).slice(0, 170));
  }
}

main().then(() => {
console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);

});
