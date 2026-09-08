import { loadEnvLocal } from "@/lib/env";
loadEnvLocal();

import Anthropic from "@anthropic-ai/sdk";
import { anthropicTransport, createLlmDriver } from "@/lib/agent/llm";
import { emptyBrief, emptyProfile } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";

// Candidates tried in order if the configured model is rejected. The default
// may be stale; this turns "404 model not found" into a working suggestion.
const FALLBACKS = [
  "claude-sonnet-5", "claude-sonnet-4-5", "claude-haiku-4-5",
  "claude-opus-4-1", "claude-3-7-sonnet-latest", "claude-3-5-sonnet-latest",
];

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m: string) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const note = (m: string) => console.log(`     ${m}`);

(async () => {
  console.log("\n  TRIP AGENT — LLM PREFLIGHT\n  " + "─".repeat(58));

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    bad("No ANTHROPIC_API_KEY found.");
    note("Create one at https://console.anthropic.com/settings/keys, then:");
    note("");
    note("    echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local");
    note("    npm run doctor");
    note("");
    note("Until then the app runs on the deterministic rules driver, which");
    note("works but does no language understanding.");
    process.exit(1);
  }
  ok(`Key found (${key.slice(0, 7)}…${key.slice(-4)})`);

  // 1. Auth and model.
  const client = new Anthropic({ apiKey: key });
  const configured = process.env.TRIP_AGENT_MODEL ?? "claude-sonnet-5";
  let model: string | null = null;
  for (const candidate of [configured, ...FALLBACKS.filter((m) => m !== configured)]) {
    try {
      const t0 = Date.now();
      await client.messages.create({
        model: candidate, max_tokens: 8,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
      });
      model = candidate;
      ok(`Model "${candidate}" responded in ${Date.now() - t0}ms`);
      if (candidate !== configured) {
        note(`"${configured}" was rejected. Add this to .env.local:`);
        note(`    TRIP_AGENT_MODEL=${candidate}`);
      }
      break;
    } catch (e) {
      const msg = (e as Error).message;
      if (/authentication|invalid x-api-key|401/i.test(msg)) {
        bad("Key rejected by the API.");
        note(msg.split("\n")[0]);
        note("Check the key is active and belongs to a workspace with credit.");
        process.exit(1);
      }
      if (/credit|billing|quota|429/i.test(msg)) {
        bad("Key is valid but the request was refused.");
        note(msg.split("\n")[0]);
        process.exit(1);
      }
      if (candidate === configured) note(`"${candidate}" rejected, trying alternatives…`);
    }
  }
  if (!model) {
    bad("No model id worked. Tried: " + [configured, ...FALLBACKS].join(", "));
    note("Check https://docs.claude.com/en/docs/about-claude/models for current ids.");
    process.exit(1);
  }
  process.env.TRIP_AGENT_MODEL = model;

  // 2. Every driver method, once, against the live API.
  //
  // `interpret` merges the model's patch over the rules result, so a total API
  // failure produces a plausible-looking answer built entirely from regexes.
  // Checking the output is not enough; the fallback counter is the only honest
  // signal, so every step is judged on whether the model actually answered.
  const stats = { attempts: 0, fallbacks: 0 } as { attempts: number; fallbacks: number; lastError?: string };
  const driver = createLlmDriver(anthropicTransport(key), stats);
  let failures = 0;
  const step = async (name: string, fn: () => Promise<string | null>) => {
    const before = stats.fallbacks;
    try {
      const detail = await fn();
      if (stats.fallbacks > before) {
        bad(`${name} — the model did not answer; this came from the rules driver`);
        if (stats.lastError) note(stats.lastError);
        failures++;
      } else if (detail === null) {
        bad(`${name} — model answered but the result failed validation`);
        failures++;
      } else ok(`${name} — ${detail}`);
    } catch (e) {
      bad(`${name} — threw: ${(e as Error).message.split("\n")[0]}`);
      failures++;
    }
  };

  const base = emptyBrief("I need a vacation. Surprise me.");

  await step("interpret", async () => {
    const p = await driver.interpret("about ten days, somewhere with real food, maybe $3,000", base);
    return p.days === 10 && p.budgetUsd ? `days=${p.days} budget=$${p.budgetUsd} vibes=${(p.vibes ?? []).join(",")}` : null;
  });

  await step("nextQuestion", async () => {
    const q = await driver.nextQuestion(base);
    return q ? `asked "${q.prompt.slice(0, 60)}…"` : null;
  });

  const full = { ...base, days: 7, vibes: ["exploration", "food"] as never, budgetUsd: 2500 };
  await step("pitch", async () => {
    const p = await driver.pitch(recommend(full), full);
    return p.headline ? `"${p.headline.slice(0, 60)}"` : null;
  });

  await step("parseEdit", async () => {
    const trip = planTrip(full, recommend(full), emptyProfile(), { startDate: "2026-10-10" });
    const ops = await driver.parseEdit("this is a bit much, and I'd like more wine", trip);
    return ops.length ? ops.map((o) => o.kind).join(", ") : null;
  });

  console.log("  " + "─".repeat(58));
  console.log(`  Model answered ${stats.attempts - stats.fallbacks}/${stats.attempts} calls.`);
  if (failures === 0) {
    console.log("  \x1b[32mAll good.\x1b[0m The LLM driver is live.\n");
    console.log("    npm run eval:parsing  the comparison that can actually separate them");
    console.log("    npm run eval:llm      full scenario suite through the model");
    console.log("    npm start            use it in the app\n");
  } else {
    console.log(`  ${failures} step(s) fell back to the rules driver.`);
    console.log("  The app still works; it just isn't using the model for those.\n");
  }
  process.exit(failures ? 1 : 0);
})();
