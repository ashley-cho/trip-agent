/**
 * The shared catalogue, in a file you own.
 *
 * lib/backup.ts already argues this for her trips, and the argument is just
 * as true one layer down: every persistence trick below a file you hold is a
 * policy, not a guarantee. The sixty-seven researched destinations are the
 * most expensive thing this project has ever produced — about $18 and an
 * afternoon of model calls — and they live in exactly one place:
 *
 *   - one table, in one free-tier Postgres project;
 *   - which pauses after a week of no traffic;
 *   - whose insert policy is open to anon, because the publishable key is in
 *     the repo by design, so anybody who can open the app can also write to
 *     it;
 *   - with no export, anywhere, until this file.
 *
 * There is no delete policy, so nothing can be removed by a visitor, and that
 * is the only thing standing between a day's work and a bad afternoon.
 *
 * So: pull it down, write it to data/catalogue/, and let git hold it. Then
 * the worst case is a restore rather than $18 and an afternoon.
 *
 *   npm run catalogue          save every pack in the table to data/catalogue/
 *   npm run catalogue restore  send anything in data/catalogue/ the table lacks
 *
 * scripts/adopt.ts writes the same shape into the same directory, so a pack
 * researched in a session and a pack pulled from the table are one kind of
 * file and restore sends either.
 *
 * Run it from a machine with network to supabase.co. The sandbox this was
 * written in is not one, which is why it is a script and not a fait accompli.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { supabaseConfig } from "../lib/supabase-config";
import type { DestinationPack } from "../lib/research";

const DIR = "data/catalogue";
const { url, key } = supabaseConfig();
const auth = { apikey: key, authorization: `Bearer ${key}` };

interface Row { id: string; name: string; provenance: string; places: number; cities: number; pack: DestinationPack }

/** Paged, because "limit 200" is a number that will be wrong one day. */
async function every(): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 100) {
    const r = await fetch(`${url}/rest/v1/packs?select=*&order=id.asc`, {
      headers: { ...auth, range: `${from}-${from + 99}` },
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const page = (await r.json()) as Row[];
    out.push(...page);
    if (page.length < 100) return out;
  }
}

async function save() {
  const rows = await every();
  mkdirSync(DIR, { recursive: true });
  for (const row of rows) {
    // One file per destination, so a diff shows which place changed rather
    // than one 1.8MB line moving.
    writeFileSync(`${DIR}/${row.id}.json`, `${JSON.stringify(row, null, 2)}\n`);
  }
  const places = rows.reduce((n, r) => n + (r.places ?? 0), 0);
  console.log(`saved ${rows.length} destinations, ${places} places → ${DIR}/`);
}

async function restore() {
  const held = new Set((await every()).map((r) => r.id));
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  let sent = 0;
  for (const f of files) {
    const row = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")) as Row;
    // Only what is missing. There is no update policy on this table, so an
    // upsert of a row that already exists is refused, and re-sending every
    // pack to find that out is noise.
    if (held.has(row.id)) continue;
    const r = await fetch(`${url}/rest/v1/packs`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        id: row.id, name: row.name, provenance: row.provenance ?? "researched",
        places: row.pack.places?.length ?? 0, cities: row.pack.cities?.length ?? 0,
        pack: row.pack,
      }),
    });
    console.log(`${r.ok ? "restored" : `FAILED ${r.status}`} ${row.id}`);
    if (r.ok) sent++;
  }
  console.log(`\n${sent} restored, ${files.length - sent} already there`);
}

void (process.argv[2] === "restore" ? restore() : save()).catch((e) => {
  console.error(`${e.message}\n\nNeeds network to supabase.co — run it from your own machine.`);
  process.exit(1);
});
