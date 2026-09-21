/**
 * Every time it gave up, and on what.
 *
 * The catalogue went from fifteen destinations to ninety-six in a day, and
 * every decision about WHICH ones to add was a guess — mine, mostly, about
 * what a traveller would plausibly ask for. Turkey and Tanzania and the
 * Faroes were good guesses. They were still guesses, and the next twelve
 * would be guesses too.
 *
 * The data that would settle it did not exist. `giveUp` console.warned, which
 * is visible in the devtools of the one browser it happened in and therefore
 * to nobody. So the single most useful fact about this product — the list of
 * places it was asked for and could not answer — was being thrown away at the
 * exact moment it was generated.
 *
 * This is the feedback table one layer earlier. Feedback records what she
 * thought of an answer; this records the questions that never got one.
 *
 * Insert-only, like feedback, and it stores the subject rather than her
 * message: "indian wells", not the sentence around it. Failure is silent by
 * design — a database that is down must never turn a give-up into two.
 */
import { supabaseConfig } from "@/lib/supabase-config";

export interface Miss {
  /** What she was asking about, as she typed it. */
  subject?: string;
  /** Which give-up this was, in the app's own words. */
  why: string;
  /** A miss under the rules floor is a different bug from one with a model. */
  driver?: string | null;
  days?: number;
  /*
   * Which decision this row records. Vercel keeps about an hour of logs, so
   * the console lines that explained every turn — [stopped], [lookup],
   * [shelf], [gave up], [unserved] — were gone before anyone could count
   * them. The same events, in the table that outlives the deployment.
   *
   *   stopped   no model, and nothing else could answer
   *   gate      the offline gate refused a message over words it would drop
   *   shelf     the catalogue was asked first: served, weak, or cannot
   *   gaveup    a give-up line in lib/flow.ts
   *   unserved  a plan went out with something she asked for unmatched
   */
  kind?: "stopped" | "gate" | "shelf" | "gaveup" | "unserved";
  /** The message she typed at that moment. The subject alone lost the sentence. */
  said?: string;
  /** The destination the decision was about, when there was one. */
  destination?: string;
}

export function recordMiss(m: Miss): void {
  /*
   * Only from a browser. The evals and the regress scripts drive the same
   * flow in node, and a harness that writes its own give-ups into the table
   * of real visitors' give-ups makes that table worthless for the one thing
   * it is for. TRIP_AGENT_RECORD=1 lets a script opt in on purpose.
   */
  if (typeof window === "undefined" && process.env.TRIP_AGENT_RECORD !== "1") return;
  const { url, key } = supabaseConfig();
  try {
    void fetch(`${url}/rest/v1/misses`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        subject: m.subject?.slice(0, 120) ?? null,
        why: m.why.slice(0, 300),
        driver: m.driver ?? null,
        days: m.days ?? null,
        kind: m.kind ?? null,
        said: m.said?.slice(0, 500) ?? null,
        destination: m.destination?.slice(0, 80) ?? null,
      }),
    }).catch(() => { /* best effort, always */ });
  } catch {
    /* no network, blocked, private mode. The give-up already happened. */
  }
}
