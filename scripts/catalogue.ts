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
 *   npm run catalogue          save every pack to data/catalogue/
 *   npm run catalogue restore  push anything missing back up
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

/**
 * And packs researched in a session rather than through the API.
 *
 * `npm run catalogue push` sends everything in .seed/ that the table does not
 * already hold. They have already been through validatePack in
 * scripts/adopt.ts, which is the same gate the app's own research passes, so
 * this is a transfer and not a decision.
 */
async function push() {
  const held = new Set((await every()).map((r) => r.id));
  const files = readdirSync(".seed").filter((f) => f.endsWith(".json"));
  let sent = 0;
  for (const f of files) {
    const pack = JSON.parse(readFileSync(`.seed/${f}`, "utf8")) as DestinationPack;
    const id = pack.destination?.id;
    if (!id) { console.log(`skip ${f}: no destination id`); continue; }
    if (held.has(id)) { console.log(`held ${id}: already in the table`); continue; }
    const r = await fetch(`${url}/rest/v1/packs`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        id, name: pack.destination.name, provenance: "researched",
        places: pack.places?.length ?? 0, cities: pack.cities?.length ?? 0, pack,
      }),
    });
    console.log(`${r.ok ? "pushed  " : `FAILED ${r.status}`} ${id} (${pack.places?.length ?? 0} places)`);
    if (!r.ok) console.log(`         ${(await r.text()).slice(0, 160)}`);
    if (r.ok) sent++;
  }
  console.log(`\n${sent} pushed`);
}

const verb = process.argv[2];
void (verb === "restore" ? restore() : verb === "push" ? push() : save()).catch((e) => {
  console.error(`${e.message}\n\nNeeds network to supabase.co — run it from your own machine.`);
  process.exit(1);
});
