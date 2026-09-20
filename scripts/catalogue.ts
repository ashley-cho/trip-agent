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
 *   npm run catalogue push     send what DIFFERS too, including over existing
 *                              rows. Needs SUPABASE_SERVICE_ROLE_KEY.
 *   npm run catalogue names    derive each pack's other names, offline
 *   npm run catalogue misses   what it was asked for and could not answer
 *
 * `restore` inserts and `push` updates, and the split is the anon key: the
 * app holds it, so it may add a pack it just researched and may never
 * overwrite one. Correcting a pack is an admin job and needs the other key.
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
  /*
   * Say when the table is about to overwrite something better.
   *
   * `save` pulls down and writes over. That is right when the local copy is
   * a stale backup and wrong when it is work that has not gone up yet, and
   * the two look identical from here. Four packs with two to three times the
   * places of their live rows were sitting in this directory when I nearly
   * ran this; nothing would have said a word.
   */
  const thinner: string[] = [];
  for (const row of rows) {
    try {
      const mine = JSON.parse(readFileSync(`${DIR}/${row.id}.json`, "utf8")) as Row;
      const had = mine.pack?.places?.length ?? 0;
      const incoming = row.pack?.places?.length ?? 0;
      if (had > incoming) thinner.push(`${row.id}: ${had} local -> ${incoming} from the table`);
    } catch { /* no local copy; nothing to lose */ }
    // One file per destination, so a diff shows which place changed rather
    // than one 1.8MB line moving.
    writeFileSync(`${DIR}/${row.id}.json`, `${JSON.stringify(row, null, 2)}\n`);
  }
  if (thinner.length) {
    console.warn(`\n${thinner.length} local pack(s) were RICHER than the table and have been overwritten:`);
    for (const t of thinner) console.warn(`  ${t}`);
    console.warn("git checkout data/catalogue to get them back, then `npm run catalogue push` first.\n");
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
 * Give every pack the names people actually use for it.
 *
 * NAMED_DESTINATIONS in lib/discovery.ts is 24 hand-written entries, one per
 * destination that shipped with the app. Everything since arrived by research
 * and none of it got a line, so a researched destination was findable only by
 * its id, its title, or one of its town names. With Nepal in the catalogue,
 * "himalayas" found nothing.
 *
 * Most of the names are already in the pack and just not indexed: the title
 * before its colon, the parts of a hyphenated id, the bases. Those are
 * derived here rather than typed, so this is re-runnable after every save and
 * a new destination is never nameless. EXTRA is the short list of names a
 * pack genuinely does not contain, which is the only part that is a judgment.
 *
 *   npm run catalogue names
 */
const EXTRA: Record<string, string[]> = {
  nepal: ["himalayas", "the himalayas", "annapurna", "everest", "everest base camp", "khumbu"],
  switzerland: ["swiss", "the swiss alps", "swiss alps", "the alps", "matterhorn", "jungfrau"],
  ireland: ["irish", "eire", "ring of kerry", "connemara", "northern ireland", "the burren"],
  norway: ["norwegian", "the fjords", "norwegian fjords", "lofoten", "arctic norway"],
};

function names() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  let touched = 0;
  for (const f of files) {
    const path = `${DIR}/${f}`;
    const row = JSON.parse(readFileSync(path, "utf8")) as Row;
    const d = row.pack.destination as unknown as Record<string, unknown>;
    const got = new Set<string>(((d.aliases as string[]) ?? []).map((a) => a.toLowerCase()));
    const add: string[] = [];
    const want = (a: string) => {
      const t = a.trim();
      if (t.length > 2 && t.length <= 60 && !got.has(t.toLowerCase())) { add.push(t); got.add(t.toLowerCase()); }
    };
    // "Albania: Tirana, the Accursed Mountains" is four names, not one.
    for (const part of String(d.name ?? "").split(/[:,]/)) want(part);
    // "corsica-sardinia" is two islands and people name one of them.
    for (const part of f.replace(/\.json$/, "").split("-")) want(part);
    for (const a of EXTRA[row.id] ?? []) want(a);
    if (!add.length) continue;
    d.aliases = [...((d.aliases as string[]) ?? []), ...add].slice(0, 12);
    writeFileSync(path, `${JSON.stringify(row, null, 2)}\n`);
    touched++;
  }
  console.log(`names written to ${touched} of ${files.length} packs`);
}

/**
 * Send the local packs up, including over rows that already exist.
 *
 * `restore` only inserts what is MISSING, and says so: "there is no update
 * policy on this table, so an upsert of a row that already exists is
 * refused". That is the correct policy for the anon key — anyone who can
 * open the app holds it, and a visitor must not be able to overwrite the
 * catalogue — but it left no path at all for a correction. A pack that went
 * up thin stayed thin forever, and a fix to one could never reach anybody.
 *
 * So this is the admin path, keyed the same way `misses` is: with the
 * service-role key, from her machine, never from the app. The anon policy is
 * untouched.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run catalogue push
 *
 * Only what differs is sent, because re-uploading a hundred and twenty packs
 * to change four of them makes the log useless for seeing what happened.
 */
async function push() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    console.error("Needs SUPABASE_SERVICE_ROLE_KEY. The anon key can insert but never\n"
      + "update, on purpose: everyone who can open the app holds it.\n\n"
      + "  SUPABASE_SERVICE_ROLE_KEY=... npm run catalogue push");
    process.exit(1);
  }
  const admin = { apikey: secret, authorization: `Bearer ${secret}` };
  const held = new Map((await every()).map((r) => [r.id, r]));
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  let sent = 0, same = 0;
  for (const f of files) {
    const row = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")) as Row;
    const there = held.get(row.id);
    // Compare the pack itself, not the row: the counts are derived from it.
    if (there && JSON.stringify(there.pack) === JSON.stringify(row.pack)) { same++; continue; }
    const body = {
      id: row.id, name: row.name, provenance: row.provenance ?? "researched",
      places: row.pack.places?.length ?? 0, cities: row.pack.cities?.length ?? 0,
      pack: row.pack,
    };
    const r = await fetch(`${url}/rest/v1/packs?on_conflict=id`, {
      method: "POST",
      headers: { ...admin, "content-type": "application/json", prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(body),
    });
    const was = there ? `${there.pack.places?.length ?? 0} -> ${body.places}` : `new, ${body.places}`;
    console.log(`${r.ok ? "pushed  " : `FAILED ${r.status}`} ${row.id} (${was})`);
    if (!r.ok) console.log(`         ${(await r.text()).slice(0, 160)}`);
    if (r.ok) sent++;
  }
  console.log(`\n${sent} pushed, ${same} unchanged, ${files.length - sent - same} failed`);
}

/**
 * What to add next, from evidence instead of from my taste.
 *
 * Ninety-six destinations went in today and every one of them was a guess
 * about what somebody would ask for. Some were good guesses. All of them were
 * guesses, and the next twelve would be too, because the fact that settles it
 * was being thrown away at the moment it was produced: giveUp console.warned
 * into one browser's devtools.
 *
 * It is recorded now. This reads it back, grouped, so the question "would you
 * add more places" has an answer that is not an opinion.
 *
 * Needs the service-role key, because the table is insert-only for anon on
 * purpose: a visitor must not be able to enumerate what other people failed
 * to find. Pass it in the environment, never in the repo:
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run catalogue misses
 */
async function misses() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    console.error("Needs SUPABASE_SERVICE_ROLE_KEY. The table is insert-only for\n"
      + "everyone else, so that nobody can read back what other people searched for.\n\n"
      + "  SUPABASE_SERVICE_ROLE_KEY=... npm run catalogue misses");
    process.exit(1);
  }
  const r = await fetch(`${url}/rest/v1/misses?select=subject,why,days,at&order=at.desc&limit=1000`, {
    headers: { apikey: secret, authorization: `Bearer ${secret}` },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const rows = (await r.json()) as { subject: string | null; why: string; days: number | null }[];
  if (!rows.length) { console.log("Nothing recorded yet."); return; }

  const bySubject = new Map<string, number>();
  const byReason = new Map<string, number>();
  for (const row of rows) {
    if (row.subject) bySubject.set(row.subject.toLowerCase(), (bySubject.get(row.subject.toLowerCase()) ?? 0) + 1);
    // The reason without its numbers, so "9 usable places" and "7 usable
    // places" are one kind of failure rather than two.
    const kind = row.why.replace(/\d+/g, "N").replace(/^[^:]+:\s*/, "");
    byReason.set(kind, (byReason.get(kind) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 20);

  console.log(`\n${rows.length} give-ups recorded.\n\nASKED FOR AND NOT ANSWERED\n`);
  for (const [s, n] of top(bySubject)) console.log(`  ${String(n).padStart(4)}  ${s}`);
  console.log(`\nWHY IT GAVE UP\n`);
  for (const [s, n] of top(byReason)) console.log(`  ${String(n).padStart(4)}  ${s}`);
  console.log("");
}

const verb = process.argv[2];
if (verb === "names") { names(); process.exit(0); }

void (verb === "restore" ? restore() : verb === "push" ? push()
  : verb === "misses" ? misses() : save()).catch((e) => {
  console.error(`${e.message}\n\nNeeds network to supabase.co — run it from your own machine.`);
  process.exit(1);
});
