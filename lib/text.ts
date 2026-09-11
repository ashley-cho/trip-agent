/**
 * One way to compare two pieces of text, for the whole app.
 *
 * There were five of these. lib/select.ts, lib/planner.ts, lib/places.ts,
 * lib/discovery.ts and lib/agent/llm.ts each grew a private `fold`, and they
 * were all almost the same and none of them were exactly the same: one kept
 * spaces, one stripped them, one stripped a leading "the", one didn't, and
 * seventy-six other places called .toLowerCase() inline and hoped. That is a
 * matcher with five different opinions about whether "South-East Asia" and
 * "south east asia" are the same string, and the answer being different in
 * different files is how an exclusion gets dropped between the parser and the
 * recommender.
 *
 * Two functions, because there are exactly two questions:
 *
 *   fold  "is this word in that sentence?"  Keeps word boundaries.
 *   key   "are these the same name?"        Removes everything but letters
 *                                           and digits, so spaces, hyphens,
 *                                           accents and punctuation cannot
 *                                           make one name into two.
 *
 * Both are lowercase, always, at every boundary: reading her message, reading
 * the catalogue, reading a row out of the database. Case is never information
 * here, and every place that treated it as information was a bug waiting.
 */

/** Lowercase, accents removed, whitespace collapsed. Word boundaries survive. */
export function fold(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * An identity, not a sentence. "South-East Asia", "south east asia" and
 * "southeast asia" all become "southeastasia", which is the entire point:
 * nobody types a region the same way twice and all three mean one place.
 * A leading "the" goes, because "the Cyclades" is the Cyclades.
 */
export function key(s: string): string {
  return fold(s).replace(/^the /, "").replace(/[^a-z0-9]/g, "");
}

/** Whole-word containment, folded. The check almost every caller actually wants. */
export function says(haystack: string, needle: string): boolean {
  const n = fold(needle);
  if (!n) return false;
  return new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(fold(haystack));
}
