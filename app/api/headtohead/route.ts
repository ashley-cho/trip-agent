/**
 * One head-to-head run, triggered from a browser on the machine running the
 * dev server.
 *
 * This exists because the eval it belongs to cannot run anywhere else: the
 * comparison needs real model calls with web search, and the only machine
 * with the key is the one the dev server is on. It is a development tool
 * wearing a route, so it refuses to exist anywhere but localhost, and in
 * production `isLocalDev` returns false before anything else happens.
 *
 * A run takes minutes: the model side researches, the chat side searches, and
 * then a third call grades them. A browser tab will not hold a request open
 * that long, so the route starts the work, returns immediately, and writes the
 * result to evals/h2h/<scenario>.json when it lands. Poll the file.
 *
 * GET /api/headtohead?scenario=named-destination
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isLocalDev } from "@/lib/guard";
import { SCENARIOS } from "@/evals/scenarios";
import { runScenario } from "@/evals/scenario-run";
import { chatSide, judge, tripAsProse, traveller } from "@/evals/headtohead";
import { createLlmDriver, anthropicTransport } from "@/lib/agent/llm";

export const maxDuration = 800;

export async function GET(req: Request) {
  if (!isLocalDev(req)) return new NextResponse("Not found", { status: 404 });
  // Next already loads .env.local into the dev server's environment.
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "no ANTHROPIC_API_KEY" }, { status: 500 });

  const params = new URL(req.url).searchParams;

  /*
   * Is web search actually reaching the model?
   *
   * Three head-to-head runs came back with zero searches, which reads as
   * "the chat chose not to look anything up" and could equally be "the tool
   * never arrived". One question nobody can answer from training data tells
   * you which.
   */
  if (params.get("probe") === "search") {
    const probe = new Anthropic({ apiKey: key });
    const res = await probe.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929",
      max_tokens: 600,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 } as never],
      messages: [{ role: "user", content: "What is the top story on the BBC News homepage right now? Look it up." }],
    });
    const searches = Number((res.usage as unknown as Record<string, Record<string, number>>)
      ?.server_tool_use?.web_search_requests ?? 0);
    return NextResponse.json({
      searches,
      kinds: (res.content as unknown as Record<string, unknown>[]).map((c) => c.type),
      text: (res.content as unknown as Record<string, unknown>[])
        .filter((c) => c.type === "text").map((c) => String(c.text ?? "")).join(" ").slice(0, 400),
    });
  }

  const id = params.get("scenario") ?? SCENARIOS[0].id;
  const sc = SCENARIOS.find((s) => s.id === id);
  if (!sc) return NextResponse.json({ error: `no scenario ${id}` }, { status: 400 });

  const out = join(process.cwd(), "evals", "h2h");
  mkdirSync(out, { recursive: true });
  const file = join(out, `${sc.id}.json`);
  writeFileSync(file, JSON.stringify({ scenario: sc.id, status: "running", at: new Date().toISOString() }, null, 2));

  const client = new Anthropic({ apiKey: key });
  const driver = createLlmDriver(anthropicTransport(key));

  void (async () => {
   try {
    const ours = await runScenario(driver, sc, (asked) => traveller(client, sc, asked));
    /*
     * A scenario the app declines to plan has no itinerary to put in front of
     * a judge, and a head-to-head with one empty side is not a comparison.
     * Say which scenario and stop; every guard in lib/flow.ts that can end a
     * turn without a trip lands here.
     */
    if (!ours.trip) throw new Error(`${sc.id}: the agent ended without a plan, so there is nothing to judge`);
    const days = ours.trip.days.length;
    const chat = await chatSide(client, sc, days);

    const mine = tripAsProse(ours.trip, ours.headline, ours.why);
  /*
   * Which side is A is decided by a coin, and the judge is never told. An
   * A/B grader that always sees the product in the same slot is grading the
   * slot.
   */
    const meFirst = Math.random() < 0.5;
    const brief = [sc.opening, ...sc.answers].join("\n");
    const verdict = await judge(client, brief, meFirst ? mine : chat.final, meFirst ? chat.final : mine);

    const flip = (w: string) => (meFirst ? w : w === "A" ? "B" : w === "B" ? "A" : w);
    const side = (w: string) => (flip(w) === "A" ? "vamos" : flip(w) === "B" ? "chat" : "tie");

    writeFileSync(file, JSON.stringify({
    scenario: sc.id,
    opening: sc.opening,
    turns: { vamos: ours.turns, chat: chat.turns, chatReachedAPlan: chat.reachedPlan },
    searches: { chat: chat.searches },
    destination: ours.destination,
    evalScore: Number(ours.mean.toFixed(3)),
    verdict: verdict && {
      overall: side(verdict.winner),
      axes: Object.fromEntries(Object.entries(verdict.axes).map(
        ([k, v]) => [k, { winner: side(v.winner), why: v.why }])),
      note: verdict.note,
    },
    plans: { vamos: mine, chat: chat.final },
    }, null, 2));
   } catch (e) {
    writeFileSync(file, JSON.stringify({
      scenario: sc.id, status: "failed", error: String(e instanceof Error ? e.message : e),
    }, null, 2));
   }
  })();

  return NextResponse.json({ started: sc.id, file: `evals/h2h/${sc.id}.json` });
}
