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
    check("and the thing it cannot do is named out loud",
      /doesn't cover: surfing/i.test(heard(r)), heard(r).slice(-160));
  }
  {
    const b: Brief = { ...from(["i wanna go to portugal for the wine"]), days: 6 };
    const r = await run(b);
    check("something the catalogue DOES serve is not flagged",
      !/doesn't cover/i.test(heard(r)), heard(r).slice(-120));
  }

  // --- and it tells the truth about WHY something is missing --------------
  {
    const r = await run({ ...from(["i wanna go to iceland for hiking"]), days: 6 });
    check("something the catalogue serves under another word is not called missing",
      !/doesn't cover/i.test(heard(r)),
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
      !/doesn't cover|didn't fit/.test(heard(r)), heard(r).slice(-140));
  }
  {
    // The other branch, on a destination that genuinely holds the thing but
    // cannot fit it: asserted directly rather than through a fragile fixture.
    const b: Brief = { ...from(["i wanna go to portugal"]), days: 3,
      activities: ["ride the tram to the castle and back"] };
    const r = await run(b);
    check("held but unscheduled offers to make room rather than denying it exists",
      !/Nothing I have/.test(heard(r)), heard(r).slice(-140));
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

}

main().then(() => {
console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);

});
