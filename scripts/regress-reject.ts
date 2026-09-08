/**
 * Regression: saying no to a recommendation.
 *
 * The proposal card had exactly one button on it, "Show me the trip", and no
 * composer at that stage. An opinionated single recommendation was also an
 * unarguable one. Every reason below has to move the next answer, or this is a
 * survey rather than a feedback loop.
 */
import { emptyBrief, emptyProfile, type Brief, type TravelerProfile } from "@/lib/types";
import { recommend } from "@/lib/recommend";
import { destinationById } from "@/data/destinations";
import { applyRejection, REJECT_REASONS, type RejectReasonId } from "@/lib/reject";
import { roughCost } from "@/lib/recommend";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

const base: Brief = { ...emptyBrief(), days: 8, vibes: ["food", "culture"], budgetUsd: 4000 } as Brief;

function reject(reason: RejectReasonId, b = base, p = emptyProfile()) {
  const first = recommend(b, p);
  const dest = destinationById(first.destinationId);
  const est = roughCost(dest, b.days!, b.origin);
  const out = applyRejection(reason, dest, est, b, p);
  const second = recommend(out.brief, out.profile);
  return { dest, est, out, second: destinationById(second.destinationId), secondId: second.destinationId };
}

console.log("\nREJECTION REGRESSION — every reason has to change the answer\n");

for (const r of REJECT_REASONS) {
  const { dest, out, second, secondId } = reject(r.id);
  check(`"${r.label}" gives a different destination`,
        secondId !== dest.id,
        `${dest.name} → ${second.name}`);
  check(`"${r.label}" says what it changed`, out.said.length > 0 && out.said.length < 120, out.said);
}

// The specific consequences, not just "something moved".
const exp = reject("expensive");
check("too expensive lowers the budget below the quote",
      (exp.out.brief.budgetUsd ?? Infinity) < exp.est,
      `$${exp.out.brief.budgetUsd} vs quoted $${exp.est}`);

const far = reject("far");
check("too far sets the near flag and clears the far one",
      far.out.brief.wantsNear === true && !far.out.brief.wantsFar);

const been = reject("been");
check("been there is permanent", been.out.profile.visitedDestinationIds.includes(been.dest.id));
const beenAgain = recommend(been.out.brief, been.out.profile);
check("been there is never offered again, even at the top of the ranking",
      beenAgain.destinationId !== been.dest.id);

const kind = reject("notmykind");
const pushed = Object.entries(kind.out.profile.vibeLeanings).filter(([, w]) => (w ?? 0) < 0);
check("not my kind of place pushes its strongest vibes negative",
      pushed.length > 0 && pushed.length <= 2,
      pushed.map(([v, w]) => `${v} ${w}`).join(", "));

// Saying no repeatedly must keep producing new answers, not loop.
let b = base, p: TravelerProfile = emptyProfile();
const chain: string[] = [];
for (let i = 0; i < 5; i++) {
  const rec = recommend(b, p);
  const d = destinationById(rec.destinationId);
  chain.push(d.name);
  const out = applyRejection("other", d, roughCost(d, 8), b, p);
  b = out.brief; p = out.profile;
}
check("five rejections in a row give five different places",
      new Set(chain).size === 5, chain.join(" → "));

// A rejection must not empty the catalogue.
check("it still has an answer after all that", !!recommend(b, p).destinationId);

console.log(`\n  ${fails === 0 ? "\x1b[32mall clear\x1b[0m" : `\x1b[31m${fails} failing\x1b[0m`}\n`);
process.exit(fails === 0 ? 0 : 1);
