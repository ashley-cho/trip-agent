/**
 * Can the catalogue answer this brief by itself?
 *
 * The catalogue exists for two reasons, both hers: so that a trip we already
 * hold costs no tokens, and so that the app still answers when there is no
 * model behind it. Neither was true for a brief that named nowhere. "Somewhere
 * warm with good food, a week, not too touristy" parsed cleanly — warmth,
 * food, a crowd band, seven days — and every one of those is a field the
 * ranker reads, and the turn went to the model for a suggestion anyway, and
 * with no credit it was refused with "I couldn't turn that into a place".
 *
 * The refusal was written for a real reason: on seven closed vibe tags,
 * "hike a national park" and "scuba dive coral reefs" ranked identically, so
 * a confident pick could not have been reflecting what she typed. The fix for
 * that is not to switch the ranker off; it is to say, per brief, whether the
 * catalogue can represent what she said, and rank only when it can.
 *
 * So this is a gate with a reason attached, not a fallback. It offers the
 * catalogue's pick when nothing on the brief is outside what the catalogue
 * can express, and otherwise names exactly which of her words it cannot
 * serve, so the caller can ask a model or, with none, say that out loud.
 */
import type { Brief, TravelerProfile } from "@/lib/types";
import type { Recommendation } from "@/lib/agent/types";
import { recommend } from "@/lib/recommend";
import { activityWords, unservedWell } from "@/lib/select";
import { CITIES } from "@/data/destinations";
import { PLACES } from "@/data";

export interface Shelf {
  /** The catalogue's pick, whenever nothing she said is outside its reach. */
  rec?: Recommendation;
  /**
   * Her words the catalogue cannot serve at all: an activity no place we
   * hold matches, or an event whose venue is world knowledge. When this is
   * non-empty there is no `rec`, because ranking on the rest would answer a
   * different question from the one she asked.
   */
  cannot: string[];
  /**
   * The pick is faithful but not a strong one: the top destination is ruled
   * out (too short, too thin, over budget), or it holds only some of what she
   * asked to do. A model with credit should be asked first; with no model,
   * the pick still stands and the existing honest sentences say what it lacks.
   */
  weak?: string;
}

const activePlaces = () => PLACES.filter((p) => !p.skip);

/**
 * Her stated activities that no place in the whole catalogue matches.
 *
 * Word matching, and at least half of her words, deliberately: a false
 * negative here sends the brief to the model, or stops with the word named,
 * and either is better than a plan that claims to cover something it cannot
 * find.
 */
export function unheldActivities(b: Brief): string[] {
  const asked = (b.activities ?? []).filter((a) => activityWords(a).length);
  if (!asked.length) return [];
  return unservedWell(activePlaces(), asked);
}

export function shelf(b: Brief, profile?: TravelerProfile): Shelf {
  const cannot = [...unheldActivities(b)];
  // Where an eclipse, a festival or a race is happening is not in any pack.
  if (b.anchorEvent) cannot.push(b.anchorEvent);
  if (cannot.length) return { cannot };

  const rec = recommend(b, profile);
  if (rec.noGoodFit) return { rec, cannot, weak: rec.noGoodFit };

  const cities = new Set(CITIES.filter((c) => c.destinationId === rec.destinationId).map((c) => c.id));
  const held = activePlaces().filter((p) => cities.has(p.cityId));
  const missing = unservedWell(held, (b.activities ?? []).filter((a) => activityWords(a).length));
  if (missing.length) return { rec, cannot, weak: `holds nothing for ${missing.join(", ")}` };
  if (rec.weakFor) return { rec, cannot, weak: `weak for ${rec.weakFor}` };
  return { rec, cannot };
}
