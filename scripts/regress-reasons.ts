/**
 * "Why this?" may not tell her she asked for something.
 *
 * Eleven lines in the reason bank are written in the second person -- "You
 * asked for wine", "Markets were on your list", "You said history" -- and
 * forPlace served them off the PLACE's tags, so they fired on a brief where
 * she had chosen nothing at all. Measured across a sweep: 300 trips out of
 * 300. The pitch was fixed for exactly this months ago; the itinerary card
 * behind "Why this?" was never touched.
 *
 * The lines are good and they stay. They are gated on whether she typed the
 * word they claim she said. A vibe chip does not count: the chips are our
 * taxonomy, which is the whole reason the rule exists.
 */
import { planTrip } from "@/lib/planner";
import { recommend } from "@/lib/recommend";
import { emptyBrief, emptyProfile } from "@/lib/types";
import { DESTINATIONS } from "@/data/destinations";
import type { Brief } from "@/lib/types";

import { readFileSync } from "node:fs";
import { activityWords } from "@/lib/select";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};
/*
 * Read out of the product rather than retyped.
 *
 * This test had its own narrower copy: it was missing "one of your interests",
 * "was the brief", "half the point", "was near the top of your list" and "what
 * you asked for", so three of the fabricated lines it existed to catch went
 * straight past it. Two regexes for one rule is one regex too many.
 */
const ATTRIB = new RegExp(
  readFileSync("lib/reasons.ts", "utf8")
    .match(/const ATTRIBUTES = new RegExp\(\[([\s\S]*?)\]\.join/)![1]
    .split(",").map((x) => x.trim()).filter((x) => x.startsWith('"'))
    .map((x) => x.slice(1, -1)).join("|"),
  "i",
);
const prof = emptyProfile();
const reasons = (b: Brief) => {
  const t = planTrip(b, recommend(b, prof), prof);
  return t.days.flatMap((d) => d.items).map((i: any) => i.reason as string).filter(Boolean);
};

console.log("\n  why this?\n");

// --- she said nothing: nothing may be attributed to her -------------------
{
  let bad: string[] = [];
  for (const d of DESTINATIONS.slice(0, 12)) {
    const b: Brief = { ...emptyBrief(""), vibes: [] as any, days: 6, namedDestination: d.id };
    bad = bad.concat(reasons(b).filter((r) => ATTRIB.test(r)));
  }
  check("a brief with nothing stated gets nothing attributed to her", bad.length === 0,
    `${bad.length} lines, e.g. ${JSON.stringify(bad.slice(0, 2))}`);
}

// --- a vibe chip is ours, not hers ---------------------------------------
{
  let bad: string[] = [];
  for (const d of DESTINATIONS.slice(0, 12)) {
    const b: Brief = { ...emptyBrief(""), vibes: ["food", "culture"] as any, days: 6, namedDestination: d.id };
    bad = bad.concat(reasons(b).filter((r) => ATTRIB.test(r)));
  }
  check("clicking a vibe chip does not license 'you asked for'", bad.length === 0,
    `${bad.length} lines, e.g. ${JSON.stringify(bad.slice(0, 2))}`);
}

// --- but when she typed the word, the line is true and allowed ------------
{
  const b: Brief = { ...emptyBrief("i want wine, markets and history"),
    vibes: ["food", "culture"] as any, days: 6, namedDestination: "portugal",
    activities: ["wine", "markets", "history"] };
  const rs = reasons(b);
  check("a word she typed may be quoted back", rs.some((r) => ATTRIB.test(r)),
    JSON.stringify(rs.filter((r) => ATTRIB.test(r)).slice(0, 2)));
  check("and every trip still explains every item", rs.length > 0);
}


// --- the line's OWN claim, not its tag's -----------------------------------
/*
 * The gate used to be keyed on the tag a line is filed under, plus a map of
 * that tag's synonyms — but a tag's pool is not one claim. The `coast` pool
 * held "The coast is what balances out the city days you asked for", so
 * "i want beaches and swimming" licensed a sentence asserting she had asked
 * for city days, on trips with no city days in them. Twelve of fifteen.
 *
 * So: for every attributing line that ships, at least one of the line's own
 * words has to be a word she typed.
 */
{
  /*
   * The corpus has to include the messages that broke it. The first version
   * held only phrases with no pronoun in them, so it passed green while the
   * product produced 278 fabricated attributions from "can you plan me a
   * trip" — every one licensed by the word "you".
   */
  const SAID = ["i want beaches and swimming", "modern design, nothing old",
    "i want to go for the wine", "hiking and hot springs", "markets and street food",
    "can you plan me a trip", "what would you suggest", "thank you, i just want somewhere warm",
    "can you plan me a trip to portugal", "where should we go, we have a week"];
  let bad: string[] = [], licensed = 0;
  for (const d of DESTINATIONS) for (const said of SAID) {
    const b: Brief = { ...emptyBrief(said), vibes: [] as any, days: 7,
      namedDestination: d.id, activities: [said] };
    const hers = new Set(activityWords(said));
    for (const r of reasons(b).filter((x) => ATTRIB.test(x))) {
      if (activityWords(r).some((w) => hers.has(w))) licensed++;
      else if (bad.length < 3) bad.push(`"${said}" → ${r}`);
      else bad.push("x");
    }
  }
  check("every attributed line names something she actually typed",
    bad.length === 0, `${bad.length} fabricated, e.g.\n        ${bad.slice(0, 2).join("\n        ")}`);
  check("and the gate isn't just silencing everything", licensed > 0, `${licensed} licensed`);

  /*
   * The check above compares the line's words with hers using the product's
   * own splitter, so a word that is wrong to license on BOTH sides passes it.
   * That is how "you" got through: it is in her sentence and in every one of
   * the bank's attributing lines, so each side agreed and 278 fabrications
   * scored clean. This check shares nothing with the product — a message that
   * names nothing to do may produce no attributed line at all, whatever words
   * are in it.
   */
  for (const said of ["can you plan me a trip", "what would you suggest", "where should we go",
    "thank you, that's helpful", "can you help me plan something"]) {
    const b: Brief = { ...emptyBrief(said), vibes: [] as any, days: 7,
      namedDestination: DESTINATIONS[0].id, activities: [said] };
    const lines = reasons(b).filter((x) => ATTRIB.test(x));
    check(`"${said}" licenses nothing`, lines.length === 0,
      `${lines.length}, e.g. ${JSON.stringify(lines[0] ?? "")}`);
  }
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
