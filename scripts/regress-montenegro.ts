/**
 * Regression: the Montenegro session.
 *
 * A model was asked to rewrite the "unknown_place" question from its id alone
 * and returned "Where are you coming from?", so the traveller was never told
 * the place she named isn't covered. Discovery then ran to completion and the
 * pitch announced "I'm sending you to Montenegro, not Rome" over a Rome plan.
 *
 * Both failures are now rejected by the driver rather than shown to a user.
 */
import "@/lib/env";
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { emptyBrief, type Brief, unknownHead } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { rulesDriver } from "@/lib/agent/rules";

// A model that behaves exactly as the one in her session did.
const badModel: Transport = {
  async call(args) {
    if (args.tool.name === "ask") return { prompt: "Where are you coming from?" };
    if (args.tool.name === "write_pitch") {
      return {
        headline: "I'm sending you to Montenegro, not Rome.",
        body: "You said Montenegro and I'm not going to talk you out of it. It has the culture, the food, and the exploration you want. Rome will be there next year.",
      };
    }
    return {};
  },
};

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${name}${detail ? `\n        ${detail}` : ""}`);
  if (!ok) fails++;
};

(async () => {
  console.log("\nMONTENEGRO REGRESSION\n");

  const driver = createLlmDriver(badModel);

  // 1. She names a place we don't cover.
  const patch = await driver.interpret("i wanna go to montenegro", emptyBrief());
  const brief: Brief = { ...emptyBrief(), ...patch } as Brief;
  check("the unknown place is recorded", unknownHead(brief)?.toLowerCase() === "montenegro",
        `got ${JSON.stringify(unknownHead(brief))}`);

  // 2. It asks something conversational, and never mentions its catalogue.
  //    The original fix here was a fifteen-item "everywhere I can plan
  //    properly" menu. Honest, and useless: a list of countries nobody asked
  //    about, in answer to someone saying where they want to go.
  const q = await driver.nextQuestion(brief, [{ from: "user", text: "i wanna go to montenegro" }]);
  check("it asks something rather than listing a catalogue", !!q && q.id !== "unknown_place",
        `got ${q?.id}`);
  check("it never says what it doesn't cover", !/don'?t cover|can plan properly/i.test(q?.prompt ?? ""),
        `got "${q?.prompt}"`);
  check("and it doesn't hand back a menu of the whole catalogue",
        (q?.options?.length ?? 0) < 6, `${q?.options?.length ?? 0} options`);

  // 3. Even if discovery somehow completes, the pitch may not claim Montenegro.
  const full: Brief = { ...brief, unknownAcknowledged: true, days: 6, budgetUsd: 3000,
                        vibes: ["culture", "food"], } as Brief;
  const rec = recommend(full);
  const pitch = await driver.pitch(rec, full);
  const dest = rec.destinationId;
  check("the pitch does not say it is sending her to Montenegro",
        !/sending you to montenegro/i.test(`${pitch.headline} ${pitch.body}`),
        `headline: "${pitch.headline}"`);
  const rulesPitch = await rulesDriver.pitch(rec, full);
  check("it fell back to the honest pitch", pitch.headline === rulesPitch.headline,
        `recommended ${dest}`);

  console.log(`\n  ${fails === 0 ? "\x1b[32mall clear\x1b[0m" : `\x1b[31m${fails} failing\x1b[0m`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
