/**
 * What a day card says when it is shut.
 *
 * A collapsed day is one line: "Day 3 · Wed, Oct 8" and a headline. The
 * headline is the only thing on that card that says where you are going that
 * day, and on a 390px screen the box holding it is 264px wide.
 *
 * The planner writes those headlines as `${cityName}: ${neighbourhood} and
 * around` (lib/planner.ts, themeFor). On a single-base trip that put the same
 * destination in front of every day: five of eight cards read "the Olympic
 * Peninsula: …" and then ran out of room, so what got dropped to the ellipsis
 * was Quinault, Hoh, La Push — the one word per card that was not already
 * printed on the other seven, and the one word the reader needed.
 *
 * THE DECISION, since there were two on offer.
 *
 * Both. Neither is sufficient on its own, and each fixes something the other
 * does not:
 *
 *  - Dropping the shared prefix is what makes the line INFORMATIVE. It is not
 *    a width trick: on a trip with one base the destination is already printed
 *    once, in the h2 directly above this list, so repeating it eight times
 *    spends the widest part of every headline restating something the reader
 *    has just read. Take it away and "Quinault and around" leads with the only
 *    word that distinguishes day 3 from day 4.
 *
 *  - Letting the headline WRAP is what makes it correct. Prefix-stripping
 *    alone does not fix the phone: "Land in Seattle, do nothing much" carries
 *    no prefix at all and still needs 277px of the 264px available. A headline
 *    is prose written by the planner, not a fixed-width field, so any single
 *    line will eventually be too long for some screen. `truncate` on a box
 *    that holds a whole sentence is the bug; two lines is not.
 *
 * The prefix is only dropped when it is genuinely redundant: exactly one
 * distinct prefix across the whole trip, carried by at least two days. On a
 * Lisbon-and-Porto trip the prefixes DIFFER, which means they are doing work —
 * they are the only thing on a shut card that says which city — so they stay,
 * and the wrapping carries the width instead.
 */

/** The "City: " part of a headline, if it has one. */
const prefixOf = (theme: string): string | undefined => {
  const at = theme.indexOf(": ");
  return at > 0 ? theme.slice(0, at) : undefined;
};

const upperFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * The headlines to print, in day order, given the themes the planner wrote.
 * Pure and total: same length, same order, never empty strings.
 */
export function dayHeadlines(themes: readonly string[]): string[] {
  const prefixes = new Set(
    themes.map(prefixOf).filter((p): p is string => p !== undefined),
  );
  if (prefixes.size !== 1) return [...themes];

  const only = [...prefixes][0];
  const carriers = themes.filter((t) => prefixOf(t) === only);
  // One day wearing the prefix is not a repetition, it is a label.
  if (carriers.length < 2) return [...themes];

  return themes.map((t) => {
    if (prefixOf(t) !== only) return t;
    const rest = t.slice(only.length + 2).trim();
    // Never hand back an empty card. A headline that is nothing but the
    // prefix keeps it.
    return rest ? upperFirst(rest) : t;
  });
}
