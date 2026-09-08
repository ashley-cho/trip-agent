/**
 * Regression: the London business trip.
 *
 * "i'm going to london for a business trip, and i wanna extend the trip."
 * Three failures in four exchanges:
 *
 * 1. "Understood, that just doesn't settle it on its own." was stamped onto
 *    three different, perfectly good questions in a row. Every model-authored
 *    question carries the id "open", and the repeat guard was keyed on the id,
 *    so each new question looked like the last one asked again.
 * 2. "i'm open to traveling nearby countries" was read as a place called
 *    Nearby Countries and sent off to be researched, which is where the forty
 *    seconds went.
 * 3. The extension was priced from her home airport instead of from London, so
 *    a week hanging off a London work trip came back as Mexico City and Oaxaca,
 *    on the grounds that it was "a short flight".
 */
import { extensionOriginFromText, originFromText } from "@/lib/origin";
import { interpretRules } from "@/lib/discovery";
import { isPlaceName } from "@/lib/agent/llm";
import { emptyBrief } from "@/lib/types";
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mTHE EXTENSION LEAVES FROM LONDON\x1b[0m\n");

// 3. Origin.
{
  const her = "i'm going to london for a business trip, and i wanna extend the trip. give me some inspirations";
  check("her message departs from London", extensionOriginFromText(her)?.label === "London",
    String(extensionOriginFromText(her)?.label));
  check("and the rules parser puts it in the brief",
    interpretRules(her, emptyBrief()).origin?.label === "London",
    String(interpretRules(her, emptyBrief()).origin?.label));
}
for (const [text, label] of [
  ["going to tokyo for work, thinking of adding a few days", "Tokyo"],
  ["i'm in berlin for a conference, want to extend", "Berlin"],
  ["flying to lisbon for a wedding and staying on after", "Lisbon"],
] as const) {
  check(`"${text}" departs from ${label}`,
    extensionOriginFromText(text)?.label === label,
    String(extensionOriginFromText(text)?.label));
}
// A plain destination is still a destination, not an origin.
for (const text of ["i want to go to tokyo", "two weeks in lisbon", "take me to berlin"]) {
  check(`"${text}" is not read as an origin`, originFromText(text) === null,
    String(originFromText(text)?.label));
}

// 2. Generic phrases are not places to research.
for (const junk of [
  "nearby countries", "somewhere new", "another city", "other places",
  "a few nearby countries", "different destinations", "anywhere", "the continent",
]) {
  check(`"${junk}" is not a place to go and research`, !isPlaceName(junk));
}
for (const real of [
  "Costa Brava", "Indian Wells", "the Yucatan", "Nearby Islands of Croatia",
  "Cape Town", "Isle of Skye",
]) {
  check(`"${real}" still is`, isPlaceName(real));
}
{
  const llm = readFileSync("lib/agent/llm.ts", "utf8");
  check("generic scope words exist to stop this", /GENERIC_SCOPE/.test(llm));
  check("and the origin prompt knows an extension departs from where they'll be",
    /departs from London/.test(llm));
}

// 1. The repeat guard keys on the sentence, not the id.
{
  const page = readFileSync("app/page.tsx", "utf8");
  check("the repeat guard keys on the question's words",
    /askedRef\.current === key/.test(page) && /q\.prompt\.trim\(\)\.toLowerCase\(\)/.test(page));
  check("and stopping is wired to the composer",
    /onStop=\{stop\}/.test(page) && /abortInFlight/.test(page));
  const client = readFileSync("lib/client.ts", "utf8");
  check("a cancelled call throws rather than quietly answering from the rules",
    /if \(wasCancelled\(e\)\) throw new Cancelled\(\)/.test(client));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
