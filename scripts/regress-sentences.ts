/**
 * The sentence keeps going after the place name.
 *
 * Every case in replay.ts put the destination at the end of its clause:
 * "go to hokkaido FOR 10 days", "go to oaxaca FOR 6 days". Real sentences
 * don't stop there. She typed:
 *
 *   "i want to go to iceland to see the northern lights. give me an itinerary"
 *
 * The going-to capture takes up to four words, so it took "iceland to see
 * the". The trailing trimmer popped "the" and then stopped dead at "see",
 * because it only pops words it recognises. The phrase stayed "iceland to
 * see", resolved to nothing, and was filed as somewhere we don't cover —
 * which CLEARED the model's correct "iceland". She was sent to New Zealand.
 *
 * Two rules came out of it, and this file exists to keep them:
 *
 *   1. A name ends at the first word that ends names, wherever it sits, not
 *      only when it is trailing.
 *   2. Before calling a phrase somewhere we don't cover, try its prefixes.
 *      "hokkaido" has none that resolve and stays a research subject, which
 *      is the whole point. "iceland to see" resolves on the first trim.
 */
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { subjects } from "@/lib/subject";
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import { emptyUsage } from "@/lib/cost";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};
const fake = (a: Record<string, unknown>): Transport => ({ call: async () => a, usage: () => emptyUsage() });

/** want: a destination id, or "research:<subject>". */
const CASES: [string, Record<string, unknown>, string][] = [
  ["i want to go to iceland to see the northern lights. give me an itinerary",
   { destination_ids: ["iceland"] }, "iceland"],
  // The same sentence with the model silent. The backstop must still not
  // invent a place called "iceland to see".
  ["i want to go to iceland to see the northern lights", {}, "iceland"],
  ["going to japan to eat", { destination_ids: ["japan"] }, "japan"],
  ["i want to go to kyoto to see temples", { destination_ids: ["japan"] }, "japan"],
  ["i want to go to oaxaca with my sister for 6 days", { destination_ids: ["mexico"] }, "mexico"],
  ["i want to go to lisbon for 4 days", { destination_ids: ["portugal"] }, "portugal"],
  ["i want to go to seville and eat well", { destination_ids: ["andalusia"] }, "andalusia"],
  // And the ones that must STILL be researched rather than matched to a
  // country. If a prefix trim ever swallows these, the Hokkaido bug is back.
  ["i want to go to hokkaido for 10 days. food, onsen and driving.",
   { destination_ids: ["japan"] }, "research:hokkaido"],
  ["i want to go to the faroe islands to see puffins", {}, "research:faroe islands"],
  ["trip to patagonia to hike", {}, "research:patagonia"],
  ["i want to go to hokkaido to eat", { destination_ids: ["japan"] }, "research:hokkaido"],
];

async function main() {
  console.log("\n\x1b[1mTHE SENTENCE KEEPS GOING\x1b[0m\n");
  for (const [said, model, want] of CASES) {
    const b: Brief = applyPatch({ ...emptyBrief(), days: 8 },
      await createLlmDriver(fake(model)).interpret(said, emptyBrief()));
    const sub = subjects(b);
    if (want.startsWith("research:")) {
      const subject = want.slice("research:".length);
      check(`"${said.slice(0, 46)}…" is looked up, not matched`,
        sub.some((x) => x.toLowerCase() === subject),
        `subjects=${JSON.stringify(sub)} named=${b.namedDestination}`);
    } else {
      const got = sub.length ? `research:${sub.join(",")}` : recommend(b, emptyProfile()).destinationId;
      check(`"${said.slice(0, 46)}…" lands on ${want}`, got === want,
        `${got} (named=${b.namedDestination} focus=${b.focusCityId})`);
    }
  }
  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}
void main();
