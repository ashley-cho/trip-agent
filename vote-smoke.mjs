import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local","utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error } = await db.from("feedback").insert({
  session_id: "smoke-test", verdict: "down", said: "smoke test row, safe to delete",
  brief: { days: 6, vibes: ["nature"], activities: ["gaudi"] }, destination_id: "catalonia", driver: "rules" });
console.log("INSERT with publishable key:", error ? "FAILED: " + error.message : "ok");
const r = await db.from("feedback").select("*").limit(1);
console.log("READ  with publishable key:", r.error ? "refused (correct): " + r.error.message : `RETURNED ${r.data?.length} ROW(S) — RLS WOULD BE WRONG`);
