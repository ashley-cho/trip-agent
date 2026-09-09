/**
 * Nothing she entered leaves the session.
 *
 * "every single thing that the user types or selects must sustain in that
 * session at least."
 *
 * The transcript was already kept, but the brief was not: four sites cleared
 * fields mid-session, and the worst was the retry path in page.tsx, which set
 * namedDestination to undefined. Say Portugal, hit a failure somewhere else,
 * ask to try again, and Portugal is gone from the brief while still sitting on
 * her screen.
 *
 * The fix separates the two things that were tangled. Derived fields may still
 * change, because resolving an unknown place into a known one IS the work.
 * `stated` is the raw record, append-only, and nothing may take from it.
 */
import { readFileSync } from "node:fs";
import { applyPatch } from "@/lib/brief";
import { emptyBrief, stating } from "@/lib/types";
import type { Brief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  nothing she entered leaves the session\n");

// --- the record itself ----------------------------------------------------
let b = emptyBrief("i wanna go to portugal");
check("the opening is recorded", b.stated.length === 1 && b.stated[0].how === "typed");

b = stating(b, "5–7 days", "picked");
b = stating(b, "food and wine, nothing touristy", "typed");
check("typed and picked both land", b.stated.length === 3);
check("and are distinguishable", b.stated.map((s) => s.how).join(",") === "typed,picked,typed");
check("in the order she entered them",
  b.stated.map((s) => s.text)[1] === "5–7 days");

b = stating(b, "  ", "typed");
check("blank input is not recorded", b.stated.length === 3);
const dupe = stating(b, "food and wine, nothing touristy", "typed");
check("a chip echoed then re-interpreted is not recorded twice", dupe.stated.length === 3);

// --- the derived fields may change; this may not --------------------------
const after = applyPatch(b, {
  namedDestination: "portugal", unknownCandidates: undefined,
  candidates: undefined, regionIds: undefined,
} as Partial<Brief>);
check("applyPatch never shortens it", after.stated.length === 3);
check("even while clearing the derived fields it is allowed to clear",
  after.namedDestination === "portugal" && after.candidates === undefined);

// The retry case, exactly as page.tsx does it.
const retried: Brief = { ...after, namedDestination: undefined, candidates: undefined,
  regionIds: undefined, unknownCandidates: ["the faroe islands"] };
check("a retry may clear namedDestination", retried.namedDestination === undefined);
check("and Portugal is still on the brief, in her words",
  retried.stated.some((s) => /portugal/i.test(s.text)),
  JSON.stringify(retried.stated.map((s) => s.text)));

// --- and nothing in the codebase writes to it except stating() ------------
const src = ["lib/brief.ts", "lib/flow.ts", "app/page.tsx"]
  .map((f) => `\n/*FILE ${f}*/\n` + readFileSync(f, "utf8")).join("");
check("stated is only ever assigned by stating() or preserved whole",
  !/stated:\s*\[\]/.test(src.replace(/stated: brief\.stated \?\? \[\]/g, ""))
  && !/stated:.*\.filter\(/.test(src)
  && !/stated:.*\.slice\(/.test(src));
/*
 * `how` is now a parameter of `send`, because a freeform chip goes through it
 * as if she had typed the label — and the label was written by the model.
 * Both entry points still record before deriving; one of them just no longer
 * hard-codes whose words they are.
 */
check("both entry points record before deriving",
  /stating\(brief, text, how\)/.test(src) && /stating\(brief, label, "picked"\)/.test(src));
check("and typing is still the default",
  /how: "typed" \| "picked" = "typed"/.test(src));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
