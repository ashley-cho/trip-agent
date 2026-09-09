/**
 * Where one thing she said ends and the next begins.
 *
 * Four modules had learned, separately, to scope a rule to the clause that
 * carries it — the "already been" veto, the more/less polarity in an edit, the
 * refusal in an activity phrase, the month a refusal governs. All four split on
 * commas, full stops, "and" and "but", and none of them split on the
 * punctuation people actually type. So every one of those fixes had the same
 * hole in it, and the same criticals came back through a hyphen:
 *
 *   "fewer museums - more food"            deleted every restaurant, 15 of 15
 *   "i've been to bali - i want somewhere new"   recommended Bali, 15 of 15
 *   "no museums - hot springs please"       asked for nothing at all
 *   "not august - october please"           planned August
 *
 * A dash is her own style: the message this repo's oldest regression test is
 * built on is "i wanna go on a road trip - i've been to bryce canyon...".
 *
 * So the rule lives here once. A hyphen only breaks a clause with space around
 * it, because "step-free" and "must-see" are single words.
 */

/** Everything that ends a clause. Capture-free, for use inside larger patterns. */
export const CLAUSE_BREAK = /[,;:/&\n]|\s[-–—]\s/;

/** The same, as an alternation body — for splitting where "and"/"but" also count. */
export const CLAUSE_BREAK_SOURCE = "[,;:/&\\n]|\\s[-–—]\\s";

/** The index of the first clause break in `text`, or -1. */
export function firstBreak(text: string, extra = ""): number {
  return text.search(new RegExp(`${CLAUSE_BREAK_SOURCE}${extra ? `|${extra}` : ""}`, "i"));
}
