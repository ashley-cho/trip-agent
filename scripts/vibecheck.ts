import { emptyBrief, emptyProfile, type Vibe } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { coreTags } from "@/lib/select";
import { placeById } from "@/data";

const cases: Vibe[][] = [["nature"], ["nature","relaxation"], ["nature","adventure"], ["culture"], ["food"]];
for (const vibes of cases) {
  const b = emptyBrief(""); b.days = 7; b.vibes = vibes; b.budgetUsd = 2500;
  const p = emptyProfile();
  const rec = recommend(b);
  const t = planTrip(b, rec, p, { startDate: "2026-10-10" });
  const want = coreTags(vibes);
  const acts = t.days.flatMap(d => d.items).filter(i => i.type === "activity");
  const hit = acts.filter(i => i.tags.some(x => want.has(x)));
  console.log(`\n[${vibes.join("+")}] -> ${rec.destinationId}   ${hit.length}/${acts.length} activities match the ask`);
  for (const i of acts) {
    const pl = i.placeId ? placeById(i.placeId) : undefined;
    const on = i.tags.filter(x => want.has(x));
    console.log(`   ${on.length ? "OK " : "MISS"} ${i.name.padEnd(38)} [${i.tags.join(",")}]`);
  }
}
