/**
 * The catalogue is shared, and the shared half never becomes a dependency.
 *
 * Researched packs were written to localStorage: one browser, capped at forty,
 * gone when that browser cleared. So the same destination was researched and
 * paid for again by every person who asked for it, and nothing anyone learned
 * ever reached anyone else. Fifteen hand-written destinations stayed fifteen
 * while hundreds of real researched places evaporated.
 *
 * That is the whole reason "know every travel location on earth" looked
 * impossible. Hand-researching an atlas does not converge: nine destinations
 * took three agents fifty minutes each, and one still ran out of verifiable
 * coordinates. Researching on demand and KEEPING it costs about twenty-five
 * cents and two minutes per place, once, for everyone.
 *
 * Two things have to stay true, and this file is here for the second one.
 */
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA SHARED CATALOGUE, AND NEVER A DEPENDENCY\x1b[0m\n");

const store = readFileSync("lib/packstore.ts", "utf8");
const flow = readFileSync("lib/flow.ts", "utf8");

check("it reads the shared table", /rest\/v1\/packs\?select=pack/.test(store));
check("and contributes back what it researches",
  /export async function sharePack/.test(store) && /void sharePack\(filled\)/.test(flow),
  "a pack nobody else can see is the bug this replaced");

/*
 * THE IMPORTANT ONE. The app worked offline before this and must still: no
 * network, no database, a blocked request, and she still gets the seeded
 * catalogue and this browser's own history. A catalogue that is bigger when
 * the network is there is an addition; one that is broken when it is not is
 * a regression dressed as a feature.
 */
const shared = store.slice(store.indexOf("async function sharedPacks"), store.indexOf("export async function sharePack"));
check("a failed read is swallowed, not thrown",
  /catch\s*\{\s*return \[\];\s*\}/.test(shared) && /if \(!r\.ok\) return \[\];/.test(shared),
  shared.replace(/\s+/g, " ").slice(0, 180));
const share = store.slice(store.indexOf("export async function sharePack"), store.indexOf("export function storedPacks"));
check("and a failed write is swallowed too", /catch\s*\{[^}]*\}/.test(share));
check("hydrate never awaits the network",
  /void sharedPacks\(\)\.then/.test(store) && /^export function hydratePacks\(\): number \{/m.test(store),
  "the first paint must not wait on a database");
check("the local store is still read first",
  store.indexOf("for (const pack of storedPacks())") < store.indexOf("void sharedPacks()"));

/*
 * And a researched pack is not the same thing as the hand-checked catalogue.
 * It is model-written and unverified against any source. Anything reading the
 * table has to be able to tell them apart, so provenance is recorded at the
 * point of writing rather than inferred later.
 */
check("every shared pack records how it was made",
  /provenance: "researched"/.test(store),
  "a researched pack must never be mistaken for a verified one");

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
