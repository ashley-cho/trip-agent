import { NextResponse } from "next/server";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

/**
 * Section 35 answers, plus every edit the traveller made, land here as one
 * JSONL record per session. This is the raw material the eval scenarios get
 * written from — the loop only closes if the real sessions are captured.
 */
export async function POST(req: Request) {
  try {
    const record = await req.json();
    const dir = join(process.cwd(), "evals", "runs");
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      join(dir, "sessions.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), ...record }) + "\n",
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
