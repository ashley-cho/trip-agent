/**
 * Regression: the guard that was eating good pitches.
 *
 * "model failed — rules" on a researched Yunnan trip was not a failed API
 * call. The model wrote a fine recommendation, and `namesOnly` threw it away
 * because the catalogue contains "the Utah canyon country", "the Olympic
 * Peninsula" and "New Zealand's South Island". Split into tokens, that makes
 * the words coast, country, canyon, island, south and peninsula into evidence
 * that the agent is recommending somewhere else. They are not. They are how
 * anyone writes about landscape.
 *
 * The guard has to keep doing its real job: "I'm sending you to Montenegro"
 * on top of a Rome itinerary is the most trust-destroying sentence this
 * product can produce.
 */
import { namesOnlyForTest as namesOnly } from "@/lib/agent/llm";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mTHE PITCH GUARD\x1b[0m\n");

// Ordinary landscape writing must survive.
for (const prose of [
  "Limestone karst, deep gorges and alpine lakes in the south of the province.",
  "Gorge country, and the trails start an hour from where you sleep.",
  "You are on the coast for three days, then inland.",
  "It is an island, so nothing is more than two hours away.",
  "The canyon walls are the whole point, and the region is empty in October.",
  "Big mountains, a real river valley, and a national park you can walk into.",
]) {
  check(`kept: "${prose.slice(0, 46)}…"`, namesOnly("Yunnan", prose, "yunnan"));
}

// The thing it exists to catch still gets caught.
for (const [chosen, prose, id] of [
  ["Yunnan", "Honestly, I'd send you to Portugal instead.", "yunnan"],
  ["Portugal", "Three nights in Kyoto, then two in Tokyo.", "portugal"],
  ["Rome and Tuscany", "You want Iceland for this, not what I've planned.", "italy"],
  ["Yunnan", "This is a lot like Bali, so go to Bali.", "yunnan"],
] as const) {
  check(`caught: "${prose.slice(0, 46)}…"`, !namesOnly(chosen, prose, id));
}

// A destination may always be named in its own pitch, generic words included.
check("a destination can name itself",
  namesOnly("the Utah canyon country", "The Utah canyon country is the whole trip.", "southwest"));
check("and the full name of another is always disqualifying",
  !namesOnly("Yunnan", "Nothing beats the Olympic Peninsula for this.", "yunnan"));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
