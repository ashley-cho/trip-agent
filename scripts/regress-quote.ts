/**
 * "You said" has to be followed by something she said.
 *
 * She typed "i wanna hike a national park", then "Remote and quiet, away from
 * crowds". The pitch for New Zealand opened: "You said nature, adventure and
 * relaxation, which is an odd combination until you find the one place that
 * does all three." She had said none of those three words.
 *
 * They are `vibes`: tags the model picks off a fixed list to drive scoring.
 * briefSummary handed them over under that name, next to her real words, and
 * the pitch prompt said "referring to what THEY said". The model reasonably
 * read the tags as her words and quoted them back. The one line whose whole
 * job is to prove it listened was a fabricated quote.
 *
 * The same sentence lived in the offline whyLine fallback, which additionally
 * asserted she "didn't want to spend the trip rushing" whether or not she had
 * ever said anything of the kind.
 */
import { readFileSync } from "node:fs";
import { VOICE } from "@/lib/agent/prompts";
import { whyLine } from "@/lib/concept";
import type { Brief, Trip } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  do not put words in her mouth\n");

// --- the voice forbids it, everywhere, in one place -----------------------
check("VOICE forbids attributing words she did not say", /you said/i.test(VOICE) && /fabricated quote/i.test(VOICE));
check("and names vibes as ours, not hers", /vibes are OUR internal tags/.test(VOICE));

// --- the tags cannot arrive looking like her words ------------------------
const llm = readFileSync("lib/agent/llm.ts", "utf8");
check("briefSummary no longer offers a bare `vibes` field",
  !/^\s*vibes: b\.vibes,/m.test(llm));
check("the tags are labelled as ours and unquotable",
  /vibes_our_internal_tags_never_quote: b\.vibes/.test(llm));
check("and her actual words are labelled as safe to quote",
  /their_own_words_safe_to_quote: b\.interestEcho/.test(llm));
check("the pitch prompt no longer says 'what THEY said' over the tags",
  !/referring to what THEY said/.test(llm));
check("and names the two fields an attribution may come from",
  /must come from opening or their_own_words_safe_to_quote/.test(llm));

// --- and the offline fallback holds the same line -------------------------
const trip = {
  concept: { days: 7, shape: [{ cityId: "lisbon" }, { cityId: "porto" }] },
  days: [{ items: [] }, { items: [] }],
} as unknown as Trip;

const withEcho = { vibes: ["nature", "adventure"], constraints: [], avoidTags: [],
  interestEcho: "hike a national park; remote and quiet, away from crowds" } as unknown as Brief;
const noEcho = { vibes: ["nature", "adventure", "relaxation"], constraints: [], avoidTags: [] } as unknown as Brief;

const a = whyLine(trip, withEcho);
check("her own words are quoted back when there are any", /You said hike a national park/.test(a), a.slice(0, 90));

const b = whyLine(trip, noEcho);
check("with nothing of hers, it does not claim she said anything", !/[Yy]ou said/.test(b), b.slice(0, 110));
check("and it still describes the trip rather than going blank", /7 days/.test(b));

for (const [label, line] of [["with echo", a], ["without echo", b]] as const) {
  check(`${label}: no invented claim about rushing`, !/spend the trip rushing/.test(line));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
