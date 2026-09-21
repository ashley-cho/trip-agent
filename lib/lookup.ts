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
 * This is the lookup, and the test it applies is not "is there anything else
 * in the message". That was the first version and it was wrong in both
 * directions. Asked why "japan but somewhere cheap" stopped, I answered "that
 * is intent" - a label, not an analysis - and then checked:
 *
 *   "japan but not tokyo"    -> avoidPlaces ["tokyo"], constraints ["not tokyo"]
 *   "japan on a budget"      -> budgetUsd 1750, budgetInferred "on a budget"
 *   "japan but somewhere cheap"          -> nothing. The word vanishes.
 *   "japan with my mum who cant walk far" -> nothing. The clause vanishes.
 *
 * So the parser handles some of it correctly and DROPS the rest in silence,
 * and the first gate refused all four equally. It was too strict about the
 * two it could do, and the reason it gave for the other two was wrong.
 *
 * The real test is whether everything she typed went SOMEWHERE. Not whether
 * the message is short, not whether it is only a name: whether any word of
 * hers would be quietly thrown away by answering. That is the same question
 * `words_survive` asks in the evals, asked at the moment it matters.
 *
 * One honest limit, worth writing down because it is not obvious: this
 * catches words that go nowhere, not words that go somewhere WRONG. The Bali
 * failure produced a patch - it read a refusal as a preference - and a patch
 * is all this gate can see. Region and climate now have their own direction
 * handling and their own tests; this is not a second line of defence for
 * them.
 */
import { resolvePlaceName } from "@/lib/places";
import { CITIES } from "@/data/destinations";
import { interpretRules } from "@/lib/discovery";
import { emptyBrief } from "@/lib/types";
import type { BriefPatch } from "@/lib/agent/types";
import { fold } from "@/lib/text";

/**
 * Words that carry no intent of their own.
 *
 * Every one of these is grammar or a bare statement of wanting to go, which
 * is already implied by using a travel app. Nothing here changes what she
 * gets. Anything NOT here is treated as meaning, and meaning stops the
 * lookup.
 */
export const CARRIER = new Set([
  "i", "id", "ive", "im", "we", "wed", "weve", "were", "my", "me", "us",
  "a", "an", "the", "to", "in", "at", "of", "for", "and", "please", "hi", "hey",
  "wanna", "want", "wants", "wanting", "like", "love", "need", "thinking",
  "go", "going", "goto", "visit", "visiting", "see", "seeing", "travel",
  "traveling", "travelling", "trip", "holiday", "vacation", "plan", "planning",
  "lets", "let", "take", "do", "doing", "next", "about", "maybe", "then",
  "day", "days", "night", "nights", "week", "weeks",
  // Conjunctions and prepositions that only join two things. They carry no
  // meaning of their own: whatever they join still has to account for itself.
  // "japan but not tokyo" hangs the whole message on "not tokyo", which the
  // parser reads; "but" is just the hinge, and refusing over it was refusing
  // over punctuation.
  "but", "or", "with", "also", "just", "still", "on", "from", "somewhere",
  // More ways of saying "go": "i'm flying to lisbon", "heading to denmark",
  // "eat my way through a city". Each of these stopped a turn whose place
  // had already been read correctly, over the verb that carried her there.
  "fly", "flying", "heading", "headed", "head", "way", "through", "off",
  // Degree and quantity. "Maybe some food and wine" stopped on "some".
  "some", "any", "lots", "lot", "bit", "really", "very", "quite", "rather",
  "ideally", "preferably", "mostly", "definitely", "probably", "would", "should",
  // "I can drive", "somewhere I can get to", "nowhere decided": the ability
  // and the deciding are grammar; what she can do is the word after them.
  "can", "could", "get", "by", "decided", "planned", "yet", "got",
]);

/** "ten days" and "10 days" are the same length. */
const WORD_NUMBER: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
};

export interface Lookup {
  destinationId: string;
  cityId?: string;
  /** Everything else she said, as the parser read it. Empty when she said only the name. */
  patch: BriefPatch;
}

/**
 * Did this word go anywhere?
 *
 * The first version read the patch back: the budget phrase it echoed, the
 * constraint it quoted, the place it refused. That is a list, and it failed
 * the way lists fail. It could not see the words that produced
 * `namedDestination`, so "Northern lights, and I can drive." — which the
 * parser reads correctly as Iceland — counted "lights" and "drive" as words
 * that went nowhere, and the turn stopped. Measured against the app's own
 * twelve suggested openers, printed in the box she types into, NONE of them
 * survived. The app was refusing every prompt it offered her.
 *
 * So the question is asked directly instead: take the word out, parse again,
 * and see whether anything changed. A word that changes the reading landed
 * somewhere. A word that changes nothing is a word that would be silently
 * thrown away, which is the whole thing this gate exists to catch.
 *
 * No list to keep in step with the parser, and adding a field to BriefPatch
 * can no longer quietly narrow the gate.
 */
/**
 * The same question asked of a whole message rather than a remainder: which
 * of her words would be thrown away by answering this?
 */
export function orphanWords(said: string, brief?: unknown): string[] {
  void brief;
  return orphans(said, said, interpretRules(said, emptyBrief(said)));
}

/*
 * An aside is a word kept, not a word read. `asides` holds what the parser
 * refused to act on ("with my mum who can't walk far") so that it survives
 * on the brief; it is exactly the case this gate exists to refuse, because
 * a plan that ignores it is a plan that dropped it. So asides do not count
 * as landing.
 */
/*
 * With one exception: a short aside is a reason or a companion ("work",
 * "my mum", "the scenery"), which nothing in a plan could act on and which
 * refusing would only cost a turn. A long one carries a qualifier the plan
 * would be ignoring ("with my mum who can't walk far"), and that is the
 * case to refuse.
 */
const acted = (p: BriefPatch): string => JSON.stringify({
  ...p,
  asides: p.asides?.filter((a) => a.trim().split(/\s+/).length <= 3),
});

function orphans(rest: string, said: string, patch: BriefPatch): string[] {
  const whole = acted(patch);
  const words = rest.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const key = fold(words[i]).replace(/[^a-z0-9]/g, "");
    if (!key || CARRIER.has(key)) continue;
    /*
     * A compass word in front of a place name is a request about WHERE in
     * it, and the neighbour rule below would call it landed because cutting
     * "northern spain" out whole changes the reading. It has only landed
     * when the reading picked a base for it. Andalusia for "northern spain"
     * is the name landing and the direction going nowhere.
     */
    if (key in COMPASS) {
      const after = words[i + 1] && fold(words[i + 1]) === "of" ? i + 2 : i + 1;
      const place = words[after] ? fold(words[after]).replace(/[^a-z0-9]/g, "") : "";
      if (place && resolvePlaceName(place, { exact: true }) && !patch.focusCityId) { out.push(key); continue; }
    }
    const less = [...words.slice(0, i), ...words.slice(i + 1)].join(" ");
    /*
     * Two words that say one thing are both accounted for.
     *
     * Dropping "northern" from "northern lights" can leave the reading
     * unchanged if "lights" alone still reaches it, which would mark a word
     * that plainly landed as an orphan. So a word is only an orphan when
     * removing it AND its neighbours changes nothing either: if the phrase
     * around it is carrying meaning, the word is part of that phrase.
     */
    if (acted(interpretRules(less, emptyBrief(said))) !== whole) continue;
    const pair = [...words.slice(0, Math.max(0, i - 1)), ...words.slice(i + 2)].join(" ");
    if (acted(interpretRules(pair, emptyBrief(said))) !== whole) continue;
    /*
     * Two words that say the same thing are both accounted for too.
     *
     * "Maybe some food and wine" read as food either way, so removing "food"
     * changed nothing and removing "wine" changed nothing, and both were
     * reported as words that went nowhere. A word the parser reads on its
     * own, onto a field the whole sentence ALSO reached, has landed; what it
     * landed on was simply said twice. The field has to match: "cheap" alone
     * reads as a budget, and "japan but somewhere cheap" reads as no budget
     * at all, which is the word being dropped, not said twice.
     */
    const alone = interpretRules(words[i], emptyBrief(words[i]));
    const fields = Object.keys(alone).filter((k) => k !== "constraints" && k !== "asides");
    if (fields.length && fields.every((k) => (patch as Record<string, unknown>)[k] !== undefined)) continue;
    out.push(key);
  }
  return out;
}

/**
 * Her sentence with the name cut out of it, punctuation and all.
 *
 * The matched tokens are folded and stripped; the message is not. So the span
 * is found again in the original by looking for those words in order with
 * anything non-alphanumeric allowed between them, and removed there.
 */
function without(said: string, matched: string[]): string {
  const gap = "[^\\p{L}\\p{N}]+";
  const re = new RegExp(
    `(^|${gap})${matched.map((w) => w.split("").map(esc).join(`${gap}?`)).join(gap)}($|${gap})`,
    "iu",
  );
  const cut = said.replace(re, " ");
  // If the span could not be found again — an accent folded away, say — the
  // old behaviour is still correct about the words, just not the punctuation.
  return cut === said ? matched.reduce((t, w) => t.replace(new RegExp(w, "i"), " "), said) : cut;
}

const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The whole message, or nothing.
 *
 * Tries the longest runs of words first, so "new zealand" is found before
 * "new" and "costa rica" before "costa". Whatever the run does not cover has
 * to be carrier words or a length, or this gives up.
 */
type Side = "n" | "s" | "e" | "w";
const COMPASS: Record<string, Side> = {
  northern: "n", north: "n", southern: "s", south: "s",
  eastern: "e", east: "e", western: "w", west: "w",
};

/**
 * Destinations that are one side of the country their alias names. A compass
 * word that agrees is dropped; one that disagrees is not something we hold.
 */
const SIDE_OF: Record<string, Side> = {
  andalusia: "s", northernthailand: "n", highlands: "n", southwest: "w", pacificnw: "w",
  bali: "s", cyclades: "s", dalmatia: "s", patagonia: "s",
};

/** "southern france", "south of france", "the north of spain". */
function compassBefore(words: string[], at: number): { side: Side; words: string[] } | undefined {
  const w1 = words[at - 1];
  if (w1 && w1 in COMPASS) return { side: COMPASS[w1], words: [w1] };
  if (w1 === "of" && words[at - 2] && words[at - 2] in COMPASS) {
    return { side: COMPASS[words[at - 2]], words: [words[at - 2], "of"] };
  }
  return undefined;
}

/** The bed furthest to that side of the destination's middle, if the beds are not all on one side. */
function citiesOnSide(destinationId: string, side: Side): string | undefined {
  const beds = CITIES.filter((c) => c.destinationId === destinationId && !c.dayTripOnly);
  if (beds.length < 2) return undefined;
  const axis = side === "n" || side === "s" ? "lat" : "lng";
  const sign = side === "n" || side === "e" ? 1 : -1;
  const mid = beds.reduce((sum, c) => sum + c[axis], 0) / beds.length;
  const on = beds.filter((c) => (c[axis] - mid) * sign > 0);
  if (!on.length || on.length === beds.length) return undefined;
  return on.sort((a, b) => (b[axis] - a[axis]) * sign)[0].id;
}

export function lookupOnly(said: string): Lookup | undefined {
  const words = fold(said).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 14) return undefined;

  for (let len = Math.min(words.length, 6); len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      let hit = resolvePlaceName(words.slice(i, i + len).join(" "), { exact: true });
      if (!hit) continue;

      /*
       * A compass word in front of the name is part of the place, not a
       * want. "southern france" was read as France plus an activity called
       * "southern", which the pitch then answered with the first place whose
       * note happened to say "southern" -- a restaurant -- and the planner
       * based her in Paris. The direction picks the base instead: the bed on
       * that side of the destination's middle. Where every bed is on one
       * side, or none is, the word has said nothing the name did not, and
       * is dropped.
       */
      const compass = compassBefore(words, i);
      const named = compass ? [...compass.words, ...words.slice(i, i + len)] : words.slice(i, i + len);
      if (compass && !hit.cityId) {
        const span = words.slice(i, i + len).join(" ");
        if (span === hit.destinationId) {
          const side = citiesOnSide(hit.destinationId, compass.side);
          if (side) hit = { ...hit, cityId: side };
        } else if (SIDE_OF[hit.destinationId] !== compass.side) {
          // "northern spain" resolves to Andalusia because Andalusia is the
          // Spain we hold. It is the wrong side of the country, and picking
          // its northernmost bed would be answering a question she did not
          // ask. Not a lookup; the gate says what it cannot place.
          return undefined;
        }
      }

      const rest = without(said, named);
      const spare = rest.split(/\s+/)
        .map((w) => fold(w).replace(/[^a-z0-9]/g, ""))
        .filter((w) => w && !CARRIER.has(w));
      // Just the name, and nothing else to account for.
      if (!spare.length) return { ...hit, patch: {} };

      /*
       * Something else is in there. Ask the parser what it makes of it, and
       * then check that what it made covers every word she used. A non-empty
       * patch is not enough: "on a budget with my mum" produces a budget and
       * silently loses the person she is travelling with.
       *
       * Handed HER text, not the folded words. `words` exists to match a
       * name, and getting there costs the punctuation: "1-2" is two tokens by
       * the time the matcher has finished with it. Rejoining those and
       * parsing "for 1 2 weeks" read a one-to-two-week trip as fourteen days,
       * so "i wanna go to croatia for 1-2 weeks" was refused on a number she
       * had not typed — the exact bug the range work was meant to have fixed,
       * still live, because every test of it called the parser directly and
       * the only path that reaches it in production goes through here.
       */
      const patch = interpretRules(rest, emptyBrief(said));
      // A second, different destination in the remainder is ambiguity, and
      // ambiguity is exactly what a model is for.
      if (patch.namedDestination && patch.namedDestination !== hit.destinationId) return undefined;

      const orphan = orphans(rest, said, patch);
      if (orphan.length) return undefined;
      return { ...hit, patch };
    }
  }
  return undefined;
}
