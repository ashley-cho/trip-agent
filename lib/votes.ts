"use client";

import { supabase } from "@/lib/supabase";
import type { Brief, Trip } from "@/lib/types";

/**
 * A thumbs-down, and everything needed to replay it.
 *
 * The end-of-session survey that shipped before this posted to a route that
 * did `appendFileSync` into evals/runs/. On Vercel that is an ephemeral
 * serverless filesystem, so every answer from the deployed app was written
 * and then thrown away. The loop this product is built around was designed
 * and never actually closed.
 *
 * So two changes, not one. It goes to Postgres, and it is per MESSAGE rather
 * than per session: "would you take this trip?" at the end cannot tell you
 * WHICH sentence was wrong, and the sentence is the unit that gets fixed.
 *
 * What is stored is chosen so that a row is a test case: the exact words she
 * read, the brief that produced them, and the plan that was on screen. That
 * is enough to rebuild the turn in evals/, which is the difference between a
 * complaint and a regression.
 */
export interface Vote {
  sessionId: string;
  tripId?: string;
  verdict: "up" | "down";
  said: string;
  turnIndex?: number;
  brief?: Brief;
  trip?: Trip | null;
  destinationId?: string;
  driver?: string;
  note?: string;
  survey?: Record<string, number>;
}

const signature = (t?: Trip | null) =>
  t?.days.map((d) => `${d.cityId}:${d.items.map((i) => `${i.name}@${i.start}`).join("|")}`).join(">>");

export async function sendVote(v: Vote): Promise<{ ok: boolean; reason?: string }> {
  const row = {
    session_id: v.sessionId,
    trip_id: v.tripId ?? null,
    verdict: v.verdict,
    said: v.said,
    turn_index: v.turnIndex ?? null,
    brief: v.brief ?? null,
    trip_signature: signature(v.trip) ?? null,
    destination_id: v.destinationId ?? null,
    driver: v.driver ?? null,
    note: v.note ?? null,
    survey: v.survey ?? null,
  };
  /*
   * Kept locally FIRST, and kept whether or not the network call works.
   *
   * A vote that only exists if Postgres is reachable is a vote that goes
   * missing on a train, which is where half of this app gets used. The local
   * copy is the record; the upload is the convenience.
   */
  try {
    localStorage.setItem(`trip-agent.vote.${Date.now()}`, JSON.stringify({ at: new Date().toISOString(), ...row }));
  } catch { /* private mode */ }

  const db = supabase();
  if (!db) return { ok: false, reason: "no database configured" };
  const { error } = await db.from("feedback").insert(row);
  return error ? { ok: false, reason: error.message } : { ok: true };
}
