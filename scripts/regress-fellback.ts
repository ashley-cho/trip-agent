/**
 * Regression: "model failed — rules" on a call where nothing failed.
 *
 * The badge exists so that "is it really calling a model?" is observable
 * rather than a matter of faith, which makes a false one the worst kind of
 * bug: it undermines the one honest instrument in the app.
 *
 * The discovery question has a floor, and the model has a `done` flag for
 * "another question would only be politeness". When the model set done and the
 * floor said one more question was required, the code took the missing prompt
 * as a broken answer: it counted a fallback, showed "model failed — rules",
 * and read out the canned chips. Nothing had failed. The two simply disagreed,
 * and the floor is supposed to win that argument quietly.
 *
 * Everything that IS a failure now says what it was, instead of "unknown
 * error".
 */
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { emptyBrief, type Brief } from "@/lib/types";
import { emptyUsage } from "@/lib/cost";
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

const fake = (answer: Record<string, unknown> | null): Transport => ({
  call: async () => answer,
  usage: () => emptyUsage(),
});

/** Nothing known but where: the floor requires a question. */
const bare: Brief = { ...emptyBrief(), namedDestination: "portugal" };

console.log("\n\x1b[1mA DISAGREEMENT IS NOT A FAILURE\x1b[0m\n");

async function main() {

{
  const d = createLlmDriver(fake({ done: true }));
  const q = await d.nextQuestion(bare, [], "discovery");
  check("the model saying 'I have enough' still gets the floor question", !!q, String(q?.id));
  check("and is NOT counted as a fallback", d.stats?.fallbacks === 0, `fallbacks=${d.stats?.fallbacks}`);
  check("so the badge stays honest", !d.stats?.lastError, String(d.stats?.lastError));
}

{
  const d = createLlmDriver(fake({ prompt: "Lisbon is a good call." }));
  await d.nextQuestion(bare, [], "discovery");
  check("a question with no question in it IS a fallback", d.stats?.fallbacks === 1);
  check("and says so instead of 'unknown error'",
    /no question in it/.test(d.stats?.lastError ?? ""), String(d.stats?.lastError));
}

// At the floor we forbid `done`, so a model with nothing to ask has no honest
// way to say so and returns nothing. That's a refusal, not a malformed answer,
// and required fields can't fix it. The floor wins quietly.
{
  const d = createLlmDriver(fake(null));
  const q = await d.nextQuestion(bare, [], "discovery");
  check("no question at the floor still asks the floor question", !!q, String(q?.id));
  check("and is not counted as a failure", d.stats?.fallbacks === 0,
    `fallbacks=${d.stats?.fallbacks}, ${d.stats?.lastError ?? ""}`);
}

// Above the floor either: a model with nothing to ask has nothing to ask, and
// the sweep showed it declining on twelve trips out of fifteen, every one of
// them working perfectly. What remains a real failure is a malformed answer:
// a "question" with no question in it.
{
  const rich: Brief = { ...emptyBrief(), namedDestination: "portugal", days: 7,
    vibes: ["food", "history", "coastal"] as never };
  const d = createLlmDriver(fake(null));
  await d.nextQuestion(rich, [
    { from: "agent", text: "How long?" }, { from: "user", text: "a week" },
    { from: "agent", text: "What are you after?" }, { from: "user", text: "food and history" },
  ], "discovery");
  check("declining to ask is not a failure above the floor either",
    d.stats?.fallbacks === 0, `fallbacks=${d.stats?.fallbacks}, ${d.stats?.lastError ?? ""}`);
}

{
  const d = createLlmDriver(fake(null));
  await d.interpret("i want to go to lisbon", emptyBrief());
  check("an interpret that records nothing says what happened",
    /recorded nothing usable/.test(d.stats?.lastError ?? ""), String(d.stats?.lastError));
}

// The single largest source of the false badge: the question tool required
// nothing, so {} was a valid answer and there was no way to tell "I have
// enough" from "I broke".
{
  const llm = readFileSync("lib/agent/llm.ts", "utf8");
  check("the question tool requires both a done flag and a question",
    /required: \["done", "prompt"\]/.test(llm));
}

// No path may report a bare "unknown error" any more.
{
  const llm = readFileSync("lib/agent/llm.ts", "utf8");
  const bareCalls = (llm.match(/^\s*fell\(\);\s*$/gm) ?? []).length;
  check("no fallback is recorded without a reason", bareCalls === 0, `${bareCalls} bare fell() calls`);
}

}

main().then(() => {
  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
});
