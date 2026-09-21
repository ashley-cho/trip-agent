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
import { rulesDriver } from "@/lib/agent/rules";
import { NoModel } from "@/lib/client";
import { gateInForce, offlineEdit, offlineInterpret } from "@/lib/offline";

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

    /*
     * The same gate as production, from the same module. TRIP_AGENT_GATE
     * narrows it to a bare name for measurement; unset, it is what ships.
     */
    async interpret(input: string, brief: Brief): Promise<BriefPatch> {
      const read = offlineInterpret(input, brief, undefined, gateInForce());
      if ("patch" in read) return read.patch;
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
      const read = offlineEdit(input, trip);
      if ("ops" in read) return read.ops;
      return stop();
    },
  };
}
