/**
 * The queue of unsatisfied results.
 *
 * `npx tsx scripts/votes.ts` prints every thumbs-down that has not yet been
 * turned into a scenario, newest first, with the brief and the plan that
 * produced it. That is the worklist: the loop is only closed when a row here
 * becomes a row in evals/scenarios.ts and this list gets shorter.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY. The publishable key can insert and cannot
 * read, on purpose: the table is a drop box for the app and a dataset only
 * for whoever holds the service key.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\nSet SUPABASE_SERVICE_ROLE_KEY to read the queue."
    + "\nThe publishable key in .env.local can write votes but not read them.\n");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.from("feedback").select("*")
  .eq("verdict", "down").is("replayed_at", null).order("at", { ascending: false }).limit(50);

if (error) { console.error(error.message); process.exit(1); }
if (!data?.length) { console.log("\n  \x1b[32mNothing unsatisfied and unanswered.\x1b[0m\n"); process.exit(0); }

console.log(`\n\x1b[1m${data.length} THING(S) IT GOT WRONG, NOT YET A TEST\x1b[0m\n`);
for (const r of data) {
  console.log(`  \x1b[31m▽\x1b[0m ${new Date(r.at).toISOString().slice(0, 16).replace("T", " ")}  ${r.destination_id ?? "—"}  ${r.driver ?? ""}`);
  console.log(`     said: ${JSON.stringify(String(r.said).slice(0, 160))}`);
  if (r.note) console.log(`     note: ${r.note}`);
  const b = r.brief as Record<string, unknown> | null;
  if (b) console.log(`     brief: ${JSON.stringify({ days: b.days, vibes: b.vibes, activities: b.activities, budgetUsd: b.budgetUsd })}`);
  if (r.survey) console.log(`     survey: ${JSON.stringify(r.survey)}`);
  console.log();
}
console.log("  Write a scenario for one, then set replayed_at on its row.\n");
