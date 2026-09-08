/**
 * The reliability sweep.
 *
 * Everything in `npm run eval` runs on seeded data through the rules driver:
 * free, fast, and blind to the entire research pipeline. Every serious failure
 * this week lived in exactly that blind spot. A Friday-only market on a Monday,
 * a fill-in that dropped every place it fetched, a destination abandoned for
 * being thin, a week in the Faroes turning into New Zealand.
 *
 * So this runs the real thing: real model calls, real web research, real
 * validation, real planner, on a spread of destinations neither of us picked
 * while staring at a bug. It costs money, which is why it is a script you run
 * deliberately and not something wired into a build.
 *
 *   npx tsx scripts/sweep-research.ts             # the full list
 *   npx tsx scripts/sweep-research.ts --only 5    # first five, for a smoke test
 *   npx tsx scripts/sweep-research.ts --lanes 2   # gentler on rate limits
 *
 * It never prints the API key and never sends it anywhere but Anthropic.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fetch as uFetch, ProxyAgent } from "undici";

/*
 * Two things node gets wrong that curl gets right, on a machine behind an
 * egress proxy. Node's global fetch ignores http_proxy entirely, and node
 * carries its own CA list so it rejects the proxy's intercepting certificate.
 * Between them they produce a bare "Connection error" that reads exactly like
 * a blocked network. Neither changes which key is used or where it goes.
 */
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) {
  const agent = new ProxyAgent(new URL(proxyUrl).href);
  (globalThis as unknown as { fetch: unknown }).fetch =
    ((input: unknown, init: Record<string, unknown> = {}) =>
      uFetch(input as never, { ...init, dispatcher: agent } as never)) as unknown;
}

import { createLlmDriver, anthropicTransport } from "@/lib/agent/llm";
import {
  placesPerCity, validatePlaceList, plannable, enoughToPlan,
  type DestinationPack,
} from "@/lib/research";
import { registerPack } from "@/data/registry";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { critique } from "@/lib/critic";
import { usdFor } from "@/lib/cost";
import { emptyBrief, emptyProfile, type Brief, type ItineraryDay } from "@/lib/types";

/* ---------------------------------------------------------------- the key */

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  for (const f of [".env.local", ".env"]) {
    try {
      const m = readFileSync(f, "utf8").match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch { /* next */ }
  }
  console.error("No ANTHROPIC_API_KEY in the environment or .env.local.");
  process.exit(1);
}

/* --------------------------------------------------------------- the runs */

/**
 * Deliberately not the places I have been debugging. A spread of continents,
 * trip lengths and reasons for going, plus the shapes that have broken before:
 * somewhere tiny, somewhere built around one event, somewhere dense enough to
 * fill a fortnight, and somewhere the catalogue has never heard of.
 */
interface Case { place: string; days: number; interests: string; why: string }

const CASES: Case[] = [
  { place: "the Faroe Islands", days: 7, interests: "hiking, cliffs, nature", why: "tiny, genuinely sparse" },
  { place: "Slovenia", days: 10, interests: "food and mountains", why: "medium, multi-base" },
  { place: "Indian Wells", days: 3, interests: "the tennis tournament, as many matches as possible", why: "one event, short" },
  { place: "the Yucatan", days: 7, interests: "beaches, ruins, cenotes", why: "the truncation case" },
  { place: "Georgia the country", days: 9, interests: "wine, mountains, food", why: "unfamiliar, ambiguous name" },
  { place: "Taipei", days: 5, interests: "night markets, food, hot springs", why: "single dense city" },
  { place: "Namibia", days: 12, interests: "desert, wildlife, self-drive", why: "long, huge distances" },
  { place: "Puglia", days: 8, interests: "food, coastline, small towns", why: "region not a country" },
  { place: "Hokkaido", days: 10, interests: "food, onsen, driving", why: "seasonal, sparse in winter" },
  { place: "the Scottish Highlands", days: 6, interests: "walking, whisky, castles", why: "region, weather-driven" },
  { place: "Oaxaca", days: 6, interests: "food, markets, craft", why: "city plus surroundings" },
  { place: "Jordan", days: 8, interests: "ruins, desert, diving", why: "long hops between bases" },
  { place: "the Azores", days: 7, interests: "hiking, hot springs, whales", why: "islands, ferry logistics" },
  { place: "Kyrgyzstan", days: 11, interests: "mountains, horses, yurts", why: "thin coverage, hard logistics" },
  { place: "Lisbon", days: 4, interests: "food, viewpoints, tiles", why: "long weekend, dense, in catalogue" },
];

/* ------------------------------------------------------------- the report */

interface Row {
  place: string; why: string; days: number;
  ok: boolean; problem?: string;
  cities: number; spinePlaces: number; places: number;
  filledDays: number; emptyMiddle: number; things: number;
  closedDayHits: number; otherIssues: number;
  fallbacks: number; reasons: string[];
  seconds: number; usd: number;
}

const arg = (name: string, dflt: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
};

async function runCase(c: Case): Promise<Row> {
  const t0 = Date.now();
  // A driver per case, so usage and fallbacks describe this trip alone.
  const driver = createLlmDriver(anthropicTransport(apiKey()));
  const row: Row = {
    place: c.place, why: c.why, days: c.days, ok: false,
    cities: 0, spinePlaces: 0, places: 0, filledDays: 0, emptyMiddle: 0, things: 0,
    closedDayHits: 0, otherIssues: 0, fallbacks: 0, reasons: [], seconds: 0, usd: 0,
  };
  const finish = () => {
    row.seconds = Math.round((Date.now() - t0) / 1000);
    row.fallbacks = driver.stats?.fallbacks ?? 0;
    const u = driver.usage?.();
    row.usd = u ? Number(usdFor(u).toFixed(3)) : 0;
    if (driver.stats?.lastError) row.reasons.push(driver.stats.lastError);
    return row;
  };

  try {
    const { pack, problem } = await driver.research!(c.place, c.days, "San Francisco", c.interests);
    if (!pack) { row.problem = problem ?? "no pack"; return finish(); }
    row.cities = pack.cities.length;
    row.spinePlaces = pack.places.filter((p) => !p.skip).length;

    // The same fill-in the app does, including the retry of empty bases.
    let filled: DestinationPack = pack;
    if (!enoughToPlan(pack, c.days)) {
      const cities = pack.cities.slice(0, 5);
      const perCity = placesPerCity(c.days, cities.length);
      let places = pack.places;
      const absorb = (raw: unknown) => {
        if (!raw) return 0;
        const { places: extra } = validatePlaceList(raw, pack.destination.id, pack.cities, places);
        places = [...places, ...extra];
        return extra.length;
      };
      const ask = async (city: { id: string; name: string }) => {
        try {
          const r = await driver.researchPlaces!(
            pack.destination.name, city.id, city.name, perCity, c.interests,
          );
          return r.places;
        } catch { return undefined; }
      };
      const first = await Promise.all(cities.map(ask));
      const empty = cities.filter((_, i) => absorb(first[i]) === 0);
      if (empty.length) (await Promise.all(empty.map(ask))).forEach(absorb);
      filled = { ...pack, places };
    }
    row.places = filled.places.filter((p) => !p.skip).length;

    if (!plannable(filled, c.days)) { row.problem = "too thin to plan"; return finish(); }
    registerPack(filled);

    let brief: Brief = { ...emptyBrief(), days: c.days, namedDestination: filled.destination.id, activities: c.interests ? [c.interests] : undefined };
    const rec = recommend(brief, emptyProfile());
    if (rec.destinationId !== filled.destination.id) {
      row.problem = `recommended ${rec.destinationId} instead`;
      return finish();
    }
    const trip = planTrip(brief, rec, emptyProfile());
    const days: ItineraryDay[] = trip.days;
    const activity = (d: ItineraryDay) =>
      d.items.filter((i) => i.type === "activity" || i.type === "meal").length;
    row.things = days.reduce((n: number, d: ItineraryDay) => n + activity(d), 0);
    row.filledDays = days.filter((d: ItineraryDay) => activity(d) > 0).length;
    row.emptyMiddle = days.filter(
      (d: ItineraryDay, i: number) => i > 0 && i < days.length - 1 && activity(d) === 0,
    ).length;

    const issues = critique(trip, brief, emptyProfile());
    row.closedDayHits = issues.filter((i) => i.code === "closed_venue").length;
    row.otherIssues = issues.length - row.closedDayHits;
    row.ok = true;
  } catch (e) {
    row.problem = (e as Error).message?.slice(0, 120) ?? String(e);
  }
  return finish();
}

/* ----------------------------------------------------------------- runner */

async function main() {
  const only = arg("only", CASES.length);
  const lanes = arg("lanes", 3);
  const skip = arg("skip", 0);
  const cases = CASES.slice(skip, skip + only);
  console.log(`\n\x1b[1mRELIABILITY SWEEP\x1b[0m  ${cases.length} destinations, ${lanes} at a time\n`);

  const rows: Row[] = [];
  const queue = [...cases];
  await Promise.all(Array.from({ length: Math.max(1, lanes) }, async () => {
    for (;;) {
      const c = queue.shift();
      if (!c) return;
      const r = await runCase(c);
      rows.push(r);
      const mark = r.ok ? "\x1b[32m ok \x1b[0m" : "\x1b[31mFAIL\x1b[0m";
      console.log(`  ${mark} ${r.place.padEnd(26)} ${String(r.seconds).padStart(3)}s  ${String(r.places).padStart(3)} places  `
        + `${r.filledDays}/${r.days} days filled  ${r.emptyMiddle} blank  `
        + `${r.closedDayHits ? `\x1b[31m${r.closedDayHits} closed-day\x1b[0m  ` : ""}`
        + `${r.fallbacks ? `${r.fallbacks} fell back  ` : ""}$${r.usd.toFixed(2)}`
        + `${r.problem ? `\n         ${r.problem}` : ""}`);
    }
  }));

  rows.sort((a, b) => cases.findIndex((c) => c.place === a.place) - cases.findIndex((c) => c.place === b.place));
  const planned = rows.filter((r) => r.ok);
  const sum = (f: (r: Row) => number) => rows.reduce((n, r) => n + f(r), 0);

  console.log(`\n\x1b[1mSUMMARY\x1b[0m`);
  console.log(`  planned                 ${planned.length}/${rows.length}`);
  console.log(`  with a blank middle day ${planned.filter((r) => r.emptyMiddle > 0).length}/${planned.length}`);
  console.log(`  with a closed-day hit   ${planned.filter((r) => r.closedDayHits > 0).length}/${planned.length}`);
  console.log(`  any fallback            ${rows.filter((r) => r.fallbacks > 0).length}/${rows.length}`);
  console.log(`  things per day          ${(sum((r) => r.things) / Math.max(1, sum((r) => r.ok ? r.days : 0))).toFixed(2)}`);
  console.log(`  median seconds          ${[...rows.map((r) => r.seconds)].sort((a, b) => a - b)[Math.floor(rows.length / 2)]}`);
  console.log(`  total spend             $${sum((r) => r.usd).toFixed(2)}\n`);

  mkdirSync("evals", { recursive: true });
  const out = `evals/sweep-research.json`;
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
  console.log(`  written to ${out}\n`);
}

void main();
