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
import { quotable } from "@/lib/brief";
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
  /their_own_words_safe_to_quote: b\.activities/.test(llm));
check("the pitch prompt no longer says 'what THEY said' over the tags",
  !/referring to what THEY said/.test(llm));
// Three fields now. everything_they_have_said was added to briefSummary and
// the prompt was not updated to match, so an obedient model still would not
// quote anything she said after turn one.
check("and names every field an attribution may come from",
  /must come from opening, their_own_words_safe_to_quote, or everything_they_have_said/.test(llm));
check("a chip label is not one of her words",
  /\.filter\(\(x\) => x\.how === "typed"\)/.test(llm));
/*
 * The fixed chips were already excluded as our taxonomy. The freeform ones go
 * back through `send` as if she had typed them — which is right for parsing
 * and wrong for attribution, and this path recorded them as "typed".
 */
check("and neither is a freeform chip the model wrote",
  /await send\(label, "picked"\)/.test(readFileSync("app/page.tsx", "utf8")));

// --- and the offline fallback holds the same line -------------------------
const trip = {
  concept: { days: 7, shape: [{ cityId: "lisbon" }, { cityId: "porto" }] },
  days: [{ items: [] }, { items: [] }],
} as unknown as Trip;

/*
 * `opening` carries what she typed, because "You said X" is now gated on X
 * being words she used. `activities` alone is not evidence of that: the model
 * fills the same list, and so does a freeform chip the model wrote.
 */
const withEcho = { vibes: ["nature", "adventure"], constraints: [], avoidTags: [],
  opening: "i want to hike a national park, somewhere remote and quiet, away from crowds",
  activities: ["hike a national park", "remote and quiet, away from crowds"] } as unknown as Brief;
const noEcho = { vibes: ["nature", "adventure", "relaxation"], constraints: [], avoidTags: [] } as unknown as Brief;

const a = whyLine(trip, withEcho);
check("her own words are quoted back when there are any", /You said hike a national park/.test(a), a.slice(0, 90));

const b = whyLine(trip, noEcho);
check("with nothing of hers, it does not claim she said anything", !/[Yy]ou said/.test(b), b.slice(0, 110));
check("and it still describes the trip rather than going blank", /7 days/.test(b));

for (const [label, line] of [["with echo", a], ["without echo", b]] as const) {
  check(`${label}: no invented claim about rushing`, !/spend the trip rushing/.test(line));
}


// --- words we wrote are never quoted as hers ------------------------------
/*
 * `activities` is filled from three places: her typing, the rules parser, and
 * the model — which is asked for "their own words safe to quote" and has no
 * way of being held to it. A freeform chip is worse: the model writes the
 * label, she clicks it, and until now the click was recorded as if she had
 * typed the sentence. So a chip reading "Mostly food and wine" could produce
 * "You asked for wine."
 *
 * Everything stays on the brief — dropping an entry would lose a request, the
 * worse failure. Only the attribution is gated.
 */
{
  const paraphrased = {
    vibes: [], constraints: [], avoidTags: [],
    opening: "somewhere warm for a week",
    activities: ["vineyard tours and fine dining"],
    stated: [{ at: Date.now(), text: "somewhere warm for a week", how: "typed" }],
  } as unknown as Brief;
  check("a phrase she never typed is not quoted back at her",
    !/You said/.test(whyLine(trip, paraphrased)), whyLine(trip, paraphrased).slice(0, 90));
  check("and quotable() drops it while the brief keeps it",
    quotable(paraphrased).length === 0 && (paraphrased.activities ?? []).length === 1);

  const chipped = {
    vibes: [], constraints: [], avoidTags: [],
    opening: "plan me something",
    activities: ["mostly food and wine"],
    stated: [
      { at: Date.now(), text: "plan me something", how: "typed" },
      { at: Date.now(), text: "mostly food and wine", how: "picked" },
    ],
  } as unknown as Brief;
  check("a chip she clicked is not a chip she wrote",
    quotable(chipped).length === 0, JSON.stringify(quotable(chipped)));

  const hers = {
    vibes: [], constraints: [], avoidTags: [],
    opening: "i want to go somewhere for the wine and the food",
    activities: ["the wine"],
    stated: [{ at: Date.now(), text: "i want to go somewhere for the wine and the food", how: "typed" }],
  } as unknown as Brief;
  check("but her own words still are", quotable(hers).length === 1, JSON.stringify(quotable(hers)));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
