/**
 * Regression: a thin research result is not a reason to send her somewhere else.
 *
 * "i'm a tennis fan and wanna go to indian wells", three days, maximum matches.
 * Four good exchanges, a genuinely excellent answer about staying ten minutes
 * from the Tennis Garden, and then:
 *
 *   "only 7 usable places came back, not enough to plan a trip Let me give you
 *    the closest thing I can plan properly."
 *   "Skip the tournament grounds this time. You're going to the Big Sur coast."
 *
 * Three separate failures in two sentences. The floor was a flat eight places
 * for a trip of any length, so seven, which is a comfortable long weekend, threw
 * the whole destination away before the per-base fill-in ever ran. The message
 * quoted the machinery at her, and did it without a full stop. And the pitch
 * then argued a coastline as the answer to a tennis brief.
 */
import { validatePack, enoughToPlan, placesNeeded, plannable, minimumToPlan } from "@/lib/research";
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mSEVEN PLACES IS A LONG WEEKEND\x1b[0m\n");

const place = (i: number) => ({
  id: `p${i}`, cityId: "indian-wells", name: `Place ${i}`, kind: "sight",
  tags: ["local"], neighborhood: "Central", lat: 33.72 + i / 1000, lng: -116.34,
  durationMin: 90, costUsd: 20, bestTime: "any", touristy: 3,
  note: `Worth an hour, number ${i}.`,
});

const pack = (n: number) => ({
  id: "indian-wells", name: "Indian Wells",
  pitch: "Desert tennis, in March.",
  strengths: { outdoors: 4 }, paceFit: ["mixed"],
  flightUsd: 400, floorPerDayUsd: 200, minDays: 2, warmth: 5, arrival: "fly",
  because: ["The tournament"],
  cities: [{ id: "indian-wells", name: "Indian Wells", lat: 33.72, lng: -116.34,
             nightlyUsd: 220, minNights: 2, maxNights: 5, base: "By the Tennis Garden." }],
  places: Array.from({ length: n }, (_, i) => place(i)),
});

// Her case, exactly.
{
  const r = validatePack(pack(7));
  check("seven places still produces a destination", !!r.pack,
    r.pack ? `${r.pack.places.length} places` : r.problems.join("; "));
  check("and three days can be planned from it",
    !!r.pack && enoughToPlan(r.pack, 3), `needs ${placesNeeded(3)}`);
}

// The floor still exists; it just tests the right thing.
{
  const r = validatePack(pack(7));
  check("twelve days cannot, so the fill-in has to top it up",
    !!r.pack && !enoughToPlan(r.pack, 12), `needs ${placesNeeded(12)}`);
  const filled = r.pack && { ...r.pack, places: [...r.pack.places, ...Array.from({ length: 20 }, (_, i) => ({ ...r.pack!.places[0], id: `x${i}` }))] };
  check("and once it has, twelve days can", !!filled && enoughToPlan(filled, 12));
}

// The Yucatan. The spine ran out of output tokens after its cities, so zero
// places came back and a week she had already been sold, four nights in Tulum
// and three in Valladolid, turned into Barcelona. Cities are the spine; the
// places arrive from the per-base passes straight afterwards.
{
  const r = validatePack(pack(0));
  check("a spine with cities but no places still produces a destination", !!r.pack,
    r.pack ? `${r.pack.cities.length} cities` : r.problems.join("; "));
  check("and keeps its cities for the fill-in to populate",
    !!r.pack && r.pack.cities.length === 1);
  check("but cannot be planned until something lands in them",
    !!r.pack && !enoughToPlan(r.pack, 7));
}

// The Faroe Islands. Seven days, a good three-base shape, and two of the three
// fill-in calls failed. Ten places is a week with a thing a day; it is not a
// reason to send someone to Paris.
{
  const r = validatePack(pack(10));
  check("ten places for a week is thin but plannable",
    !!r.pack && plannable(r.pack, 7) && !enoughToPlan(r.pack, 7),
    `have 10, want ${placesNeeded(7)}, give up below ${minimumToPlan(7)}`);
  const thin = validatePack(pack(3));
  check("three is not", !!thin.pack && !plannable(thin.pack, 7));
}

// A spine with nothing at all in it is still a failure.
check("no cities is not a destination",
  !validatePack({ ...pack(0), cities: [] }).pack);

// What she reads.
{
  // lib/fill.ts holds the per-base fill-in, which used to live inside
  // flow.ts. It is read here because that is where the retry now is, not
  // because a second copy of it exists anywhere.
  const page = readFileSync("app/page.tsx", "utf8")
    + readFileSync("lib/flow.ts", "utf8")
    + readFileSync("lib/fill.ts", "utf8");
  check("the failure message never interpolates the internal problem",
    !/\$\{failure\}/.test(page));
  const research = readFileSync("lib/research.ts", "utf8");
  check("and 'not enough to plan a trip' is gone from the data layer",
    !/not enough to plan a trip/.test(research));
  check("a base that comes back with nothing is asked once more",
    /Ask again for the bases that came back with nothing/.test(page)
    && /empty\.map\(ask\)/.test(page));
  // planDays, not days: the researcher is now told the length she actually
  // gave, which may be nothing, while the scheduler keeps effectiveDays'
  // default. Two bars, same as before, different variable.
  check("giving up is judged by a lower bar than fetching more",
    /plannable\(filled, planDays\)/.test(page) && /enoughToPlan\(pack, planDays\)/.test(page));
  check("and no question is ever asked with the identical sentence twice",
    /askedRef/.test(page) && /REASK/.test(page));
  const llm = readFileSync("lib/agent/llm.ts", "utf8");
  check("truncated model answers are no longer silent",
    /stop_reason === "max_tokens"/.test(llm));
  check("the substitute is no longer pitched as the closest thing they were after",
    !/closest thing to what they were actually after/.test(llm));
  check("and the pitch is told to say plainly when it's a different trip",
    /different trip rather than a replacement/.test(llm));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
