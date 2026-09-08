import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { emptyBrief, emptyProfile } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const fake = (reply: unknown, throws = false): Transport => ({
  async call() { if (throws) throw new Error("network"); return reply as Record<string, unknown> | null; },
});

const brief = emptyBrief("surprise me");
brief.days = 7; brief.vibes = ["exploration", "relaxation", "food"]; brief.budgetUsd = 2000;
const trip = planTrip(brief, recommend(brief), emptyProfile(), { startDate: "2026-10-10" });

(async () => {
  console.log("interpret");
  {
    const d = createLlmDriver(fake({ days: 10, vibes: ["nature", "food"], budget_usd: 3000 }));
    const p = await d.interpret("ten days, nature and food, three grand", emptyBrief());
    check("accepts a valid patch", p.days === 10 && p.budgetUsd === 3000 && p.vibes?.includes("nature") === true, JSON.stringify(p));
  }
  {
    const d = createLlmDriver(fake({ days: 999, vibes: ["teleportation"], budget_usd: -5 }));
    const p = await d.interpret("hello", emptyBrief());
    check("drops out-of-range and unknown values", p.days === undefined && p.budgetUsd === undefined && p.vibes === undefined, JSON.stringify(p));
  }
  {
    const d = createLlmDriver(fake(null, true));
    const p = await d.interpret("about a week", emptyBrief());
    check("falls back to rules when the transport throws", p.days === 7, JSON.stringify(p));
  }

  console.log("nextQuestion");
  {
    const d = createLlmDriver(fake({ prompt: "How long can you actually get away for?" }));
    const q = await d.nextQuestion(emptyBrief());
    check("uses model wording", q?.prompt === "How long can you actually get away for?");
    check("keeps the structured options", (q?.options?.length ?? 0) === 4);
  }
  {
    const d = createLlmDriver(fake({ prompt: "Ready to immerse yourself in a vibrant hidden gem?" }));
    const q = await d.nextQuestion(emptyBrief());
    check("rejects slop wording and keeps the written question", q?.prompt === "How long can you disappear for?", q?.prompt);
  }
  {
    const d = createLlmDriver(fake({ prompt: "anything" }));
    const full = { ...brief };
    check("never asks once the brief is sufficient", (await d.nextQuestion(full)) === null);
  }

  console.log("pitch");
  {
    const d = createLlmDriver(fake({ headline: "I think you should go to Portugal.", body: "You have a week and you asked for rest as much as exploring." }));
    const r = await d.pitch(recommend(brief), brief);
    check("uses a clean pitch", r.headline.includes("Portugal") && r.body.length > 20);
  }
  {
    const d = createLlmDriver(fake({ headline: "A bustling hidden gem!", body: "Nestled in the charming hills." }));
    const r = await d.pitch(recommend(brief), brief);
    check("rejects slop and falls back", !/hidden gem|nestled/i.test(r.headline + r.body), r.headline + " / " + r.body);
  }

  console.log("parseEdit");
  {
    const d = createLlmDriver(fake({ operations: [{ kind: "more_tag", tag: "wine", count: 2 }] }));
    const ops = await d.parseEdit("a bit more wine would be good", trip);
    check("accepts a valid op", ops.length === 1 && ops[0].kind === "more_tag");
  }
  {
    const d = createLlmDriver(fake({ operations: [{ kind: "drop_database" }, { kind: "more_tag", tag: "unicorns" }] }));
    const ops = await d.parseEdit("nonsense", trip);
    check("drops invalid kinds and tags, then falls back", ops.every(o => (o.kind as string) !== "drop_database"), JSON.stringify(ops));
  }
  {
    const d = createLlmDriver(fake({ operations: [{ kind: "extend_stay", city_id: "atlantis", nights: 1 }] }));
    const ops = await d.parseEdit("one more night in atlantis", trip);
    check("rejects a city not in this trip", !ops.some(o => o.kind === "extend_stay"), JSON.stringify(ops));
  }
  {
    const d = createLlmDriver(fake({ operations: [{ kind: "set_budget", usd: 1500 }] }));
    const ops = await d.parseEdit("keep it under $1500", trip);
    check("accepts a budget change", ops.some(o => o.kind === "set_budget" && o.usd === 1500));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
