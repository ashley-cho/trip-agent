import type { Brief, Place, Tag, TravelerProfile, Vibe } from "@/lib/types";
import { CLAUSE_BREAK_SOURCE } from "@/lib/clauses";
import { ALL_VIBES } from "@/lib/types";
import { placesInCity } from "@/data";
import { PLACES } from "@/data";

/**
 * What each vibe actually cashes out to, split by strength.
 *
 * The previous flat list let `viewpoint` and `coast` stand in for "nature",
 * which made a church tower and a concert hall both count as nature content —
 * so a nature trip filled up with architecture and museums and the scoring
 * reported it as a good match.
 *
 * `core` is what the traveller actually asked for. `support` is adjacent and
 * pleasant, but never enough on its own to justify a slot.
 */
export const VIBE_TAGS: Record<Vibe, { core: Tag[]; support: Tag[] }> = {
  nature:      { core: ["nature", "hike", "beach"],                 support: ["coast", "garden", "viewpoint"] },
  exploration: { core: ["walk", "history", "local"],                support: ["architecture", "viewpoint", "market"] },
  food:        { core: ["food", "wine", "market"],                  support: ["coffee", "local"] },
  relaxation:  { core: ["spa", "garden", "walk"],                   support: ["coast", "viewpoint", "beach"] },
  culture:     { core: ["art", "museum", "architecture", "music"],  support: ["contemporary", "history", "church"] },
  adventure:   { core: ["hike", "boat", "adventure"],               support: ["nature", "coast"] },
  city:        { core: ["nightlife", "music", "shopping", "contemporary"], support: ["local", "market", "food"] },
};

/**
 * Tags that only belong on a trip where they were asked for.
 *
 * Everything not listed here — walk, local, coast, viewpoint, garden, market,
 * food, coffee, history, iconic — is connective: it sits fine on any trip and
 * makes good filler between the things they came for. A harbour walk on a
 * landscape trip is fine. A concert hall is not, and a single `coast` tag on
 * that concert hall should not rescue it.
 */
export const SIGNATURE_TAGS: Record<Vibe, Tag[]> = {
  culture:     ["museum", "art", "architecture", "church", "contemporary", "music"],
  city:        ["nightlife", "shopping"],
  // `nature` is applied to almost anything outdoors in this data, so treating
  // it as signature made a coastal walk "off-brief" on a food trip. Nobody
  // complains about a viewpoint. Effort is the thing you have to ask for.
  nature:      ["hike"],
  adventure:   ["boat", "hike", "adventure"],
  food:        ["wine"],
  relaxation:  ["spa"],
  exploration: [],   // exploration has no exclusive signature — it's the connective vibe
};

export const coreTags = (vibes: Vibe[]): Set<Tag> =>
  new Set(vibes.flatMap((v) => VIBE_TAGS[v].core));

export const supportTags = (vibes: Vibe[]): Set<Tag> =>
  new Set(vibes.flatMap((v) => VIBE_TAGS[v].support));

export function favoredTags(brief: Brief, profile: TravelerProfile): Set<Tag> {
  const s = new Set<Tag>(profile.favorTags);
  for (const v of brief.vibes) {
    for (const t of VIBE_TAGS[v].core) s.add(t);
    for (const t of VIBE_TAGS[v].support) s.add(t);
  }
  return s;
}

export function avoidedTags(brief: Brief, profile: TravelerProfile): Set<Tag> {
  return new Set<Tag>([...brief.avoidTags, ...profile.avoidTags]);
}

export interface Candidate {
  place: Place;
  score: number;
  /** Matches something they actually asked for, core or adjacent. */
  relevant: boolean;
  /**
   * Carries the signature of a vibe they did NOT pick, and nothing of one they
   * did — an art museum on a landscape trip. Neutral things (a walk, a
   * viewpoint) are neither relevant nor foreign, and make perfectly good
   * filler; foreign things are what make a trip feel like it wasn't listening.
   */
  foreign: boolean;
}

/**
 * Score every place in a city for this traveler. Hard exclusions (avoided tags,
 * previously rejected) drop out entirely — section 32 requires that we never
 * re-suggest something they turned down.
 */
/**
 * Does this place serve something she said she wanted to do?
 *
 * Text, not tags. Tags are a closed list of 28 and none of them is "surfing",
 * which is the whole reason activities exists: matching her words against a
 * taxonomy just reproduces the loss one layer down. So her words are matched
 * against what the place actually says about itself.
 *
 * Deliberately generous on stems ("surf" matches "surfing", "surf break",
 * "surfers") and deliberately blind to filler, so "hike a national park" is
 * carried by "hike" and "park" rather than by "a".
 */
const FILLER = new Set(["a","an","the","and","or","of","in","on","at","to","for","with","some","any",
  "my","our","we","i","want","wants","wanna","like","see","do","go","going","really","bit","lot","lots",
  // Added after a whole-sentence activity decomposed into 120 matches: these
  // are the words that carried it, and none of them is a thing to do.
  "into","whole","just","around","all","old","love","loves","would","well","open","day","days",
  "much","more","proper","properly","real","good","nice","thing","things","stuff","time","times",
  "spend","spending","plan","plans","place","places","trip","trips","want","wanting","kind","sort",
  // Politeness and hedging. Once a refusal stopped swallowing the rest of the
  // sentence, "no early starts, markets please" started reporting "pleas" as
  // something she wanted done.
  "please","pls","thanks","thank","also","maybe","rather","prefer","prefers","preferably",
  "definitely","need","needs","hope","hoping","get","got","take","taking",
  /*
   * Pronouns, and the words a request is made OF.
   *
   * "you" is three letters, survives the stemmer, and appears in every one of
   * the eleven sentences in the reason bank that quote her back to herself. So
   * "can you plan me a trip" put the word "you" in her licence set and opened
   * the whole gate: 278 fabricated attributions across 60 trips, from a
   * message that names nothing at all. The gate was right; its alphabet was
   * full of words that are not things to do.
   */
  "you","your","yours","youre","she","her","him","his","they","them","their","its",
  "can","could","should","will","would","shall","might","must","may",
  "what","which","who","how","why","when","where","whats","who's",
  "give","gives","make","makes","help","helps","suggest","suggests","recommend","recommends",
  "show","shows","tell","tells","find","finds","pick","picks","choose","chooses",
  "trip","holiday","vacation","travel","travelling","traveling","visit","visiting",
  "somewhere","anywhere","everywhere","something","anything","everything",
  "not","dont","doesnt","didnt","cant","cannot","wont","wouldnt","isnt","arent",
  "was","were","are","been","being","have","has","had","did","does","done","out",
  "one","two","three","four","five","six","seven","eight","nine","ten","week","weeks",
  "there","here","then","than","that","this","these","those","about","over","from",
  "but","and","because","really","very","quite","bit","little","few","many","most"]);

/**
 * A refusal is not a request.
 *
 * "no museums" produced the identical word set to "museums" and then boosted
 * museums by the largest weight in the scorer: scheduled museums went from one
 * to three. "nothing touristy" is the LLM schema's own documented example and
 * raised touristy places from two to three. Everything after the refusal is
 * dropped.
 */
const REFUSAL = new RegExp("\\b(" + [
  "no", "not", "nothing", "none", "never", "avoid", "without", "hate", "hates", "skip",
  "rather not", "don'?t", "dont", "less", "fewer",
  /*
   * Refusals that are not the word "no".
   *
   * "i can't stand museums" produced ["can","stand","museum"] and then boosted
   * museums by the largest single weight in the scorer, and licensed "One
   * museum, not a week of them. You were clear about that." She was clear —
   * about the opposite. Same for cannot, won't, dislike, and "museums are out".
   */
  "can'?t", "cant", "cannot", "won'?t", "wont", "dislikes?", "sick of", "tired of",
  "bored of", "over it", "steer clear", "keep away", "rule out", "ruled out",
  // "I'm done with museums", "we've had enough of museums", "museums bore me",
  // "except museums", "apart from museums" — all read as requests for museums.
  "done with", "had enough", "enough of", "except", "apart from", "other than",
  "sick to death of", "bores? (me|us)", "bored (me|us)",
].join("|") + ")\\b|\\b(are|is) out\\b", "i");

/**
 * "Anything but X" refuses X, in a clause with no refusal word in it.
 *
 * `but` flips polarity, which is right for "hiking but no crowds" and exactly
 * wrong here: the tail clause is the refused thing, and it arrived with the
 * +0.6 `asked` weight — the largest single term in the scorer. On "anything
 * but museums" a museum was in the top five for 15 of 42 cities, and the
 * reason bank answered with "One museum, not a week of them. You were clear
 * about that." She was clear. About the opposite.
 */
// Global: without the g, only the FIRST "anything but X" was rewritten, so
// "anything but museums, anything but churches" asked for churches — and gave
// them the +0.6 asked weight in 18 of 42 cities.
const ONLY_NOT = /\b(any|every)(thing|where|one)\s+but\b/gi;

/**
 * Words that mark a clause as a request rather than a continuation.
 *
 * "and" joins clauses of the same polarity as often as it changes them: "no
 * early starts and late nights" refuses both, while "no crowds and i want
 * markets" refuses one and asks for the other. What separates them is whether
 * the second clause asks for anything. Without a marker, an "and" after a
 * refusal keeps refusing — the safe direction, since the alternative is
 * boosting the exact thing she ruled out.
 */
const WANTS = /\b(want|wants|wanna|would like|like|likes|love|loves|please|keen|into|more|do|prefer|hoping|after|looking for)\b/i;

/**
 * One stemmer, applied to BOTH sides, and then exact comparison.
 *
 * Prefix matching cannot win here. Long prefixes collide ("surf" in "surface",
 * "ski" in "skip"); short ones are rejected as unsafe, which is how "hiking"
 * came to match nothing in any of the eleven destinations that have hikes,
 * while the app cheerfully told her "Nothing I have for Iceland does that".
 *
 * Stemming both sides removes the trade entirely: hiking and hike both reduce
 * to hik and match each other; surfing reduces to surf and surface to surfac,
 * which do not.
 */
function stem(w: string): string {
  const x = w.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Only strip a suffix that leaves a real word behind. Ungated, "beer" lost
  // its "er" and then its "e" and became "b", so beer was neither matched nor
  // reported as unserved: it vanished without a trace.
  const cut = (re: RegExp, min: number) => {
    const y = x.replace(re, "");
    return y.length >= min ? y : x;
  };
  let y = cut(/(ings|ing)$/, 3);
  if (y === x) y = cut(/(ers|er)$/, 4);
  if (y === x) y = cut(/(ies|es|s)$/, 3);
  return y.length > 3 ? y.replace(/e$/, "") : y;
}

/**
 * What she is asking FOR, in one phrase.
 *
 * A refusal governs its own clause, not the rest of the sentence. This used to
 * cut the whole string at the first refusal word, so "no early starts, markets
 * please" produced nothing at all: the "no" landed at index 0 and took
 * "markets" down with it. She said markets. Losing it is the failure this
 * whole path exists to prevent.
 *
 * So the phrase is split into clauses first, each clause is cut at its own
 * refusal, and what survives anywhere is what she wants. "Hiking but no
 * crowds" keeps hiking; "no wine, i hate wine" keeps nothing, correctly.
 */
export function activityWords(activity: string): string[] {
  const words: string[] = [];
  // Separators kept, because "but" flips polarity and "and" usually doesn't.
  // "anything but X" is a refusal of X with no refusal word in the clause, and
  // its "but" would otherwise flip the polarity the wrong way.
  const text = activity.replace(ONLY_NOT, "not");
  // Same clause rule as everywhere else: "no museums - hot springs please" used
  // to yield nothing at all, and `unserved` did not report it either.
  const parts = text.split(new RegExp(`([,;.]|${CLAUSE_BREAK_SOURCE}|\\band\\b|\\bbut\\b|\\bthough\\b)`, "i"));
  let refusing = false;
  for (let i = 0; i < parts.length; i += 2) {
    const clause = parts[i];
    const joiner = (parts[i - 1] ?? "").trim().toLowerCase();
    const m = clause.match(REFUSAL);
    /*
     * A full stop, a semicolon or a comma ends the refusal; "and" continues
     * it. The carry was written for "and" and applied to every joiner, so
     * "no early starts, surfing" produced nothing at all — she said surfing,
     * got no surfing, and `unserved` did not report it either. The flagship
     * string only passed because "please" happens to be a want-marker.
     */
    if (joiner === "," || joiner === ";" || joiner === ".") refusing = false;
    if (joiner === "but" || joiner === "though") refusing = false;
    /*
     * A refusal carries across "and" unless the next clause asks for
     * something. "no crowds and i want markets" keeps markets; "no early
     * starts and late nights" keeps neither. Before this, "and" wasn't a
     * separator at all, so "no crowds and i want markets" produced nothing —
     * she said markets, got no markets, and `unserved` didn't even report it,
     * which is the exact failure this path exists to prevent.
     */
    if (m || (refusing && !WANTS.test(clause))) {
      refusing = true;
      if (!m) continue;
    } else {
      refusing = false;
    }
    /*
     * A refusal at the END of a clause negates the clause, not what follows.
     *
     * Cutting at the refusal assumes it comes first — "no museums". "Museums
     * are out" puts it last, so the cut kept "museums" and the scorer read a
     * refusal as the strongest request in the sentence.
     */
    const after = m?.index === undefined ? "" : clause.slice(m.index + m[0].length);
    const postfix = m !== null && !contentWords(after).length;
    const wanted = m?.index === undefined ? clause : postfix ? "" : clause.slice(0, m.index);
    words.push(...contentWords(wanted));
  }
  return [...new Set(words)];
}

/** The words in a phrase that name something, stemmed. */
function contentWords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 3 && !FILLER.has(w))
    .map(stem)
    .filter((w) => w.length >= 3);
}

/**
 * Strip accents before anything else looks at the letters.
 *
 * Every reader here lowercases and then deletes non-[a-z0-9], so "Gaudí"
 * became the token "gaud" and could never equal the typed "gaudi", and
 * "Teotihuacán" became "teotihuac". A trip built around Sagrada Família then
 * reported that it had nothing for gaudi.
 */
/*
 * What may follow a prefix match. An inflection of the same word is not a
 * different word, so "climb" does not serve on "climbed"; anything else may
 * be a compound built on it — "designmuseum", "cultural", "galleria",
 * "pastry", "mezcaleria" — and does.
 */
import { fold } from "@/lib/text";

const COMPOUND = /^(?!(?:s|d|es|ed|ly|ing|ings)$)/;

/*
 * One fold for the whole app, from lib/text.ts. There were five of these and
 * none of them agreed: this one kept spaces, discovery.ts stripped them,
 * places.ts stripped a leading "the" and planner.ts did not. Five opinions
 * about whether two spellings are the same string is how a refusal gets
 * dropped between the parser that reads it and the code that should act on
 * it.
 */

export function servesActivity(place: Place, activity: string): boolean {
  return activityMatch(place, activity) > 0;
}

/**
 * How much of an activity a place matches, 0..1: the share of her words
 * found in it.
 *
 * `servesActivity` is any-word, deliberately, because a false "nothing here
 * covers that" is the worse error at the itinerary. But any-word is the wrong
 * question for choosing a DESTINATION: "Coral Beaches at Claigan" on Skye
 * matched "scuba dive coral reefs" on the one word, and the shelf offered the
 * Highlands for a diving trip. The shelf and the ranker read this and ask for
 * at least half the words.
 */
export function activityMatch(place: Place, activity: string): number {
  const words = activityWords(activity);
  if (!words.length) return 0;
  const tokens = fold(`${place.name} ${place.note ?? ""} ${place.neighborhood ?? ""} ${place.tags.join(" ")}`)
    .replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const hay = new Set(tokens.map(stem));
  /*
   * A compound name contains the word and is not the word.
   *
   * Tokens are compared whole, so "Designmuseum Danmark" did not serve
   * "design" and the trip that scheduled it announced it had nothing for
   * design.
   *
   * Two guards, both from measured false positives. Five letters up, because
   * at three "art" matched Cartagena and "spa" matched every Spanish
   * anything. And the word must be a PREFIX, not merely inside: as a
   * substring, "light" matched flights, daylight and headlights, so a trip
   * asking for the northern lights was quietly told it was covered by a
   * harbour walk. A false match is worse than a miss here — it suppresses the
   * honest report AND feeds the scoring weight.
   *
   * The prefix alone was not enough: what follows it has to look like the rest
   * of a different NOUN, not an inflection of the same verb. "lightly",
   * "climbed" and "designed" all begin with a word she typed, and a Chianti
   * dinner noted "lightly" was silently serving her request for the northern
   * lights. `COMPOUND` is the guard.
   */
  const hit = words.filter((w) => hay.has(w)
    || (w.length >= 5 && tokens.some((t) => t.startsWith(w) && COMPOUND.test(t.slice(w.length)))));
  return hit.length / words.length;
}

/*
 * Words that say she wants to do the thing, not what the thing is. Stripped
 * before a strict match so "spend time in hot springs" is asked of a place as
 * "hot springs".
 */
const DOING = new Set([
  "a", "an", "the", "some", "any", "lots", "lot", "of", "in", "on", "at", "to", "and", "or",
  "with", "for", "my", "our", "me", "us", "i", "we", "go", "going", "see", "seeing", "do",
  "doing", "visit", "visiting", "spend", "spending", "time", "want", "wanna", "would", "like",
  "love", "try", "trying", "get", "have", "having", "explore", "exploring", "enjoy", "really",
  "day", "days", "bit", "few", "plenty", "good", "great", "nice", "best", "proper", "real",
  // Adjectives that describe how she wants the thing, not which thing.
  "long", "big", "little", "small", "slow", "quiet", "easy", "hard", "amazing", "fancy",
  "local", "authentic", "traditional", "cheap", "decent", "lovely", "beautiful", "cool",
]);

/**
 * Does this place hold the whole of what she asked for?
 *
 * `activityMatch` counts stemmed words, any one of which will do. That is the
 * right question at the itinerary, where a missed "the galleries" costs a
 * false "nothing here covers that". It is the wrong question for choosing
 * where to go: the stem of "springs" is "spr", "hot" is in hot chocolate, and
 * every destination in the catalogue "served" hot springs. Here every content
 * word she typed has to be in the same place, as a word or the start of one.
 */
/** The words of an activity that name the thing, with the wanting stripped. */
export function activityContentWords(activity: string): string[] {
  return fold(activity).replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 3 && !DOING.has(w));
}

/**
 * How directly a place is about the activity, for choosing which to name:
 * 3 when a content word is in its name, 2 when in its tags, 1 when only in
 * its note, 0 when it does not hold it. "For long walks: Museo del Oro" was a
 * note that mentioned a walk; a place tagged walk is what she meant.
 */
export function activityStrength(place: Place, activity: string): 0 | 1 | 2 | 3 {
  if (!holdsActivity(place, activity)) return 0;
  const words = activityContentWords(activity);
  const name = fold(place.name);
  const tags = place.tags.map((t) => fold(t));
  const stem = (w: string) => w.replace(/(?:ing|es|s)$/, "").slice(0, 4);
  if (words.some((w) => name.includes(stem(w)))) return 3;
  if (words.some((w) => tags.some((t) => t.startsWith(stem(w)) || stem(w).startsWith(t)))) return 2;
  return 1;
}

export function holdsActivity(place: Place, activity: string): boolean {
  const words = activityContentWords(activity);
  if (!words.length) return false;
  /*
   * A note that says "cold, not hot" does not hold hot. "The spring
   * bubblers" at Hierve el Agua carries the sentence "it is cold, not hot,
   * whatever the name says", and matched "hot springs" on the two words it
   * was written to deny. A word within reach of a negation is struck from
   * the text before matching.
   */
  const text = fold(`${place.name} ${place.note ?? ""} ${place.neighborhood ?? ""} ${place.tags.join(" ")}`)
    .replace(/\b(?:not|no|never|isn t|isnt|aren t|arent|without|nothing|rather than)\s+(?:\w+\s+){0,2}?\w+/g, " ")
    .replace(/\b(\w+)-free\b/g, " ");
  const tokens = text.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const forms = (w: string): string[] => {
    // "hiking" is "hike" is "hikes"; "springs" is "spring". Explicit, because
    // `stem` above turns "springs" into "spr" and that is how every
    // destination came to serve hot springs.
    const out = new Set([w]);
    if (/ies$/.test(w) && w.length > 5) out.add(w.slice(0, -3) + "y");
    if (/(?:es|s)$/.test(w) && w.length > 4) out.add(w.replace(/s$/, "").replace(/e$/, ""));
    if (/s$/.test(w) && w.length > 4) out.add(w.slice(0, -1));
    if (/ing$/.test(w) && w.length > 5) { out.add(w.slice(0, -3)); out.add(w.slice(0, -3) + "e"); }
    if (/ed$/.test(w) && w.length > 5) { out.add(w.slice(0, -2)); out.add(w.slice(0, -1)); }
    return [...out];
  };
  const hit = (w: string) => forms(w).some((f) => tokens.some((t) =>
    t === f || forms(t).includes(f) || (f.length >= 5 && t.startsWith(f) && COMPOUND.test(t.slice(f.length)))));
  return words.every(hit);
}

/** Like `unserved`, but a place has to hold every content word of the activity. */
export function unservedWell(places: Place[], activities?: string[]): string[] {
  return (activities ?? []).filter((a) => activityWords(a).length
    && !places.some((p) => !p.skip && holdsActivity(p, a)));
}

/** Her stated activities that nothing in this set of places serves. */
export function unserved(places: Place[], activities?: string[]): string[] {
  return (activities ?? []).filter((a) => activityWords(a).length
    && !places.some((p) => !p.skip && servesActivity(p, a)));
}

export function candidatesFor(
  cityId: string,
  brief: Brief,
  profile: TravelerProfile,
  costPressure = false,
): Candidate[] {
  const favor = favoredTags(brief, profile);
  const avoid = avoidedTags(brief, profile);
  const rejected = new Set(profile.rejectedPlaceIds);

  return placesInCity(cityId)
    .filter((p) => !p.skip)
    .filter((p) => !rejected.has(p.id))
    .filter((p) => !p.tags.some((t) => avoid.has(t)))
    // "I don't want crowds" also means: no coach-tour landmarks.
    .filter((p) => !(avoid.has("iconic") && p.touristy >= 5))
    /*
     * And a ceiling she actually stated is a ceiling, not a preference.
     * "just not overwhelmingly" is the same kind of instruction as "not
     * Southeast Asia": it says where the line is, so nothing above it is a
     * candidate at all.
     */
    .filter((p) => p.touristy <= (brief.crowds?.max ?? 5))
    // On a tight budget a $130 tasting menu isn't a tie-break, it's out.
    .filter((p) => !costPressure || p.costUsd <= (p.kind === "meal" ? 35 : 40))
    .map((place) => {
      const core = new Set([...coreTags(brief.vibes), ...profile.favorTags]);
      const support = supportTags(brief.vibes);
      const wanted = new Set([...core, ...support]);
      const mine = new Set(brief.vibes.flatMap((v) => SIGNATURE_TAGS[v]));
      const theirs = new Set(
        ALL_VIBES.filter((v) => !brief.vibes.includes(v))
          .flatMap((v) => SIGNATURE_TAGS[v])
          .filter((t) => !mine.has(t)),
      );
      const coreHits = place.tags.filter((t) => core.has(t)).length;
      const supportHits = place.tags.filter((t) => support.has(t)).length;
      // A core hit is worth two and a half support hits. Without that gap,
      // three weak adjacencies outrank one thing they actually asked for.
      const affinity = brief.vibes.length === 0
        ? 0.5
        : (coreHits + supportHits * 0.4) / Math.max(2, place.tags.length);
      /*
       * Section 9 "authenticity": prefer the local option, all else equal —
       * unless she has told us where the middle is.
       *
       * This was a straight line: the less touristy, the better, forever.
       * That is right as a default and wrong the moment somebody says "some
       * retail going on and still some people around". She asked for a band
       * and the scorer could only hold a direction, so it walked her to the
       * quietest end of it — a deserted version of the trip she described.
       *
       * With a band, the bonus peaks inside the band and falls away from it.
       * Without one, nothing changes.
       */
      const localBonus = crowdFit(place.touristy, brief.crowds);
      // Under budget pressure, free and cheap options get real weight rather
      // than a tiebreak nudge — this is how the plan comes in under the number.
      const valueBonus = costPressure
        ? Math.max(0, 0.3 - place.costUsd * 0.008)
        : place.costUsd === 0 ? 0.05 : 0;
      /*
       * Something she asked for by name outranks every tag heuristic here.
       *
       * Without this, activities is decorative: seven wildly different
       * activity lists produced a byte-identical Portugal itinerary, because
       * nothing in the scorer had ever read the field. The weight is large on
       * purpose. A place that matches what she said she wanted to DO should
       * beat a place that shares a vibe tag with it.
       */
      const asked = (brief.activities ?? []).some((a) => servesActivity(place, a)) ? 0.6 : 0;
      return {
        place,
        score: affinity * 0.7 + localBonus + valueBonus + asked,
        relevant: asked > 0 || brief.vibes.length === 0 || coreHits > 0,
        // Carries someone else's signature and none of theirs.
        foreign: brief.vibes.length > 0
          && place.tags.some((t) => theirs.has(t))
          && !place.tags.some((t) => mine.has(t)),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Section 34 material: the famous things this trip deliberately skips. */
export function passedOnIn(cityIds: string[]) {
  return PLACES.filter((p) => p.skip && cityIds.includes(p.cityId)).map((p) => ({
    placeId: p.id, name: p.name, cityId: p.cityId, note: p.note,
  }));
}

/**
 * What share of a destination's places actually serve this brief. Used to
 * catch the case where something wins on price and duration while having
 * almost nothing of what they came for.
 */
/**
 * How well this place's busyness matches what she asked for.
 *
 * Exported because the alternative is a test that re-implements it, and a
 * test that re-implements the thing it is testing passes whatever the real
 * code does. That mistake shipped a silent fallback this morning.
 *
 * With no band: the old straight line, quieter is better, which is the right
 * default. With a band: flat inside it and falling away outside, because
 * "some people around, just not overwhelmingly" names a middle, and a scorer
 * that can only hold a direction walks her to the deserted end of the range
 * she described.
 */
export function crowdFit(touristy: number, band: Brief["crowds"]): number {
  if (band?.min === undefined && band?.max === undefined) return (5 - touristy) * 0.045;
  const lo = band.min ?? 1;
  const hi = band.max ?? 5;
  if (touristy >= lo && touristy <= hi) return 0.18;
  const miss = touristy < lo ? lo - touristy : touristy - hi;
  return Math.max(0, 0.18 - miss * 0.09);
}

export function contentFit(cityIds: string[], brief: Brief, profile: TravelerProfile): number {
  const pool = cityIds.flatMap((c) => candidatesFor(c, brief, profile));
  if (!pool.length) return 0;
  return pool.filter((c) => c.relevant).length / pool.length;
}
