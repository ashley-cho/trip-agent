import { DESTINATIONS, CITIES } from "@/data/destinations";
import { PLACES, placesInCity } from "@/data";
import { dataDepth, scoreDestinations } from "@/lib/recommend";
import { emptyBrief } from "@/lib/types";

const LENGTHS = [4, 5, 7, 10];
console.log("dest         places  cities(usable)   " + LENGTHS.map(d => `${d}d`.padStart(6)).join(""));
console.log("-".repeat(78));
for (const d of DESTINATIONS) {
  const cities = CITIES.filter(c => c.destinationId === d.id);
  const usable = cities.filter(c => placesInCity(c.id).length > 0);
  const n = PLACES.filter(p => !p.skip && cities.some(c => c.id === p.cityId)).length;
  // Ask the recommender itself rather than reimplementing its gate here —
  // the two drifting apart is exactly how Japan hid.
  const cells = LENGTHS.map(days => {
    const b = emptyBrief(""); b.days = days;
    const row = scoreDestinations(b).find(x => x.id === d.id)!;
    return row.excluded ? "  --  " : dataDepth(d, days).toFixed(2).padStart(6);
  }).join("");
  console.log(`${d.id.padEnd(12)} ${String(n).padStart(5)}   ${String(usable.length)}/${cities.length}`.padEnd(30) + "   " + cells);
}
console.log("\n-- = not offered at that length (too thin, or under its minimum)");
console.log(`\ntotal places: ${PLACES.length} (${PLACES.filter(p=>p.skip).length} are deliberate "I'd skip this" entries)`);
console.log("cities with zero places:", CITIES.filter(c=>placesInCity(c.id).length===0).map(c=>c.id).join(", ") || "none");
