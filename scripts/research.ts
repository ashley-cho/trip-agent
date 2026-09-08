/**
 * Live research against the real API, so you can see what actually comes back
 * before trusting it in the app.  npm run research -- patagonia 9
 */
import "@/lib/env";
import { anthropicTransport, createLlmDriver } from "@/lib/agent/llm";
import { cityById } from "@/data/destinations";
import { registerPack } from "@/data/registry";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { applyPatch } from "@/lib/brief";
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import { prettyDate } from "@/lib/dates";

const place = process.argv.slice(2).filter((a) => !/^\d+$/.test(a)).join(" ") || "patagonia";
const days = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 8);

(async () => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log("\n  No ANTHROPIC_API_KEY in .env.local — nothing to research with.\n"); process.exit(2); }

  console.log(`\n  Researching ${place} for ${days} days.\n  This uses the slow, search-backed path — the app answers from knowledge instead.\n`);
  const t0 = Date.now();
  const driver = createLlmDriver(anthropicTransport(key));
  const { pack, problem } = await driver.research!(place, days, "San Francisco");
  const secs = ((Date.now() - t0) / 1000).toFixed(0);

  if (!pack) {
    console.log(`  \x1b[31mNothing usable after ${secs}s.\x1b[0m\n  ${problem}\n`);
    process.exit(1);
  }

  console.log(`  \x1b[32m${pack.destination.name}\x1b[0m in ${secs}s`);
  console.log(`  ${pack.destination.pitch}`);
  console.log(`  Caveat: ${pack.destination.caveat}\n`);
  console.log(`  ${pack.cities.length} bases, ${pack.places.length} places, ${pack.places.filter((p) => p.skip).length} it would steer you away from`);
  console.log(`  Hours known for ${pack.places.filter((p) => p.opens).length}/${pack.places.length}`);
  console.log(`  Sources: ${[...new Set(pack.sources.map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }))].join(", ")}\n`);

  for (const c of pack.cities) {
    console.log(`  ${c.name}${c.dayTripOnly ? " (day trip)" : ` — $${c.nightlyUsd}/night, ${c.minNights}-${c.maxNights} nights`}`);
    for (const p of pack.places.filter((x) => x.cityId === c.id)) {
      const hrs = p.opens ? `${p.opens}-${p.closes ?? "?"}` : "no hours";
      console.log(`      ${p.skip ? "\x1b[33mSKIP\x1b[0m " : "     "}${p.name.padEnd(34).slice(0, 34)} ${String(hrs).padEnd(12)} $${p.costUsd}  ${p.note.slice(0, 60)}`);
    }
  }

  registerPack(pack);
  const b = applyPatch(emptyBrief(), { namedDestination: pack.destination.id, days }) as Brief;
  const trip = planTrip(b, recommend(b), emptyProfile());
  console.log(`\n  PLANNED: ${trip.concept.shape.map((l) => `${cityById(l.cityId).name} ${l.nights}n`).join(" · ")}  ≈ $${trip.concept.estimateUsd}\n`);
  for (const d of trip.days) {
    console.log(`  ${prettyDate(d.date).padEnd(13)} ${cityById(d.cityId).name.padEnd(18)} ${d.items.filter((i) => i.type === "activity").length} things`);
  }
  console.log();
})();
