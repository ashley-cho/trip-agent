/**
 * A typo must not cost her the country.
 *
 * "i wanna go see the northern lights in canad" — one missing letter. The
 * model read it as Canada, correctly. The corroboration guard in
 * validatePatch, which exists to stop the model naming somewhere she never
 * said, compared its answer to her text as an exact substring: "canad" does
 * not contain "canada", so the guard deleted every where-field in the patch.
 *
 * The brief ended up with no destination at all. The reply still talked about
 * Yellowknife and the Yukon, because the reply is written from her raw words,
 * so nothing on screen said anything was wrong. Two chips later the brief was
 * still empty, `namedNowhere` was true, and the open-world suggestion — which
 * is handed no history and no catalogue — sent her to Tromso, Norway.
 *
 * She named Canada and got Norway, and no single line of code chose that.
 *
 * The guard stays. It is now typo-tolerant in the ways a keyboard is, and no
 * looser than that: the first three letters must match, and one edit, never
 * two.
 */
import { validateForTest, nearlySaidForTest } from "@/lib/agent/llm";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `  ${d}` : ""}`);
  if (!ok) fails++;
};
const where = (said: string, raw: Record<string, unknown>) => {
  const p = validateForTest(raw, said) ?? {};
  return p.namedDestination ?? p.unknownDestination ?? p.focusCityId
    ?? p.unknownCandidates?.[0] ?? p.region ?? "";
};

console.log("\n\x1b[1mA TYPO IS STILL HER NAMING THE PLACE\x1b[0m\n");

// --- the one that sent her to Norway ------------------------------------
check("canad is Canada",
  where("i wanna go see the northern lights in canad", { place_named: "Canada" }) === "Canada");
check("canada is still Canada",
  where("i wanna go see the northern lights in canada", { place_named: "Canada" }) === "Canada");

// --- ordinary keyboard slips --------------------------------------------
for (const [said, hint, want] of [
  ["thinking about portgual in may", "Portugal", "portugal"],      // transposed
  ["10 days in japn", "Japan", "japan"],                            // dropped letter
  ["a week in icelnad", "Iceland", "iceland"],                      // transposed
  ["what about oaxca", "Oaxaca", "mexico"],                         // dropped letter, city
  ["two weeks in new zeland", "New Zealand", "newzealand"],         // two words
] as const) {
  check(`${said}  ->  ${want}`, where(said, { place_named: hint }) === want,
    where(said, { place_named: hint }));
}

// --- the guard still guards ---------------------------------------------
//
// A hint she did not type proves nothing. This is the Hokkaido case and the
// whole reason the guard exists: fuzziness must not become a licence.
for (const [said, hint] of [
  ["make it five days", "Bali"],
  ["somewhere with good food", "Portugal"],
  ["about 3000 dollars", "Iceland"],
  ["yeah that sounds good", "Norway"],
  ["not sure yet, open to suggestions", "Tromso"],
  ["mix in a city or two as well", "Canada"],
] as const) {
  check(`"${said}" does not corroborate ${hint}`, where(said, { place_named: hint }) === "",
    where(said, { place_named: hint }));
}

// --- a different country is not a typo ----------------------------------
//
// One edit apart and three letters in, "ireland" and "iceland" are different
// countries. Corroborating one with the other is the substitution this guard
// exists to prevent, so the first three letters have to match and the tail
// has to be a slip rather than a different word.
//
// Tested against the tolerance itself. Whether the wider guard lets a message
// through on some other evidence is a separate question with its own file;
// what matters here is that a typo never becomes a licence to substitute.
for (const [said, hint] of [
  ["a week in ireland", "Iceland"],
  ["a week in iran", "Iraq"],
  ["a week in austria", "Australia"],
  ["a week in mali", "Bali"],
  ["a week in chile", "China"],
  ["a week in niger", "Nigeria"],
] as const) {
  check(`${said} does not corroborate ${hint}`, !nearlySaidForTest(said, hint));
}

for (const [said, hint] of [
  ["i wanna go see the northern lights in canad", "Canada"],
  ["thinking about portgual in may", "Portugal"],
  ["two weeks in new zeland", "New Zealand"],
  ["somewhere in bali", "Bali"],
] as const) {
  check(`${said} corroborates ${hint}`, nearlySaidForTest(said, hint));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
