/**
 * Nothing she said gets thrown away.
 *
 * Live run, her own path:
 *
 *   "i wanna go see the northern lights in canad"
 *   "Mix in a city or two as well"
 *   -> Vancouver & Whistler, seven days, and the trip's own copy reading
 *      "don't come expecting northern lights over Whistler village."
 *
 * The country was right. The reason for going was gone. `interestEcho` is her
 * own phrasing of what the trip is FOR, and it was last-write-wins, so the
 * model's echo of the second sentence ("nature and city") replaced the first
 * ("northern lights"). Everything downstream was then aimed at the wrong
 * thing: the research, the bases, the pitch, and the line in WHY I PICKED
 * THIS that said "you said nature, city".
 *
 * Her rule, from the night of the LA trip: it shouldn't remove any context
 * that was given. If she wants to start fresh she starts a new session.
 */
import { applyPatch, interestLine } from "@/lib/brief";
import { emptyBrief, type Brief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};
const echo = (b: Brief) => b.interestEcho ?? "";

console.log("\n\x1b[1mA SECOND SENTENCE ADDS TO THE FIRST\x1b[0m\n");

// --- the aurora --------------------------------------------------------
{
  let b = applyPatch(emptyBrief(), { interestEcho: "northern lights" });
  b = applyPatch(b, { interestEcho: "nature and city" });
  check("the northern lights survive the city", /northern lights/i.test(echo(b)), echo(b));
  check("and the city is there too", /city/i.test(echo(b)), echo(b));
  check("the research is aimed at both", /northern lights/i.test(interestLine(b)), interestLine(b));
}

// --- three turns, nothing lost -----------------------------------------
{
  let b = applyPatch(emptyBrief(), { interestEcho: "onsen and snow" });
  b = applyPatch(b, { interestEcho: "good food" });
  b = applyPatch(b, { interestEcho: "not too much driving" });
  for (const want of ["onsen", "good food", "driving"]) {
    check(`"${want}" is still there after three turns`, echo(b).includes(want), echo(b));
  }
}

// --- but it does not repeat itself -------------------------------------
{
  let b = applyPatch(emptyBrief(), { interestEcho: "northern lights" });
  b = applyPatch(b, { interestEcho: "northern lights" });
  check("saying it twice says it once", echo(b) === "northern lights", echo(b));

  let c = applyPatch(emptyBrief(), { interestEcho: "northern lights" });
  c = applyPatch(c, { interestEcho: "northern lights and a city or two" });
  check("a fuller wording replaces the shorter one",
    echo(c) === "northern lights and a city or two", echo(c));

  let d = applyPatch(emptyBrief(), { interestEcho: "northern lights and a city or two" });
  d = applyPatch(d, { interestEcho: "northern lights" });
  check("and a thinner one does not shrink it",
    echo(d) === "northern lights and a city or two", echo(d));
}

// --- a silent patch is not an erasure ----------------------------------
{
  let b = applyPatch(emptyBrief(), { interestEcho: "northern lights" });
  b = applyPatch(b, { days: 7 });
  check("a patch about days leaves the reason alone", echo(b) === "northern lights", echo(b));
}

// --- it cannot grow forever --------------------------------------------
{
  let b = applyPatch(emptyBrief(), { interestEcho: "northern lights" });
  for (let i = 0; i < 40; i++) b = applyPatch(b, { interestEcho: `thing number ${i} that she mentioned` });
  check("a long conversation stays a usable prompt", echo(b).length <= 240, `${echo(b).length} chars`);
  check("the reason she came is the part that is kept",
    echo(b).startsWith("northern lights"), echo(b).slice(0, 60));
  check("and so is the last thing she said",
    echo(b).includes("thing number 39"), echo(b).slice(-60));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
