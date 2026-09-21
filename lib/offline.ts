/**
 * What the app may answer with no model, in one place.
 *
 * lib/client.ts decided this inline, and evals/dead.ts re-described the
 * decision in its own words so the scorecard could measure it. The two
 * drifted twice in one day: the harness defaulted to the narrow gate while
 * production shipped the wide one, and the harness stubbed `suggest` with a
 * ranking production never had. Both times the number was flattering and
 * wrong. So the rule lives here, and both callers import it; the harness
 * cannot describe a gate that does not exist.
 *
 * The rule, in full:
 *
 *   interpret  a message that is only a name we hold, or a name plus words
 *              the parser accounts for, plans without a model (lookupOnly).
 *              With the wide gate, any message every word of which lands
 *              somewhere on the brief plans without a model (orphanWords).
 *              At a proposal, a message the EDITOR reads whole carries on,
 *              because the editor runs next and will read it.
 *              Anything else is refused, naming the words that would be
 *              dropped.
 *
 *   parseEdit  an edit the rules editor reads every word of is applied
 *              (editOrphans); anything else is refused.
 *
 * Refusing is not a failure of this module; it is its second job. The
 * degraded case is a word dropped on the floor and the rest answered as if
 * it were the whole message.
 */
import type { Brief, Trip } from "@/lib/types";
import type { BriefPatch, EditOp } from "@/lib/agent/types";
import { lookupOnly, orphanWords } from "@/lib/lookup";
import { interpretRules } from "@/lib/discovery";
import { editOrphans, parseEditRules } from "@/lib/edit";

export type Gate = "name" | "words";

/** The gate that ships. The env var narrows it without a deploy. */
export function gateInForce(): Gate {
  const v = process.env.NEXT_PUBLIC_TRIP_AGENT_GATE ?? process.env.TRIP_AGENT_GATE;
  return v === "name" ? "name" : "words";
}

export type OfflineRead =
  | { patch: BriefPatch; how: "name" | "words" | "edit" }
  | { refused: string[] };

export function offlineInterpret(said: string, brief: Brief, trip?: Trip | null, gate: Gate = gateInForce()): OfflineRead {
  const bare = lookupOnly(said);
  /*
   * The city she named is the trip. `cityId` was dropped here, so typing
   * "provence" resolved to France and the planner did what it does for a
   * country: based her in Paris. The model path has always carried the
   * city through (flow.ts settles `focusCityId` from the same lookup).
   */
  if (bare) return { patch: { ...bare.patch, namedDestination: bare.destinationId, focusCityId: bare.cityId }, how: "name" };
  if (gate === "name") return { refused: said.split(/\s+/).filter(Boolean) };
  const orphan = orphanWords(said);
  if (!orphan.length) return { patch: interpretRules(said, brief), how: "words" };
  if (trip && !editOrphans(said, trip).length) return { patch: interpretRules(said, brief), how: "edit" };
  return { refused: orphan };
}

export function offlineEdit(said: string, trip: Trip): { ops: EditOp[] } | { refused: string[] } {
  const orphan = editOrphans(said, trip);
  if (orphan.length) return { refused: orphan };
  return { ops: parseEditRules(said, trip) };
}
