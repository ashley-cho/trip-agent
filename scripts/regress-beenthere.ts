/**
 * Regression: her road trip, verbatim.
 *
 *   "i wanna go on a road trip - i've been to bryce canyon, grand canyon,
 *    zion, etc. already"
 *
 * It recommended the Grand Canyon. She said so again. It recommended Zion and
 * Arches. She said so a third time, in plain words, and it recommended the
 * Utah canyon country one more time.
 *
 * The ban list existed and the recommender genuinely honoured it. Nothing
 * wrote to it except a chip on a card she never clicked, so a sentence saying
 * "I've been there" was parsed as a sentence asking to go there.
 */
import { detectVisited, interpretRules } from "@/lib/discovery";
import { applyPatch } from "@/lib/brief";
import { recommend, scoreDestinations } from "@/lib/recommend";
import { emptyBrief, emptyProfile } from "@/lib/types";
import type { Brief } from "@/lib/types";
import { destinationById, CITIES, DESTINATIONS } from "@/data/destinations";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mI'VE ALREADY BEEN THERE\x1b[0m\n");

const hers = "i wanna go on a road trip - i've been to bryce canyon, grand canyon, zion, etc. already";
const seen = detectVisited(hers);
check("her message rules out the southwest", seen.ids.includes("southwest"), seen.ids.join(", ") || "nothing");
check("and keeps the part that is a request", /road trip/i.test(seen.rest), seen.rest);
check("and names what she said she'd done",
  seen.names.some((n) => /grand canyon|zion|bryce/i.test(n)), seen.names.join(" / "));

const patch = interpretRules(hers, emptyBrief());
check("so the brief bans it rather than requesting it",
  (patch.visitedIds ?? []).includes("southwest") && patch.namedDestination !== "southwest",
  `visited=${patch.visitedIds} named=${patch.namedDestination}`);

// The whole point: the recommendation must not be a place she's been.
let b = applyPatch(emptyBrief(), patch);
b = applyPatch(b, { days: 10, vibes: ["nature", "adventure"] });
const rec = recommend(b, emptyProfile());
check("and the recommendation is somewhere she hasn't been",
  !(b.visitedIds ?? []).includes(rec.destinationId),
  `${destinationById(rec.destinationId).name}`);
check("the banned destination isn't even scored",
  !scoreDestinations(b).some((s) => s.id === "southwest"));

// Saying it a second time, after a pitch, has to keep working.
const again = interpretRules("i've been to angel's landing already though", b);
check("a second, vaguer statement still reads as a ban, not a request",
  !again.namedDestination && !(again.candidates ?? []).length,
  JSON.stringify({ named: again.namedDestination, candidates: again.candidates }));

// The mirror image: wanting to go somewhere must never be read as a ban.
for (const wanting of [
  "i want to go to zion",
  "i've never been to japan and i'd love to",
  "thinking about portugal",
  "we're dying to see iceland",
]) {
  const v = detectVisited(wanting);
  check(`"${wanting}" is a request, not a ban`, v.ids.length === 0 && v.names.length === 0,
    [...v.ids, ...v.names].join(", "));
}

// And a ban in one sentence must not eat the request in the next.
const mixed = detectVisited("I've been to Japan. I want somewhere warm with good food.");
check("a ban and a request in one message are told apart",
  mixed.ids.includes("japan") && /somewhere warm/i.test(mixed.rest),
  `banned=${mixed.ids} rest="${mixed.rest}"`);

// Having been everywhere is an honest no, not a crash and not a repeat.
const everywhere = applyPatch(emptyBrief(), {
  days: 7,
  visitedIds: scoreDestinations(emptyBrief()).map((s) => s.id),
});
let survived = true, verdict = "";
try {
  const r = recommend(everywhere, emptyProfile());
  verdict = r.noGoodFit ?? "(none)";
} catch (e) { survived = false; verdict = (e as Error).message; }
check("having been everywhere says so instead of crashing", survived && !!verdict, verdict);

// The profile route (the chip) must still work.
const viaChip = recommend(
  applyPatch(emptyBrief(), { days: 10, vibes: ["nature"] }),
  { ...emptyProfile(), visitedDestinationIds: ["southwest"] },
);
check("the chip and the sentence ban the same way", viaChip.destinationId !== "southwest",
  destinationById(viaChip.destinationId).name);

console.log("\n\x1b[1mBUT A TOWN IS NOT THE COUNTRY\x1b[0m\n");
{
  /*
   * `detectVisited` matches on NAMED_DESTINATIONS, which maps a town to its
   * destination — right for "take me there", wrong for "I've been there". So
   * "i want to go to portugal for 9 days, i've been to lisbon" recorded
   * visitedIds: ["portugal"], recommend() read that as her turning the country
   * down, and she got Japan. Thirty of thirty-four cases drifted to a
   * different country, silently, off the strongest rule she has given.
   */
  let drift = 0, cases = 0;
  for (const d of DESTINATIONS) {
    const plain = `i want to go to ${d.id} for 9 days`;
    const ctrl = applyPatch(emptyBrief(plain), interpretRules(plain, emptyBrief(plain))) as Brief;
    if (recommend(ctrl).destinationId !== d.id) continue;
    for (const c of CITIES.filter((x) => x.destinationId === d.id).slice(0, 2)) {
      cases++;
      const text = `i want to go to ${d.id} for 9 days. i've been to ${c.name} already`;
      const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
      const got = recommend(b).destinationId;
      if (got !== d.id) {
        drift++;
        if (drift <= 2) console.log(`        ${d.id} + been to ${c.name} → ${got}`);
      }
    }
  }
  check("a town she has seen does not cancel the country she just named",
    drift === 0, `${drift} of ${cases} drifted`);
  check("and there were cases to test", cases > 10, `${cases}`);

  /*
   * The ban and the request share a sentence far more often than they get
   * their own. `asking` read the whole tail, so every one of these threw the
   * ban away — and the app then recommended the place she had just ruled out.
   * The only phrasing that worked was the one with a full stop in it, which is
   * the one this file used.
   */
  for (const [text, banned] of [
    ["i've been to bali and i want somewhere new", "bali"],
    ["already did portugal, want somewhere else", "portugal"],
    ["been to lisbon and porto before", "portugal"],
    ["we went to iceland last year, somewhere new please", "iceland"],
    ["i've been to japan twice and would like something different", "japan"],
  ] as const) {
    const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
    check(`"${text.slice(0, 40)}…" doesn't send her back to ${banned}`,
      recommend(b).destinationId !== banned,
      `ids=${JSON.stringify(b.visitedIds ?? [])} → ${recommend(b).destinationId}`);
  }
  // But "but" reverses it: that is a request to go back.
  {
    const text = "i've been to bali but i want to go back";
    const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
    check("\"but i want to go back\" is a request, not a ban",
      !(b.visitedIds ?? []).includes("bali"), JSON.stringify(b.visitedIds ?? []));
  }
  // And a ban three turns after she named the place still lands.
  {
    let b = emptyBrief("i want to go to portugal for 9 days");
    b = applyPatch(b, interpretRules("i want to go to portugal for 9 days", b)) as Brief;
    const second = "actually i've been to portugal already, somewhere else";
    b = applyPatch(b, interpretRules(second, b)) as Brief;
    check("retracting a place she named earlier works",
      (b.visitedIds ?? []).includes("portugal") && recommend(b).destinationId !== "portugal",
      `ids=${JSON.stringify(b.visitedIds ?? [])} → ${recommend(b).destinationId}`);
  }

  // She is still allowed to be done with a whole country.
  const done = "i want to go somewhere for 9 days. i've been to portugal already";
  const b2 = applyPatch(emptyBrief(done), interpretRules(done, emptyBrief(done))) as Brief;
  check("but ruling out the country itself still rules it out",
    (b2.visitedIds ?? []).includes("portugal") && recommend(b2).destinationId !== "portugal",
    JSON.stringify(b2.visitedIds));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
