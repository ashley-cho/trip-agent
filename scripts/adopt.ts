/**
 * Take a pack researched anywhere and put it through the same gate.
 *
 * The generation and the validation are two different jobs, and I conflated
 * them. Because the catalogue must hold one kind of pack, I ran the whole
 * pipeline through the deployed app — which meant the RESEARCH went through
 * her paid API too, at about 27c a destination, sixty-seven times.
 *
 * The validation was never the part that needed the API. validatePack and
 * validatePlaceList run right here, offline, for free, and they are the only
 * thing that decides whether a pack is the same shape as every other pack.
 * So the model call was buying content, not fidelity, and content is
 * something an agent in the session can write at no cost to her balance.
 *
 * This is that gate, pointed at a file instead of at a response.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { validatePack, minimumToPlan, plannable, usablePlaces } from "@/lib/research";

const IN = process.argv[2] ?? "/tmp/agentpacks";
/*
 * Straight into the directory git keeps.
 *
 * The first version wrote to /tmp and a second command copied it to a
 * gitignored .seed/, which is two mechanisms for one job and the kind of
 * redundancy that ends with the two disagreeing. data/catalogue/ is where
 * `npm run catalogue` already saves the table, in the same row shape, so a
 * pack adopted here and a pack pulled from the table are the same file and
 * `npm run catalogue restore` sends either of them up.
 */
const OUT = "data/catalogue";
const DAYS = 7;
mkdirSync(OUT, { recursive: true });

let ok = 0;
for (const f of readdirSync(IN).filter((x) => x.endsWith(".json"))) {
  const raw = JSON.parse(readFileSync(`${IN}/${f}`, "utf8"));
  const { pack, problems } = validatePack(raw, []);
  if (!pack) {
    console.log(`REJECT ${f}: ${problems.slice(0, 3).join("; ")}`);
    continue;
  }
  const usable = usablePlaces(pack);
  const good = plannable(pack, DAYS);
  const dropped = problems.length;
  console.log(`${good ? "OK    " : "THIN  "} ${pack.destination.id.padEnd(22)} `
    + `${pack.cities.length} bases, ${pack.places.length} places, ${usable} usable `
    + `(needs ${minimumToPlan(DAYS)})${dropped ? `, ${dropped} dropped by validation` : ""}`);
  if (dropped) for (const p of problems.slice(0, 4)) console.log(`         - ${p}`);
  if (good) {
    // The row shape, not the bare pack, so restore can send it as-is.
    const row = {
      id: pack.destination.id, name: pack.destination.name, provenance: "researched",
      places: pack.places.length, cities: pack.cities.length, pack,
    };
    writeFileSync(`${OUT}/${row.id}.json`, `${JSON.stringify(row, null, 2)}\n`);
    ok++;
  }
}
console.log(`\n${ok} written to ${OUT}/`);
