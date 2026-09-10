import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase-config";

export const runtime = "nodejs";

/**
 * The end-of-session survey, into Postgres.
 *
 * This route used to `appendFileSync` into evals/runs/sessions.jsonl. On
 * Vercel that is an ephemeral, read-only-except-/tmp serverless filesystem,
 * so every answer from the deployed app was written to a disk that was
 * discarded moments later. The comment above it said "the loop only closes if
 * the real sessions are captured", and none of them were.
 *
 * Same table as the per-message thumbs, so the survey and the sentence-level
 * verdicts sort together by session.
 */
export async function POST(req: Request) {
  // Same fallback as lib/supabase.ts, and for the same reason: the survey
  // was already lost once to a route that looked like it was working.
  const { url, key: pub } = supabaseConfig();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? pub;
  if (!url || !key) {
    // Say so rather than returning ok. A silent success here is what let the
    // old version look like it was working for months.
    return NextResponse.json({ ok: false, error: "no database configured" }, { status: 503 });
  }
  try {
    const record = await req.json();
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await db.from("feedback").insert({
      session_id: String(record.sessionId ?? record.session_id ?? "unknown"),
      trip_id: record.tripId ?? null,
      verdict: "down",           // the survey is a review, filed with the queue
      said: "(end-of-session survey)",
      brief: record.brief ?? null,
      destination_id: record.destination ?? null,
      note: record.note ?? null,
      survey: record.answers ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
