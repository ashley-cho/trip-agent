/**
 * The app with no model behind it at all.
 *
 * `npm run eval` runs the rules driver, and the rules driver answers
 * everything it can. That is not what a deployment out of credit does. The
 * no-floor rule in lib/client.ts says the four actions that turn her words
 * into meaning — interpret, question, pitch, parseEdit — have no fallback:
 * they stop, because a regex guessing at intent is worse than an honest
 * refusal. So the scorecard has been measuring a driver that does not exist
 * in production, and it reads 98% while the deployed app says "I'm stopping
 * here" to "i wanna visit japan".
 *
 * This is the third thing: the rules floor everywhere it is allowed, and a
 * NoModel throw on the four where it is not, exactly as lib/client.ts wires
 * it, including the one shortcut that file makes — a message that is only a
 * name we hold needs no interpretation, so it is answered rather than
 * refused.
 *
 * What it measures is the question worth asking: with nothing paid for, how
 * often does this app still answer, and is the answer any good. The two
 * numbers are separate on purpose. `held` is how often it got through;
 * everything else is how good the trips were when it did.
 */
import type { AgentDriver, BriefPatch } from "@/lib/agent/types";
import type { Brief, Trip } from "@/lib/types";
import { editOrphans, parseEditRules } from "@/lib/edit";
import { rulesDriver } from "@/lib/agent/rules";
import { NoModel } from "@/lib/client";
import { lookupOnly, orphanWords } from "@/lib/lookup";
import { interpretRules } from "@/lib/discovery";

export function deadDriver(): AgentDriver & { stopped: () => number } {
  let stops = 0;
  const stop = (): never => {
    stops++;
    throw new NoModel('400 {"type":"invalid_request_error","message":"Your credit balance is too low"}');
  };
  return {
    ...rulesDriver,
    name: "dead",
    stopped: () => stops,

    async interpret(input: string, brief: Brief): Promise<BriefPatch> {
      /*
       * TRIP_AGENT_GATE picks how wide the offline gate is, so the choice can
       * be measured instead of argued:
       *
       *   name   (default, and what ships) a message that is ONLY a name we
       *          hold. Provably nothing to interpret.
       *   lookup a name we hold plus a remainder the parser accounts for
       *          every word of.
       *   words  no name required: any message the parser accounts for every
       *          word of. The recommender then picks, which is arithmetic
       *          over the catalogue rather than invented meaning -- but it IS
       *          the app choosing where she goes without a model, and that is
       *          a product decision, not a technical one.
       */
      // "words" is what ships (lib/client.ts, NEXT_PUBLIC_TRIP_AGENT_GATE),
      // so it is the default here too, or this measures a build that is not
      // deployed.
      const gate = process.env.TRIP_AGENT_GATE ?? "words";
      const bare = lookupOnly(input);
      if (bare && (gate !== "name" || !Object.keys(bare.patch).length)) {
        return { ...bare.patch, namedDestination: bare.destinationId };
      }
      if (gate === "words") {
        const patch = interpretRules(input, brief);
        if (!orphanWords(input, brief).length) return patch;
      }
      return stop();
    },
    async nextQuestion() { return stop(); },
    /*
     * Production's `suggest` with no credit is a model call that fails and
     * comes back as a problem, not a pick. The harness used to fill this seam
     * with `recommend()` when the driver had none, which is the open-field
     * ranking the flow was refusing at the time: 96% HELD on the scorecard
     * against every place-free message stopping on the deployed app. The
     * catalogue-first path in lib/flow.ts is what carries these now, and it
     * has to earn the number through the flow rather than through a stub.
     */
    async suggest() {
      return { problem: 'the model call failed: 400 "Your credit balance is too low"' };
    },
    async pitch() { return stop(); },
    // Production (lib/client.ts) applies the rules editor with no model only
    // when every word of the edit lands in an op. Same gate, same result.
    async parseEdit(input: string, trip: Trip) {
      if (editOrphans(input, trip).length) return stop();
      return parseEditRules(input, trip);
    },
  };
}
