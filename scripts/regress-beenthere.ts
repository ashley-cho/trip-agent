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
  /*
   * "I've been MEANING to visit Japan" is not a place she has been. The "i've"
   * satisfied the past-tense evidence, so the whole message was read as a ban:
   * Japan ruled out — the opposite of what she said — and her ten days, her
   * March and her budget discarded with the swallowed clause, while "food" and
   * "temples" were recorded as countries she had already visited.
   */
  {
    const text = "i've been meaning to visit japan, 10 days in march, around $4000, food and temples";
    const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
    check("\"been meaning to\" is not \"been\"",
      !(b.visitedIds ?? []).includes("japan"), JSON.stringify(b.visitedIds ?? []));
    check("  and nothing else in the message is lost with it",
      b.days === 10 && b.month === "March" && b.budgetUsd === 4000,
      `days=${b.days} month=${b.month} budget=${b.budgetUsd}`);
    check("  and her reasons are not filed as countries",
      !(b.visitedNames ?? []).some((n) => /food|temple/i.test(n)),
      JSON.stringify(b.visitedNames ?? []));
  }

  /*
   * Two places banned in one breath sent her to the second one: the split at
   * "and" put Korea in the tail, the tail went back into the message as a
   * request, and the retraction filter then deleted the ban it had just
   * recorded. The brief said "already been to japan, korea" and shipped Korea.
   */
  for (const text of ["i've already been to japan and korea, somewhere else",
    "we've been to iceland and denmark, want somewhere warm",
    "i've been to portugal and italy, somewhere different please"]) {
    const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
    const got = recommend(b).destinationId;
    // Both, not just the first: the second used to come back out of the tail
    // as a request and delete its own ban.
    check(`"${text.slice(0, 34)}…" bans both`,
      (b.visitedIds ?? []).length === 2 && !(b.visitedIds ?? []).includes(got),
      `ids=${JSON.stringify(b.visitedIds ?? [])} → ${got}`);
  }

  /*
   * "Noted, no Somewhere New." NOT_A_PLACE was checked against the whole
   * phrase, so "somewhere new", "want somewhere warm" and "bali though" became
   * places she had been — read back in the acknowledgement, in the interest
   * line, and in the model's never-suggest list.
   */
  for (const text of ["i've seen bali already, somewhere new",
    "10 days somewhere warm - i've been to bali though",
    "i visited iceland last year and want somewhere warm"]) {
    const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
    check(`"${text.slice(0, 32)}…" files no phantom places`,
      !(b.visitedNames ?? []).some((n) => /somewhere|want|though|else|new\b/i.test(n)),
      JSON.stringify(b.visitedNames ?? []));
  }

  /*
   * The tail is where her REQUEST lives, and the place scan next to the
   * clause-scoped polarity checks ran over all of it. So "i've been to
   * portugal, i want to go to japan" recorded BOTH as places she was done with
   * — recommend() skips namedDestination when it is in visitedIds — and
   * answered with a third country. Fifteen of fifteen, on every separator
   * except the full stop and the newline, which are the two this file used.
   */
  for (const sep of [". ", ", ", "; ", " - ", " — ", ": ", " / ", "\n", " & ", " and "]) {
    const text = `i've been to portugal${sep}i want to go to japan`;
    const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
    check(`a request after a ban is not itself a ban (${JSON.stringify(sep)})`,
      recommend(b).destinationId === "japan",
      `ids=${JSON.stringify(b.visitedIds ?? [])} → ${recommend(b).destinationId}`);
  }

  /*
   * And a place she says she has NEVER been is not a place she has been: the
   * negation was clause-scoped and the place scan beside it was not.
   */
  for (const text of ["i've been to bali but not japan - somewhere new please",
    "we did italy last year - haven't been to japan - lets do japan"]) {
    const b = applyPatch(emptyBrief(text), interpretRules(text, emptyBrief(text))) as Brief;
    check(`"${text.slice(0, 40)}…" doesn't ban Japan`,
      !(b.visitedIds ?? []).includes("japan"), JSON.stringify(b.visitedIds ?? []));
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
