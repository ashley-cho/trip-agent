/**
 * The harness measures the product, not a description of it.
 *
 * Twice in one day the scorecard was flattering and wrong: evals/dead.ts
 * defaulted to a narrower offline gate than the one that shipped, and it
 * filled the `suggest` seam with a ranking production never had. Both were
 * re-descriptions of lib/client.ts in the harness's own words, and the words
 * drifted. Two rules, checked here:
 *
 *   1. The dead driver's verdicts are lib/offline.ts's verdicts, on every
 *      message. Not a copy of the rule: the rule.
 *
 *   2. A regress script that reads source with readFileSync and regex-matches
 *      it asserts that a line exists, not that the product does something. It
 *      is how "unit-green, product-broken" happened here more than once. The
 *      count may not go up. It is a ratchet: converting one to a behavioural
 *      test means editing the number down.
 */
import { readdirSync, readFileSync } from "node:fs";
import { deadDriver } from "@/evals/dead";
import { offlineInterpret, offlineEdit } from "@/lib/offline";
import { emptyBrief, emptyProfile } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { applyPatch } from "@/lib/brief";
import { interpretRules } from "@/lib/discovery";
import { OPENERS } from "@/lib/openers";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

async function main() {
  console.log("\n  the harness measures the product\n");

  // --- 1. the dead driver IS the offline gate ------------------------------
  {
    const d = deadDriver();
    const messages = [
      ...OPENERS,
      "i wanna visit japan", "japan but somewhere cheap", "somewhere warm with good food, a week, not too touristy",
      "scuba dive coral reefs for ten days", "we want to go to portugal for the surfing and the seafood",
    ];
    let agree = 0;
    const disagree: string[] = [];
    for (const m of messages) {
      const b = emptyBrief(m);
      const rule = offlineInterpret(m, b);
      let driver: "patch" | "stop";
      let patch: unknown;
      try { patch = await d.interpret(m, b); driver = "patch"; } catch { driver = "stop"; }
      const same = ("patch" in rule) === (driver === "patch")
        && (!("patch" in rule) || JSON.stringify(rule.patch) === JSON.stringify(patch));
      if (same) agree++; else disagree.push(m);
    }
    check("the dead driver's interpret agrees with lib/offline.ts on every message",
      disagree.length === 0, `${agree}/${messages.length}; disagree: ${disagree.join(" | ")}`);

    const b = applyPatch(emptyBrief("portugal for a week"), interpretRules("portugal for a week", emptyBrief("x")));
    const trip = planTrip(b, recommend(b), emptyProfile());
    let editsAgree = true;
    for (const e of ["slow it down", "make it cheaper", "skip dubrovnik and add plitvice", "add a free afternoon on day 2"]) {
      const rule = offlineEdit(e, trip);
      let got: unknown; let stopped = false;
      try { got = await d.parseEdit(e, trip); } catch { stopped = true; }
      if (("ops" in rule) === stopped) editsAgree = false;
      if ("ops" in rule && JSON.stringify(rule.ops) !== JSON.stringify(got)) editsAgree = false;
    }
    check("and its parseEdit agrees with lib/offline.ts", editsAgree);
    check("and its suggest fails the way the server's does with no model",
      !!(await d.suggest?.(b))?.problem);
  }

  // --- 2. source-reading tests may not multiply ----------------------------
  {
    const scripts = readdirSync("scripts").filter((f) => /^regress-.*\.ts$/.test(f) && f !== "regress-harness.ts");
    const readers = scripts.filter((f) => /readFileSync\("(?:lib|app|components|evals|data)\//.test(readFileSync(`scripts/${f}`, "utf8")));
    /*
     * 24 when this was written. Every one is a test that a line of source
     * exists. Bring it down by driving the behaviour instead, as
     * regress-giveup.ts and regress-turn.ts now do; never bring it up.
     */
    const CEILING = 24;
    check(`no more than ${CEILING} regress scripts assert on source text (${readers.length} do)`,
      readers.length <= CEILING, readers.join(", "));
  }

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall passing\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
