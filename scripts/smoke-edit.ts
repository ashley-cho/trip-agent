import { emptyBrief, emptyProfile } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { critique } from "@/lib/critic";
import { parseEditRules, applyOps } from "@/lib/edit";

const brief = emptyBrief("surprise me");
brief.days = 7; brief.vibes = ["exploration", "relaxation", "food"]; brief.budgetUsd = 2000;

let b = brief, p = emptyProfile();
let trip = planTrip(b, recommend(b), p, { startDate: "2026-10-10" });

const count = (t: typeof trip) => t.days.map(d => d.items.filter(i => i.type === "activity").length);
const tagShare = (t: typeof trip, tag: string) =>
  t.days.flatMap(d => d.items).filter(i => (i.tags as string[]).includes(tag)).length;

console.log("BASELINE activities/day:", count(trip).join(","), "| wine items:", tagShare(trip, "wine"));

for (const msg of [
  "I don't really care about castles.",
  "This feels too busy.",
  "I want more wine.",
  "less touristy please",
  "I want more nature.",
]) {
  const ops = parseEditRules(msg, trip);
  const r = applyOps(trip, ops, b, p);
  trip = r.trip; b = r.brief; p = r.profile;
  console.log(`\n> ${msg}`);
  console.log("  ops:", ops.map(o => o.kind + ("tag" in o ? `(${o.tag})` : "")).join(", "));
  r.summary.forEach(s => console.log("  →", s));
  r.unresolved.forEach(s => console.log("  ?? unresolved:", s));
  console.log("  activities/day:", count(trip).join(","), "| wine:", tagShare(trip, "wine"), "| nature:", tagShare(trip, "nature"));
  const iss = critique(trip, b, p);
  if (iss.length) iss.forEach(i => console.log(`  [${i.severity}] ${i.code}: ${i.message}`));
}
console.log("\nLEARNED:", p.preferences.map(x => x.text).join(" | "));
console.log("REJECTED:", p.rejectedPlaceIds.join(", "));
