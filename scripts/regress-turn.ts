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

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

/** Everything the screen was told, plus what the turn asked the model for. */
interface Run {
  said: string[]; asked: string[]; trip: Trip | null; brief: Brief; stage: Stage;
  calls: { name: string; args: unknown[] }[];
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
  const out: Run = { said: [], asked: [], trip: null, brief: b0, stage: "chat", calls };
  const streams: Record<string, string> = {};
  const io: FlowIO = {
    say: (from, text) => { if (from === "agent") out.said.push(text); },
    ask: (q) => out.asked.push(q.prompt),
    noteDriver: () => {},
    setBrief: (b) => { out.brief = b; },
    setTrip: (t) => { out.trip = typeof t === "function" ? (t as any)(out.trip) : t; },
    setStage: (s) => { out.stage = s; },
    setQuestion: (q) => { if (q) out.asked.push(q.prompt); },
    setResearching: () => {},
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

  // --- she named nowhere and the model could not pick ----------------------
  {
    const r = await run({ ...from(["i want a holiday"]), vibes: ["nature", "adventure"] as any, days: 7 });
    check("with nothing of hers on the brief it refuses to rank the catalogue",
      /don't have enough from you yet|rather say that than guess/i.test(heard(r)) && !r.trip,
      heard(r).slice(0, 120));
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
   * The two branches for a phrase the catalogue DOES hold. "the temples" is an
   * unsure phrase — no gerund, no tag word, no leading verb — and Kyoto holds
   * temples, so neither the assertion nor the question may fire about it.
   * Both branches were untested, and both shipped a false sentence because of
   * it: one version asked "the temples — I couldn't place that" about a plan
   * with temples in it, and another offered "I have something for patagonia
   * here, but it didn't fit" for a thing we hold nothing for.
   */
  {
    const japan = (days: number) =>
      ({ ...from(["i want to go to japan"]), days, activities: ["the temples"] }) as Brief;

    const roomy = await run(japan(9));
    check("nothing is questioned that the trip actually covers",
      !/couldn't match/i.test(heard(roomy)), heard(roomy).slice(0, 170));

    // The offer itself, for an unsure phrase. This is the branch that may not
    // be filtered by confidence: it offers to make room for something the
    // catalogue HAS, so it never asserts a gap and is safe for any phrase.
    check("and it is offered, in her words, even though we can't vouch for the phrase",
      /I have something for the temples here/i.test(heard(roomy)), heard(roomy).slice(0, 170));
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
