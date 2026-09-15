/**
 * Naming a place we hold is a lookup, not an interpretation.
 *
 * "i wanna visit japan" got: I'm stopping here, this deployment's Anthropic
 * account is out of credit. Japan is in the catalogue with seven bases and a
 * hundred and eleven places, all of it either hand-written or validated, and
 * the scheduler that would build the trip is arithmetic with no model in it
 * anywhere. The app refused to answer a question it could answer completely.
 *
 * That was my rule applied too widely. The reason comprehension has no floor
 * is that regexes INVENT meaning: "don't want south east asia" became a
 * shortlist of Southeast Asia, "just not overwhelmingly" became a place
 * called "overwhelmingly not". Every one of those failures is a parser
 * guessing at intent.
 *
 * Matching the word "japan" against a list of destinations we hold is not a
 * guess. It is a string comparison against known data, and it is either an
 * exact hit or it is nothing. There is no nuance in it to get wrong.
 *
 * So the line is not "regex versus model". It is:
 *
 *   LOOKUP        does this name a thing we hold?   Deterministic. Safe.
 *   INTERPRETATION what did she mean by all this?   Needs the model.
 *
 * This is the lookup, and it is deliberately unwilling. It answers only when
 * the ENTIRE message is a place we hold plus carrier words and perhaps a
 * length. One leftover content word - "cheap", "not too touristy", "with my
 * mum" - and it returns nothing, because that word is intent and intent is
 * the model's job. A conservative miss costs her a stop she could have been
 * spared. A generous one costs her Bali.
 */
import { resolvePlaceName } from "@/lib/places";
import { fold } from "@/lib/text";

/**
 * Words that carry no intent of their own.
 *
 * Every one of these is grammar or a bare statement of wanting to go, which
 * is already implied by using a travel app. Nothing here changes what she
 * gets. Anything NOT here is treated as meaning, and meaning stops the
 * lookup.
 */
const CARRIER = new Set([
  "i", "id", "ive", "im", "we", "wed", "weve", "were", "my", "me", "us",
  "a", "an", "the", "to", "in", "at", "of", "for", "and", "please", "hi", "hey",
  "wanna", "want", "wants", "wanting", "like", "love", "need", "thinking",
  "go", "going", "goto", "visit", "visiting", "see", "seeing", "travel",
  "traveling", "travelling", "trip", "holiday", "vacation", "plan", "planning",
  "lets", "let", "take", "do", "doing", "next", "about", "maybe", "then",
  "day", "days", "night", "nights", "week", "weeks",
]);

/** "ten days" and "10 days" are the same length. */
const WORD_NUMBER: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
};

export interface Lookup {
  destinationId: string;
  cityId?: string;
  days?: number;
}

/**
 * The whole message, or nothing.
 *
 * Tries the longest runs of words first, so "new zealand" is found before
 * "new" and "costa rica" before "costa". Whatever the run does not cover has
 * to be carrier words or a length, or this gives up.
 */
export function lookupOnly(said: string): Lookup | undefined {
  const words = fold(said).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 14) return undefined;

  for (let len = Math.min(words.length, 6); len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const hit = resolvePlaceName(words.slice(i, i + len).join(" "), { exact: true });
      if (!hit) continue;

      const rest = [...words.slice(0, i), ...words.slice(i + len)];
      let days: number | undefined;
      const leftover: string[] = [];
      for (const w of rest) {
        if (CARRIER.has(w)) continue;
        const n = /^\d+$/.test(w) ? Number(w) : WORD_NUMBER[w];
        // A number only reads as a length next to a length word, or this
        // turns "route 66" into a 66-day trip.
        if (n !== undefined && n >= 1 && n <= 60 && rest.some((x) => /^(day|days|night|nights|week|weeks)$/.test(x))) {
          days = rest.some((x) => /^(week|weeks)$/.test(x)) ? n * 7 : n;
          continue;
        }
        leftover.push(w);
      }
      // Anything left is meaning, and meaning is not ours to guess at.
      if (leftover.length) return undefined;
      return { ...hit, days: days && days >= 2 && days <= 60 ? days : undefined };
    }
  }
  return undefined;
}
