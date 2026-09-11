import type { Brief, Destination, TravelerProfile, Vibe } from "@/lib/types";
import { ALL_VIBES } from "@/lib/types";
import { DESTINATIONS } from "@/data/destinations";
import { inTropics, membersOf } from "@/lib/regions";

/**
 * Saying no to a recommendation.
 *
 * The proposal card had one button on it: "Show me the trip". There was no
 * composer at that stage either, so an opinionated single recommendation was
 * also an unarguable one. That is not a strong point of view, it's a dead end.
 *
 * A rejection has to change the next answer in a way the traveller can see,
 * otherwise it's a survey. Each reason below moves something concrete in the
 * brief or the profile, and the agent says what it changed.
 */

export type RejectReasonId =
  | "expensive" | "far" | "been" | "notmykind" | "tooshort" | "other";

export interface RejectReason {
  id: RejectReasonId;
  label: string;
}

export const REJECT_REASONS: RejectReason[] = [
  { id: "expensive", label: "Too expensive" },
  { id: "far", label: "Too far" },
  { id: "been", label: "I've been there" },
  { id: "notmykind", label: "Not my kind of place" },
  { id: "other", label: "Just show me something else" },
];

export interface RejectOutcome {
  brief: Brief;
  profile: TravelerProfile;
  /** What the agent should say it changed. One sentence, no hedging. */
  said: string;
}

const add = (list: string[] | undefined, id: string) => [...new Set([...(list ?? []), id])];

/**
 * Does this place already fail something she said out loud?
 *
 * If it does, "not my kind of place" is her agreeing with her own brief, not
 * telling us something new, and the honest reading of the click is "you
 * should not have offered me this" rather than "I dislike food".
 */
function alreadyRuledOut(dest: Destination, b: Brief): boolean {
  if ((b.avoidRegions ?? []).some((r) => membersOf(r).includes(dest.id))) return true;
  return (b.avoidClimate ?? []).some((c) =>
    c === "hot" ? dest.warmth >= 4
      : c === "cold" ? dest.warmth <= 2
        : inTropics(dest.id));
}

export function applyRejection(
  reason: RejectReasonId,
  dest: Destination,
  estimateUsd: number,
  brief: Brief,
  profile: TravelerProfile,
): RejectOutcome {
  let b: Brief = { ...brief };
  let p: TravelerProfile = { ...profile };
  let said = "";

  // Whatever the reason, a named destination has just been un-named. Without
  // this the next pass recommends the same place, because a named destination
  // is treated as a decision.
  if (b.namedDestination === dest.id) b = { ...b, namedDestination: undefined };
  p = { ...p, rejectedDestinationIds: add(p.rejectedDestinationIds, dest.id) };

  switch (reason) {
    case "expensive": {
      // Their real number is below what we just quoted. Anchor to the quote
      // rather than to the stated budget, which they may never have given.
      const target = Math.max(600, Math.round((estimateUsd * 0.72) / 100) * 100);
      b = { ...b, budgetUsd: Math.min(b.budgetUsd ?? Infinity, target), flexibleBudget: false };
      said = `Understood. Working to about $${target.toLocaleString()} instead.`;
      break;
    }
    case "far": {
      b = { ...b, wantsNear: true, wantsFar: false };
      said = "Fair. Looking for somewhere closer to home.";
      break;
    }
    case "been": {
      p = { ...p, visitedDestinationIds: add(p.visitedDestinationIds, dest.id) };
      said = `Noted, you've done ${dest.name}. I won't offer it again.`;
      break;
    }
    case "notmykind": {
      /*
       * One click is not a taste.
       *
       * She wrote: quiet, peaceful, beautiful, some retail, some people, not
       * Southeast Asia, nothing hot or cold or humid. She was sent to Bali.
       * She pressed "Not my kind of place" and was told, in her own agent's
       * voice: "Right — less food and culture, then."
       *
       * She had said nothing whatsoever about food or culture. Those are the
       * two things Bali happens to score four on that she had not explicitly
       * asked for, and one button press was read as a statement about her.
       * That is the same failure as telling her she said something she did
       * not — lib/reasons.ts exists for exactly that — except that this one
       * also writes it into her profile, where it shapes every future
       * recommendation she gets.
       *
       * It is also, here, inventing an explanation for a rejection that was
       * already fully explained. Bali is in the region she ruled out, at a
       * warmth of 5, eight degrees off the equator. Nothing about vibes was
       * ever in question. So:
       *
       *   1. If the place already fails something she actually stated, the
       *      rejection carries no information about taste. Record the
       *      rejection and nothing else.
       *   2. Otherwise a strength becomes a leaning only when a SECOND
       *      rejected destination shares it. One data point is a data point;
       *      two is a pattern.
       *   3. Until then, say what happened rather than what she supposedly
       *      thinks.
       */
      const explained = alreadyRuledOut(dest, b);
      const stated = new Set(b.vibes);
      const candidates = explained ? [] : ALL_VIBES
        .filter((v) => dest.strengths[v] >= 4 && !stated.has(v))
        .sort((a, c) => dest.strengths[c] - dest.strengths[a]);

      // What the places she has already turned down had in common with this
      // one. `rejectedDestinationIds` now includes this one, so a repeat of
      // the same strength means at least two rejections share it.
      const before = (profile.rejectedDestinationIds ?? [])
        .map((id) => DESTINATIONS.find((d) => d.id === id))
        .filter((d): d is Destination => !!d && d.id !== dest.id);
      const corroborated = candidates
        .filter((v) => before.some((d) => d.strengths[v] >= 4))
        .slice(0, 2);

      if (corroborated.length) {
        const lean = { ...p.vibeLeanings };
        for (const v of corroborated) lean[v] = (lean[v] ?? 0) - 1;
        p = { ...p, vibeLeanings: lean };
        said = `That's twice now — less ${corroborated.join(" and ")}, then.`;
      } else {
        said = `Right. Not ${dest.name}, then.`;
      }
      break;
    }
    case "tooshort": {
      said = "Understood.";
      break;
    }
    case "other":
    default:
      said = `Fine. Not ${dest.name}.`;
      break;
  }

  return { brief: b, profile: p, said };
}

/** The vibes this rejection pushed away from, for the eval harness. */
export function leaningDelta(before: Partial<Record<Vibe, number>>, after: Partial<Record<Vibe, number>>) {
  return ALL_VIBES.filter((v) => (after[v] ?? 0) < (before[v] ?? 0));
}
