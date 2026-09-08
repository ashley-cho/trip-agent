import { emptyBrief, emptyProfile } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { critique } from "@/lib/critic";
import { destinationById, cityById } from "@/data/destinations";
import { prettyTime } from "@/lib/geo";

const brief = emptyBrief("I need a vacation. Surprise me.");
brief.days = 7;
brief.vibes = ["exploration", "relaxation", "food"];
brief.budgetUsd = 2000;

const rec = recommend(brief);
console.log("REC:", rec.destinationId, rec.confidence, "alt:", rec.alternativeId ?? "-");
console.log("scores:", rec.scores.map((s) => `${s.id}=${s.score.toFixed(3)}`).join("  "));

const profile = emptyProfile();
const trip = planTrip(brief, rec, profile, { startDate: "2026-10-10" });
console.log("\nSHAPE:", trip.concept.shape.map((l) => `${cityById(l.cityId).name} x${l.nights}${l.dayTrip ? ` (+${cityById(l.dayTrip).name})` : ""}`).join(" -> "));
console.log("ESTIMATE: $" + trip.concept.estimateUsd, JSON.stringify(trip.concept.breakdown));

for (const d of trip.days) {
  console.log(`\n--- Day ${d.index} (${d.date}) ${d.theme}`);
  for (const i of d.items) {
    const tag = i.type === "downtime" ? "REST" : i.type === "transit" ? "MOVE" : i.type === "logistics" ? "LOG " : i.type === "meal" ? "EAT " : "ACT ";
    console.log(`  ${tag} ${prettyTime(i.start).padEnd(9)} ${String(i.durationMin).padStart(3)}m  ${i.name}`);
  }
}

const issues = critique(trip, brief, profile);
console.log("\nISSUES:", issues.length);
for (const i of issues) console.log(`  [${i.severity}] ${i.code} d${i.day ?? "-"}: ${i.message}`);
