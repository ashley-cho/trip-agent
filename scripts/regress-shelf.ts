/**
 * The catalogue answers what it can, and says what it cannot.
 *
 * Run through advance() with no model behind it: `question` and `pitch`
 * throw NoModel the way lib/client.ts does when the account is out of
 * credit, `suggest` comes back with a problem the way the server does, and
 * the floor writes the pitch. What is asserted is what she reads.
 *
 * The bug this guards: "somewhere warm with good food, a week, not too
 * touristy" parsed to warmth, food, a crowd band and seven days, all of which
 * the ranker reads and the catalogue carries, and the turn was refused with
 * "I couldn't turn that into a place I can plan". The catalogue had been
 * enriched to answer exactly that brief without spending a token.
 */
import { advance, type FlowAgent, type FlowIO, type FlowRefs, type Stage } from "@/lib/flow";
import { applyPatch } from "@/lib/brief";
import { interpretRules } from "@/lib/discovery";
import { emptyBrief, emptyProfile } from "@/lib/types";
import type { Brief, Trip } from "@/lib/types";
import { NoModel } from "@/lib/client";
import { rulesDriver } from "@/lib/agent/rules";
import { destinationById } from "@/data/destinations";
import { scoreDestinations } from "@/lib/recommend";
import { shelf } from "@/lib/shelf";
import { editOrphans, parseEditRules } from "@/lib/edit";
import { planTrip } from "@/lib/planner";
import { recommend } from "@/lib/recommend";
import { offlineInterpret } from "@/lib/offline";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

interface Run { said: string[]; asked: string[]; trip: Trip | null; brief: Brief; stage: Stage; calls: string[] }

const dead = (): never => {
  throw new NoModel('400 {"type":"invalid_request_error","message":"Your credit balance is too low"}');
};

function stub(calls: string[]): FlowAgent {
  const rec = (name: string, fn: (...a: any[]) => any) => (...args: any[]) => { calls.push(name); return fn(...args); };
  return {
    question: rec("question", async () => dead()),
    budget: rec("budget", async () => ({ ok: true })),
    suggest: rec("suggest", async () => ({ problem: 'the model call failed: 400 "Your credit balance is too low"', driver: "fallback" })),
    researchStream: rec("researchStream", async () => ({ problem: "no model", driver: "fallback" })),
    researchPack: rec("researchPack", async () => ({ pack: undefined, problem: "no model", driver: "fallback" })),
    researchPlaces: rec("researchPlaces", async () => ({ places: [] })),
    pitch: rec("pitch", async () => dead()),
    pitchFloor: rec("pitchFloor", async (r: any, b: Brief) => ({ pitch: await rulesDriver.pitch(r, b), driver: "rules" })),
    stays: rec("stays", async () => ({ stays: [], driver: "rules" })),
  } as unknown as FlowAgent;
}

async function run(b0: Brief): Promise<Run> {
  const calls: string[] = [];
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
    noteDrift: () => {},
    openStream: () => { const id = `s${Object.keys(streams).length}`; streams[id] = ""; return id; },
    appendTo: (id) => (c) => { streams[id] += c; },
    closeStream: () => {},
    rememberSeen: () => {},
  };
  const refs: FlowRefs = {
    history: { current: [] }, pitched: { current: null }, headline: { current: "" },
    failedResearch: { current: null }, gen: { current: 0 },
  };
  await advance(b0, emptyProfile(), io, refs, stub(calls));
  return out;
}

const from = (msgs: string[]): Brief => {
  let b = emptyBrief(msgs[0]);
  for (const m of msgs) b = applyPatch(b, interpretRules(m, b));
  return b;
};
const heard = (r: Run) => r.said.join(" · ");

async function main() {
  console.log("\n  the shelf: the catalogue answers what it can\n");

  // --- warm, food, a week, not too touristy: all on the shelf --------------
  {
    const b = from(["somewhere warm with good food, a week, not too touristy"]);
    check("the parser read all four things", b.wantsWarm === true && b.vibes.includes("food")
      && b.days === 7 && b.crowds?.max !== undefined, JSON.stringify(b));
    const r = await run(b);
    const tie = r.asked.find((q) => /Which direction sounds more like you/.test(q));
    check("with no model it still answers from the catalogue",
      (!!r.trip && r.stage === "proposal") || !!tie,
      `stage=${r.stage} said=${heard(r).slice(0, 160)}`);
    check("and never asks the model where to go", !r.calls.includes("suggest"), r.calls.join(","));
    check("and never says it couldn't turn that into a place", !/couldn't turn that into a place/i.test(heard(r)));
    const id = r.trip?.concept.destinationId ?? shelf(b).rec?.destinationId;
    const d = id ? destinationById(id) : undefined;
    check("and the pick is warm", !!d && d.warmth >= 4, `${id} warmth=${d?.warmth}`);
    check("and the pick is somewhere for food", !!d && d.strengths.food >= 3, `${id} food=${d?.strengths.food}`);
  }

  // --- the same brief with credit: no token spent on `suggest` -------------
  {
    const b = from(["somewhere warm with good food, a week, not too touristy"]);
    const offer = shelf(b);
    check("with a model available the shelf still answers first", !!offer.rec && !offer.weak && !offer.cannot.length,
      JSON.stringify({ weak: offer.weak, cannot: offer.cannot }));
  }

  // --- what she wants to DO changes the ranking ----------------------------
  {
    const top = (b: Brief) => scoreDestinations(b).filter((s) => !s.excluded).slice(0, 3).map((s) => s.id).join(">");
    const empty = { ...emptyBrief("a week"), days: 7 };
    const hike = { ...empty, activities: ["hike a national park"] };
    const springs = { ...empty, activities: ["spend time in hot springs"] };
    const museums = { ...empty, activities: ["design museums"] };
    check("an empty brief, a hike, hot springs and museums do not all rank the same",
      new Set([top(empty), top(hike), top(springs), top(museums)]).size >= 3,
      `empty=${top(empty)} hike=${top(hike)} springs=${top(springs)} museums=${top(museums)}`);
    check("the top pick for hot springs holds hot springs",
      scoreDestinations(springs).filter((s) => !s.excluded)[0] !== undefined
        && !shelf(springs).weak && !shelf(springs).cannot.length,
      JSON.stringify(shelf(springs)).slice(0, 120));
  }

  // --- what the catalogue cannot serve is named, not hidden ----------------
  {
    const b = { ...emptyBrief("a week"), days: 7, activities: ["scuba dive coral reefs"] };
    const offer = shelf(b);
    check("scuba is outside the catalogue, and the shelf says so", offer.cannot.includes("scuba dive coral reefs") && !offer.rec,
      JSON.stringify(offer));
    const r = await run(b);
    check("so with no model the turn asks the model, fails, and stops naming her words",
      r.calls.includes("suggest") && !r.trip && /scuba dive coral reefs/i.test(heard(r)), heard(r).slice(0, 160));
  }

  // --- a crowd band moves the ranking -------------------------------------
  {
    const base = { ...emptyBrief("a week in a city"), days: 7, vibes: ["city", "food"] as any };
    const quiet = { ...base, crowds: { max: 2 } };
    const a = scoreDestinations(base).filter((s) => !s.excluded).slice(0, 5).map((s) => s.id);
    const q = scoreDestinations(quiet).filter((s) => !s.excluded).slice(0, 5).map((s) => s.id);
    check("asking for somewhere quieter changes the order", a.join() !== q.join(), `${a.join(">")} vs ${q.join(">")}`);
  }

  // --- edits with no model: every word must land ---------------------------
  {
    const b = { ...from(["i want to go to portugal for a week"]) };
    const trip = planTrip(b, recommend(b), emptyProfile());
    for (const [text, lands] of [
      ["slow it down", true],
      ["make it cheaper", true],
      ["this is too busy", true],
      ["add a free afternoon on day 2", true],
      ["skip dubrovnik, add plitvice instead and make it 9 days", false],
      ["can you book the flights", false],
    ] as [string, boolean][]) {
      const orphan = editOrphans(text, trip);
      const ops = parseEditRules(text, trip).filter((o) => o.kind !== "unknown");
      check(`"${text}" ${lands ? "lands every word and is applied" : "drops a word and stops"}`,
        lands ? orphan.length === 0 && ops.length > 0 : orphan.length > 0,
        `orphans=${orphan.join(",")} ops=${ops.map((o) => o.kind).join(",")}`);
    }
  }

  // --- typed at the proposal, an edit gets past the interpret gate ----------
  {
    /*
     * app/page.tsx runs `interpret` on anything typed at a plan and only then
     * hands it to the editor. "make it cheaper" has no reading in the brief
     * parser, so the offline gate stopped it one step before the parser
     * that understands it. With the trip on screen passed along, the gate
     * lets a message the editor reads whole carry on. Driven through
     * lib/offline.ts, which is what both the client and the harness call.
     */
    const b = from(["i want to go to portugal for a week"]);
    const trip = planTrip(b, recommend(b), emptyProfile());
    const without = offlineInterpret("make it cheaper", b, undefined, "words");
    const withTrip = offlineInterpret("make it cheaper", b, trip, "words");
    check("with no trip on screen, \"make it cheaper\" is refused as words that land nowhere",
      "refused" in without && without.refused.includes("cheaper"), JSON.stringify(without));
    check("with the trip on screen it carries on, because the editor reads it whole",
      "patch" in withTrip && withTrip.how === "edit", JSON.stringify(withTrip));
    check("and the narrow gate still refuses it",
      "refused" in offlineInterpret("make it cheaper", b, trip, "name"));
  }

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall passing\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
