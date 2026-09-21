/**
 * How much of what people ask for can the catalogue answer by itself?
 *
 * The catalogue is enriched for two reasons: a brief it can serve costs no
 * tokens, and it still gets answered when there is no model. `eval:dead`
 * HELD is a proxy for that over 23 scripted conversations. This is the thing
 * itself: take real openings — the twelve the app prints in its own box, a
 * fixed set of the sentences people actually type, and every sentence in
 * the misses table when the service key is present — and ask, for each, what
 * the offline path does with it.
 *
 *   gate     the offline gate refuses it: a word would be dropped
 *   named    she named somewhere we hold; the catalogue answers outright
 *   research she named somewhere we do not hold; needs a model to look up
 *   served   nowhere named, and the shelf answers from the catalogue
 *   weak     the shelf answers, but not well (thin, weak, or missing an activity)
 *   cannot   the shelf cannot represent something she said
 *
 * The number to move is the share of place-free briefs that are `served`.
 * What moves it is written under CANNOT and WEAK: those are the packs and
 * the fields to add next, in order of how often they were asked for.
 *
 *   npm run coverage:shelf
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run coverage:shelf     (adds real briefs)
 */
import { interpretRules } from "@/lib/discovery";
import { orphanWords, lookupOnly } from "@/lib/lookup";
import { applyPatch } from "@/lib/brief";
import { emptyBrief } from "@/lib/types";
import type { Brief } from "@/lib/types";
import { shelf } from "@/lib/shelf";
import { namesSomewhere, subjects } from "@/lib/subject";
import { isKnownDestination } from "@/data/destinations";
import { OPENERS } from "@/lib/openers";
import { supabaseConfig } from "@/lib/supabase-config";

/** Sentences people type. Kept plain and varied on purpose; add, never prune. */
const TYPED = [
  "somewhere warm with good food, a week, not too touristy",
  "i wanna go to croatia for 1-2 weeks",
  "i wanna climb the himalayas. duration of the trip - i'm flexible",
  "japan but somewhere cheap",
  "somewhere with beaches and hiking, 10 days",
  "a long weekend somewhere I can just read by a pool",
  "i want to see the northern lights",
  "wine country for a week",
  "somewhere cold and quiet in february",
  "big city, great food, five days, i've done paris and tokyo",
  "a road trip with a lot of nature, two weeks",
  "scuba diving and not much else",
  "somewhere in europe i haven't been, i've done italy spain and portugal",
  "hot springs and good ramen",
  "safari, see big animals",
  "a week of hiking, nothing too hard",
  "somewhere warm in december under $2000",
  "island hopping, ten days",
  "i want to surf every morning and eat well every night",
  "somewhere with castles and a lot of history",
  "desert, stars, silence",
  "i want to go to mexico but not cancun",
  "somewhere my parents would like too, easy walking, good food",
  "a city break with museums and a proper coffee scene",
  "skiing in january, a week",
  "somewhere tropical i can get to without a long flight",
  "temples, markets and street food",
  "the alps in summer",
  "somewhere that looks nothing like home",
  "i've got 5 days and $1500",
];

type Verdict = "gate" | "named" | "research" | "served" | "weak" | "cannot";

function classify(said: string): { verdict: Verdict; why: string } {
  let b: Brief = emptyBrief(said);
  const bare = lookupOnly(said);
  const orphan = bare ? [] : orphanWords(said);
  b = applyPatch(b, bare ? { ...bare.patch, namedDestination: bare.destinationId } : interpretRules(said, b));
  if (orphan.length) return { verdict: "gate", why: `would drop ${orphan.join(", ")}` };
  if (b.namedDestination && isKnownDestination(b.namedDestination)) return { verdict: "named", why: b.namedDestination };
  if (subjects(b).length) return { verdict: "research", why: subjects(b).join(", ") };
  if (namesSomewhere(b)) return { verdict: "named", why: b.candidates?.join("/") ?? b.regionLabel ?? "region" };
  const s = shelf(b);
  if (s.cannot.length) return { verdict: "cannot", why: s.cannot.join(", ") };
  if (s.weak) return { verdict: "weak", why: `${s.rec?.destinationId}: ${s.weak}` };
  return { verdict: "served", why: s.rec?.destinationId ?? "?" };
}

async function realBriefs(): Promise<string[]> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return [];
  const { url } = supabaseConfig();
  const r = await fetch(`${url}/rest/v1/misses?select=said&said=not.is.null&order=at.desc&limit=500`, {
    headers: { apikey: secret, authorization: `Bearer ${secret}` },
  });
  if (!r.ok) { console.warn(`misses: ${r.status}`); return []; }
  const rows = (await r.json()) as { said: string }[];
  return [...new Set(rows.map((x) => x.said.trim()).filter(Boolean))];
}

async function main() {
  const real = await realBriefs();
  const sets: [string, string[]][] = [["openers", OPENERS], ["typed", TYPED]];
  if (real.length) sets.push(["real", real]);

  const totals = new Map<Verdict, number>();
  const cannot = new Map<string, number>();
  const weak = new Map<string, number>();
  const gate = new Map<string, number>();
  let placeFree = 0, served = 0;

  for (const [name, list] of sets) {
    console.log(`\n  ${name.toUpperCase()}  (${list.length})\n`);
    for (const said of list) {
      const { verdict, why } = classify(said);
      totals.set(verdict, (totals.get(verdict) ?? 0) + 1);
      if (verdict === "served" || verdict === "weak" || verdict === "cannot") placeFree++;
      if (verdict === "served") served++;
      if (verdict === "cannot") for (const w of why.split(", ")) cannot.set(w, (cannot.get(w) ?? 0) + 1);
      if (verdict === "weak") weak.set(why.replace(/^\w+: /, ""), (weak.get(why.replace(/^\w+: /, "")) ?? 0) + 1);
      if (verdict === "gate") for (const w of why.replace(/^would drop /, "").split(", ")) gate.set(w, (gate.get(w) ?? 0) + 1);
      console.log(`  ${verdict.padEnd(9)} ${said.slice(0, 58).padEnd(60)} ${why.slice(0, 50)}`);
    }
  }

  const top = (m: Map<string, number>, n = 12) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
  console.log(`\n  TOTALS\n`);
  for (const v of ["served", "weak", "cannot", "named", "research", "gate"] as Verdict[]) {
    console.log(`  ${String(totals.get(v) ?? 0).padStart(4)}  ${v}`);
  }
  console.log(`\n  SHELF  ${placeFree ? Math.round((100 * served) / placeFree) : 0}%  `
    + `of place-free briefs answered from the catalogue (${served}/${placeFree})\n`);
  if (cannot.size) { console.log("  CANNOT SERVE (packs or places to add)\n"); for (const [w, n] of top(cannot)) console.log(`  ${String(n).padStart(4)}  ${w}`); console.log(""); }
  if (weak.size) { console.log("  WEAK (the pick exists but is thin)\n"); for (const [w, n] of top(weak)) console.log(`  ${String(n).padStart(4)}  ${w}`); console.log(""); }
  if (gate.size) { console.log("  GATE (words the parser drops; parser work, not catalogue work)\n"); for (const [w, n] of top(gate)) console.log(`  ${String(n).padStart(4)}  ${w}`); console.log(""); }
}

main().catch((e) => { console.error(e); process.exit(1); });
