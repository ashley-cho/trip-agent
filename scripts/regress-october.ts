/**
 * Regression: a month is not a country.
 *
 * She typed "portugal, 9 days in october, history and food, budget 2500".
 * The "days in X" cue captured **october** as a place, so `unknownDestination`
 * became "October". Three questions later the model call fell through to the
 * rules driver, the app went off to research a destination called October, and
 * the answer that came back was three nights in Kyoto, two in Takayama and two
 * in Tokyo. On a Portugal brief.
 *
 * Two floors, tested here:
 *   1. the parser never captures a time word as a place, and
 *   2. even if something upstream hands one over, it never becomes a research
 *      target.
 */
import { detectNamedPlaces, detectNamedPlace, interpretRules } from "@/lib/discovery";
import { emptyBrief, unknownHead } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA MONTH IS NOT A COUNTRY\x1b[0m\n");

const her = "portugal, 9 days in october, history and food, budget 2500";
const got = detectNamedPlaces(her);
check("her actual message finds Portugal", got.known.includes("portugal"), got.known.join(", ") || "nothing");
check("and nothing to go and research", got.unknown.length === 0, got.unknown.join(", ") || "none");

const patch = interpretRules(her, emptyBrief());
check("so no unknown destination is set", !patch.unknownCandidates?.[0], String(patch.unknownCandidates?.[0]));
check("and the length still parses", patch.days === 9, String(patch.days));

for (const text of [
  "10 days in october",
  "a week in august",
  "two weeks in the summer",
  "travelling in winter",
  "trip in december",
  "5 nights in early may",
  "holiday in spring",
]) {
  const r = detectNamedPlaces(text);
  check(`"${text}" names no place`, r.unknown.length === 0 && r.known.length === 0, r.unknown.join(", "));
}

check(
  "the singular parser agrees",
  !detectNamedPlace("9 days in october").unknown,
  String(detectNamedPlace("9 days in october").unknown),
);

// The guard must not have made the parser deaf to real places.
for (const [text, want] of [
  ["10 days in vietnam", "vietnam"],
  ["road trip in montenegro", "montenegro"],
  ["two weeks in patagonia", "patagonia"],
] as const) {
  const r = detectNamedPlaces(text);
  const found = r.known.includes(want) || r.unknown.some((u) => u.toLowerCase().includes(want));
  check(`"${text}" still finds ${want}`, found, [...r.known, ...r.unknown].join(", ") || "nothing");
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
