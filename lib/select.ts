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
  "my","our","we","i","want","wants","wanna","like","see","do","go","going","really","bit","lot","lots"]);

export function activityWords(activity: string): string[] {
  return activity.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .map((w) => w.replace(/(ing|ers|er|es|s)$/, ""))
    .filter((w) => w.length >= 3 && !FILLER.has(w));
}

export function servesActivity(place: Place, activity: string): boolean {
  const words = activityWords(activity);
  if (!words.length) return false;
  const hay = `${place.name} ${place.note ?? ""} ${place.neighborhood ?? ""} ${place.tags.join(" ")}`
    .toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  /*
   * A short stem has to be the whole word.
   *
   * Prefix matching is right for "surf" finding "surfing" and "surfers". It is
   * wrong for three-letter stems: "heli-skiing" reduces to ski, and `\bski`
   * matched a note containing "skip", so the Portugal catalogue reported that
   * it served heli-skiing.
   */
  return words.some((w) => (w.length >= 4 ? new RegExp(`\\b${w}`) : new RegExp(`\\b${w}\\b`)).test(hay));
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
