import type { Brief, Place, Tag, TravelerProfile, Vibe } from "@/lib/types";
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
].join("|") + ")\\b|\\b(are|is) out\\b", "i");

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
  const parts = activity.split(/([,;.]|\band\b|\bbut\b|\bthough\b)/i);
  let refusing = false;
  for (let i = 0; i < parts.length; i += 2) {
    const clause = parts[i];
    const joiner = (parts[i - 1] ?? "").trim().toLowerCase();
    const m = clause.match(REFUSAL);
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

export function servesActivity(place: Place, activity: string): boolean {
  const words = activityWords(activity);
  if (!words.length) return false;
  const hay = new Set(`${place.name} ${place.note ?? ""} ${place.neighborhood ?? ""} ${place.tags.join(" ")}`
    .toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).map(stem));
  return words.some((w) => hay.has(w));
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
      // Section 9 "authenticity": prefer the local option, all else equal.
      const localBonus = (5 - place.touristy) * 0.045;
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
export function contentFit(cityIds: string[], brief: Brief, profile: TravelerProfile): number {
  const pool = cityIds.flatMap((c) => candidatesFor(c, brief, profile));
  if (!pool.length) return 0;
  return pool.filter((c) => c.relevant).length / pool.length;
}
