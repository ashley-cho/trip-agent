/**
 * Regression: five of eight day headlines were cut off on a phone.
 *
 * At 390px the h3 on a shut day card gets 264px. The planner writes
 * `${cityName}: ${neighbourhood} and around`, so on a single-base trip every
 * card opened with the same destination and then ran out of room:
 *
 *     the Olympic Peninsula: La P…
 *
 * The word the ellipsis ate — La Push, Hoh, Quinault — was the only thing on
 * that card that was not already printed on the other seven, and the only
 * thing the reader was looking for. `npm run regress:render` measures the
 * pixels; this file holds the rule that decides what the string should be, so
 * it can be checked in a second rather than in a browser.
 *
 * See lib/headlines.ts for why the prefix is dropped AND the line wraps
 * rather than either one alone.
 */
import { readFileSync } from "node:fs";
import { dayHeadlines } from "@/lib/headlines";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA DAY HEADLINE THAT FITS ON A PHONE\x1b[0m\n");

/** The trip in the bug report, verbatim from the render run. */
const OLYMPIC = [
  "Land in Seattle, do nothing much",
  "the Olympic Peninsula: Quinault and around",
  "the Olympic Peninsula: Hoh and around",
  "the Olympic Peninsula: La Push and around",
  "the Olympic Peninsula: Port Angeles and around",
  "the Olympic Peninsula: Hurricane Ridge and around",
  "Out to Seattle",
  "Slow morning, then home",
];

{
  const out = dayHeadlines(OLYMPIC);

  check("the destination is not repeated on every day",
    out.every((h) => !/^the Olympic Peninsula: /.test(h)),
    out.filter((h) => /^the Olympic Peninsula: /.test(h)).join(" | "));

  check("the place name survives, which is the whole point",
    ["Quinault", "Hoh", "La Push", "Port Angeles", "Hurricane Ridge"]
      .every((p) => out.some((h) => h.startsWith(p))),
    out.join(" | "));

  check("every day still has a headline, in the same order",
    out.length === OLYMPIC.length && out.every((h) => h.trim().length > 0));

  check("headlines that carry no prefix are left alone",
    out[0] === "Land in Seattle, do nothing much"
    && out[6] === "Out to Seattle"
    && out[7] === "Slow morning, then home");

  /*
   * The width the render check measures. 264px at the 1.3rem serif this card
   * uses is a shade over 30 characters, and every headline that carried the
   * prefix now sits inside it.
   */
  const stripped = out.filter((_, i) => /^the Olympic Peninsula: /.test(OLYMPIC[i]));
  const longest = stripped.reduce((a, b) => (a.length >= b.length ? a : b));
  check("and each of them now fits on one line at 390px",
    longest.length <= 30, `"${longest}" (${longest.length} chars)`);

  /*
   * And the reason the box wraps as well.
   *
   * "Land in Seattle, do nothing much" carries no prefix, so nothing in this
   * file can shorten it, and at 277px it does not fit in 264px either. A
   * headline is a sentence the planner wrote; there will always be one too
   * long for some screen, which is why lib/headlines.ts argues for both
   * halves of the fix rather than picking one. If this ever starts failing,
   * the prefix rule has quietly grown into a length rule and should not have.
   */
  check("a headline with no prefix is still too long for one line, hence the wrap",
    out[0].length > 30, `"${out[0]}" (${out[0].length} chars)`);
}

/*
 * The prefix is dropped because it is REPETITION, not because it is a prefix.
 * On a two-city trip it is the only thing on a shut card that says which city,
 * so it stays and the wrapping carries the width instead.
 */
{
  const twoCity = [
    "Land in Lisbon, do nothing much",
    "Lisbon: Alfama and around",
    "Lisbon: Belém and around",
    "Move to Porto",
    "Porto: Ribeira and around",
    "Porto: Foz and around",
    "Slow morning, then home",
  ];
  const out = dayHeadlines(twoCity);
  check("a prefix that distinguishes two cities is kept",
    out.join("|") === twoCity.join("|"), out.join(" | "));
}

{
  // One day wearing it is a label, not a repetition.
  const once = ["Land in Reykjavik, do nothing much", "Iceland: Vík and around", "Slow morning, then home"];
  check("a prefix used only once is kept", dayHeadlines(once).join("|") === once.join("|"));
}

{
  check("a headline that is nothing but its prefix is never emptied",
    dayHeadlines(["Kyoto: ", "Kyoto: Gion and around"])[0] === "Kyoto: ");
  check("an empty trip is an empty list", dayHeadlines([]).length === 0);
}

/*
 * The other half of the fix, and the half no string test can see: the box
 * itself. `truncate` is white-space:nowrap plus an ellipsis, which is a
 * promise that the content is a fixed-width field. A planner-written sentence
 * is not one. regress:render measures this in a real browser; this line names
 * the defect so a reinstated `truncate` fails in seconds instead of a minute.
 */
{
  const src = readFileSync("components/Itinerary.tsx", "utf8");
  const h3 = src.split("\n").find((l) => /<h3[^>]*text-\[1\.3rem\]/.test(l)) ?? "";
  check("the day headline is not clipped to a single line",
    h3.length > 0 && !/\btruncate\b/.test(h3), h3.trim() || "no day headline h3 found");
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
