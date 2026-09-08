/**
 * Is she pushing back on the destination, or just talking?
 *
 * At the proposal, ANY typed message cleared the destination, dropped the
 * trip, and re-ran the recommender. So a Los Angeles itinerary for the 2028
 * Olympics, followed by "has the la olympics schedule come out yet? i'm just
 * interested in tennis matches", came back as "I think you should go to South
 * Korea." She asked a question about the trip she had, and the app read it as
 * rejection, threw the trip away, and re-scored the catalogue with tennis and
 * food as the brief.
 *
 * The assumption underneath was that anything typed at a proposal is
 * pushback. It isn't. Most of what people say to a finished plan is a
 * question about it, a request to change one thing, or thinking out loud.
 * Only two of those mean "somewhere else".
 */
import type { Brief } from "@/lib/types";
import type { BriefPatch } from "@/lib/agent/types";
import { isDomestic } from "@/lib/abroad";

/** Plain refusal of the place itself. */
const REJECTS =
  /\b(?:no(?:t)? (?:this|that|there|thanks)|somewhere else|anywhere else|different (?:place|destination|country|city)|don'?t (?:want|like|fancy) (?:this|that|there|it)|not (?:feeling|into|sold on|keen on) (?:this|that|it)|too (?:far|expensive|touristy|cold|hot|boring)|i'?d rather (?:go|be)|change (?:the )?destination|pick (?:somewhere|something) else|try (?:somewhere|something) else|hate (?:this|that|it)|boring|meh)\b/i;

/** A question about the trip is not a request for a different one. */
const ASKS = /\?\s*$|^\s*(?:what|when|where|which|who|how|why|is|are|do|does|did|can|could|will|would|should|has|have|had)\b/i;

export interface Pushback {
  /** Re-decide where she is going. */
  moveOn: boolean;
  /** Why, for the log and for tests. */
  reason: "named-elsewhere" | "rejected" | "ruled-out" | "stays";
}

/**
 * `current` is the destination she is looking at.
 *
 * Evidence, in order. Anything short of these leaves the trip alone.
 */
export function readPushback(
  text: string, patch: BriefPatch, brief: Brief, current: string,
): Pushback {
  // 1. She named somewhere else. The clearest signal there is.
  if (patch.namedDestination && patch.namedDestination !== current) {
    return { moveOn: true, reason: "named-elsewhere" };
  }
  // 2. She turned this one down in words.
  //    A question that happens to contain "boring" is still a question, so
  //    the question test runs first.
  if (!ASKS.test(text.trim()) && REJECTS.test(text)) {
    return { moveOn: true, reason: "rejected" };
  }
  // 3. She stated a constraint this destination fails. "I wanna go abroad"
  //    on a Utah pitch is not a question and not a rejection in words, but it
  //    rules the place out all the same.
  const wantsAbroadNow = patch.wantsInternational && isDomestic(current, brief.origin);
  if (wantsAbroadNow) return { moveOn: true, reason: "ruled-out" };

  return { moveOn: false, reason: "stays" };
}
