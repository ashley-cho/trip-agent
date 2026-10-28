/**
 * The bar a pack has to clear before it goes in the bag.
 *
 * `adopt` asks one question: can this pack carry a week at all (14 usable
 * places across the whole pack). That was the right question when a pack was
 * a country and the trip used all of it. It is the wrong question now that
 * naming a city pins the trip to that city: "munich" gets Munich's places,
 * not Germany's. So the bar is per bed, and it scales with how long the bed
 * can hold you: about three things a day on top of meals.
 *
 *   places >= max(8, 3 x maxNights)    meals >= 3
 *
 * Meals stay flat at 3. A meal a night was tried on 2026-10-28 and failed six
 * packs that had just been researched to the full standard, because sourced
 * meal prices are the hardest thing to find; the planner rotates meals.
 *
 * A flat 15 (the old bar) asked a two-night stop like Plitvice for as much as
 * a four-night capital, so packs with many small bases failed while a long
 * stay in one city could still come up short.
 *
 * The rest is what the validator cannot know: that a place is inside its
 * city (a Lisbon restaurant with Porto's coordinates schedules a five-hour
 * "walk"), that opening times are times, that the prose is the house voice,
 * and that the facts came from somewhere.
 *
 *   npx tsx scripts/pack-check.ts <dir-or-file>
 *
 * `--min N` is still accepted so old commands run, but it is ignored.
 *
 * Exit 1 if anything fails. Reads both the flat shape an author writes and
 * the row shape the table stores.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { validatePack, usablePlaces } from "@/lib/research";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--")) ?? "data/catalogue";
if (args.includes("--min")) console.error("note: --min is ignored; the bar now scales with each bed's maxNights");
const PLACES_PER_NIGHT = 3, PLACES_FLOOR = 8, MEALS_FLOOR = 3;
/** What one bed has to hold, from the most nights the pack lets you stay there. */
const need = (c: { minNights?: number; maxNights?: number }) => {
  const nights = Math.max(c.maxNights ?? 0, c.minNights ?? 0, 1);
  return { nights, places: Math.max(PLACES_FLOOR, PLACES_PER_NIGHT * nights), meals: MEALS_FLOOR };
};
const KM_FROM_BASE = 80;
const BANNED = /\b(hidden gem|vibrant|nestled|bustling|must[- ]see|gateway to|something for everyone|immerse yourself|picturesque|charming|stunning|breathtaking|iconic landmark|world[- ]class|boasts)\b/i;

function flatten(raw: unknown): { flat: unknown; sources: string[] } {
  const r = raw as Record<string, unknown> | null;
  const p = r?.pack as Record<string, unknown> | undefined;
  if (p && Array.isArray(p.cities)) {
    const d = (p.destination ?? {}) as Record<string, unknown>;
    return { flat: { ...d, cities: p.cities, places: p.places, outings: p.outings }, sources: (p.sources as string[]) ?? [] };
  }
  return { flat: raw, sources: ((r?.sources as string[]) ?? []) };
}

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const files = statSync(target).isDirectory()
  ? readdirSync(target).filter((f) => f.endsWith(".json")).map((f) => `${target}/${f}`)
  : [target];

let failed = 0;
for (const f of files) {
  const raw = JSON.parse(readFileSync(f, "utf8"));
  const { flat, sources } = flatten(raw);
  const { pack, problems } = validatePack(flat, sources);
  const bad: string[] = [];
  if (!pack) {
    console.log(`FAIL  ${f}: ${problems.slice(0, 3).join("; ")}`);
    failed++;
    continue;
  }
  for (const p of problems) bad.push(`validator: ${p}`);

  const beds = pack.cities.filter((c) => !c.dayTripOnly);
  for (const c of beds) {
    const mine = pack.places.filter((p) => p.cityId === c.id && !p.skip);
    const n = need(c);
    if (mine.length < n.places) bad.push(`bed ${c.name}: ${mine.length} places, needs ${n.places} (${n.nights} nights)`);
    const meals = mine.filter((p) => p.kind === "meal").length;
    if (meals < n.meals) bad.push(`bed ${c.name}: ${meals} meals, needs ${n.meals}`);
    // A place at exactly the city's coordinates was not looked up.
    const guessed = mine.filter((p) => Math.abs(p.lat - c.lat) < 1e-4 && Math.abs(p.lng - c.lng) < 1e-4);
    if (guessed.length > 1) bad.push(`bed ${c.name}: ${guessed.length} places sit exactly on the city's own coordinates (${guessed.slice(0, 3).map((p) => p.name).join(", ")})`);
  }
  for (const p of pack.places) {
    const c = pack.cities.find((x) => x.id === p.cityId)!;
    const d = km(p, c);
    if (d > KM_FROM_BASE) bad.push(`"${p.name}" is ${Math.round(d)} km from ${c.name}`);
    if (BANNED.test(p.note)) bad.push(`"${p.name}": banned word in note (${p.note.match(BANNED)![0]})`);
    if (p.note.length < 40) bad.push(`"${p.name}": note too short to be a sentence`);
    if (p.kind === "meal" && !p.tags.includes("food")) bad.push(`"${p.name}": a meal without the food tag`);
    // A museum at $0 is a museum whose price nobody looked up, and the
    // planner will budget it as free. Free ones say so in the note.
    if ((p.kind === "museum" || (p.kind === "sight" && p.opens)) && p.costUsd === 0 && !/\b(free|no charge|donation|check the price)\b/i.test(p.note)) {
      bad.push(`"${p.name}": ${p.kind} at $0 with no "free" in the note (price not looked up?)`);
    }
    if (p.kind === "meal" && p.costUsd === 0) bad.push(`"${p.name}": a meal at $0`);
  }
  const names = new Map<string, number>();
  for (const p of pack.places) names.set(p.name.toLowerCase(), (names.get(p.name.toLowerCase()) ?? 0) + 1);
  for (const [n, c] of names) if (c > 1) bad.push(`"${n}" appears ${c} times`);
  if (BANNED.test(pack.destination.pitch)) bad.push(`pitch: banned word (${pack.destination.pitch.match(BANNED)![0]})`);
  for (const [v, s] of Object.entries(pack.destination.because)) if (s && BANNED.test(s)) bad.push(`because.${v}: banned word`);
  if (!sources.length) bad.push("no sources");
  const opens = pack.places.filter((p) => p.opens).length;
  // Temples, markets, beaches and street food carry no hours; 40% is the
  // floor below which the scheduler is guessing about the museums too.
  if (opens < pack.places.length * 0.4) bad.push(`only ${opens}/${pack.places.length} places carry opening times`);

  const line = `${pack.destination.id.padEnd(22)} ${beds.length} beds, ${usablePlaces(pack)} usable places`;
  if (bad.length) {
    failed++;
    console.log(`FAIL  ${line}`);
    for (const b of bad.slice(0, 12)) console.log(`        - ${b}`);
    if (bad.length > 12) console.log(`        - and ${bad.length - 12} more`);
  } else {
    console.log(`OK    ${line}`);
  }
}
console.log(`\n${files.length - failed}/${files.length} clear the bar (per bed: ${PLACES_PER_NIGHT} places a night, min ${PLACES_FLOOR}; ${MEALS_FLOOR} meals)`);
process.exit(failed ? 1 : 0);
