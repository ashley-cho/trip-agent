import type { Brief, Destination, TravelerProfile, Vibe } from "@/lib/types";
import { ALL_VIBES } from "@/lib/types";

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
      // Learn from what this place is strongest at, not from everything about
      // it. Pushing all seven vibes negative teaches nothing.
      const lean = { ...p.vibeLeanings };
      // Never learn against something they asked for. They said food and
      // culture; turning down Rome means Rome was wrong, not that they were.
      const stated = new Set(b.vibes);
      const strong = ALL_VIBES
        .filter((v) => dest.strengths[v] >= 4 && !stated.has(v))
        .sort((a, c) => dest.strengths[c] - dest.strengths[a])
        .slice(0, 2);
      for (const v of strong) lean[v] = (lean[v] ?? 0) - 1;
      p = { ...p, vibeLeanings: lean };
      said = strong.length
        ? `Right — less ${strong.join(" and ")}, then.`
        : "Right. Something with a different character.";
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
