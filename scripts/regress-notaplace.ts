/**
 * Regression: a country called Budget.
 *
 * "8 days in Portugal in October, good food and long walks, budget about
 * $2500" reached the brief as TWO destinations: Portugal, and "budget". The
 * comma-list scan cuts each clause at its first name-ending word — "about" —
 * so "budget about $2500" became the bare phrase "budget", nothing recognised
 * it as English, and the app went off to research it.
 *
 * With no key that research call answers with a JSON body rather than a
 * stream, and the traveller read `{"driver":"rules","problem":…}` in a chat
 * bubble. That half is lib/client.ts and scripts/regress-nonstream.ts; this
 * file holds the parser half, which is the reason there was a research call
 * about a budget at all.
 *
 * The filter it adds is a word list, which is the shape this parser has got
 * wrong before, so the other half of this file is the load-bearing half: an
 * unknown place she actually named must still be researched. Those cases live
 * in regress-openworld.ts and regress-montenegro.ts too; the ones here are the
 * ones a money filter could plausibly eat.
 */
import { detectNamedPlaces, detectNamedPlace, cleanPlacePhrase, interpretRules } from "@/lib/discovery";
import { emptyBrief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mMONEY IS NOT A DESTINATION\x1b[0m\n");

/** The message from the bug report, exactly as typed. */
const REPORTED = "8 days in Portugal in October, good food and long walks, budget about $2500";

{
  const { known, unknown } = detectNamedPlaces(REPORTED);
  check("the reported message names no place we have to go and research",
    unknown.length === 0, `unknown: ${JSON.stringify(unknown)}`);
  check("and Portugal survives it", known.includes("portugal"), JSON.stringify(known));

  // The end of the path, which is what actually starts a research run.
  const patch = interpretRules(REPORTED, emptyBrief());
  check("so nothing is queued for research off the back of it",
    (patch.unknownCandidates ?? []).length === 0,
    JSON.stringify(patch.unknownCandidates ?? []));
  check("and the budget is still read as a budget",
    patch.budgetUsd === 2500, String(patch.budgetUsd));
  check("and the length too", patch.days === 8, String(patch.days));
}

/*
 * The same clause in the other phrasings people use. Asserted as "the money
 * clause is not in the list" rather than "the list is empty", because Peru and
 * Vietnam are not in the catalogue and researching THEM is correct — that is
 * the whole feature this filter must not damage.
 */
for (const [msg, stray, why] of [
  ["10 days in Japan, budget 3000", "budget", "a bare number"],
  ["a week in Italy, budget of 2k", "budget", "thousands"],
  ["two weeks in Peru, total cost around $4,000", "total", "a total"],
  ["9 days in Vietnam, flights about $900", "flights", "flights"],
  ["a week in Spain, accommodation about 100 a night", "accommodation", "accommodation"],
] as const) {
  const { unknown } = detectNamedPlaces(msg);
  check(`${why}: "${msg}" does not send us to research "${stray}"`,
    !unknown.some((u) => u.toLowerCase().includes(stray)), JSON.stringify(unknown));
}

console.log("\n\x1b[1mAND AN UNKNOWN PLACE IS STILL RESEARCHED\x1b[0m\n");

for (const [msg, want] of [
  ["montenegro or albania", ["montenegro", "albania"]],
  ["10 days in the faroe islands or the azores", ["faroe islands", "azores"]],
  ["i want to go to hokkaido for 10 days", ["hokkaido"]],
] as const) {
  const { unknown } = detectNamedPlaces(msg);
  check(`"${msg}" still comes back as ${want.join(" + ")}`,
    want.every((w) => unknown.includes(w)), JSON.stringify(unknown));
}

/*
 * The case the filter is most likely to break, and the reason it is tested
 * against the CLEANED phrase and never the raw one: the money and the place
 * in the same clause.
 */
for (const msg of [
  "i want to go to montenegro with a $3000 budget",
  "10 days in the faroe islands, budget about $4000",
  "a week in hokkaido on a budget",
] as const) {
  const found = detectNamedPlace(msg);
  const plural = detectNamedPlaces(msg);
  check(`money in the same sentence does not delete the place: "${msg}"`,
    !!found.unknown || plural.unknown.length > 0 || !!found.known,
    JSON.stringify({ found, plural }));
}

check("a place name that merely contains a filtered word is untouched",
  cleanPlacePhrase("costa rica") === "costa rica", String(cleanPlacePhrase("costa rica")));
check("and the filter is anchored, so 'budapest' is not 'budget'",
  cleanPlacePhrase("budapest") === "budapest", String(cleanPlacePhrase("budapest")));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
