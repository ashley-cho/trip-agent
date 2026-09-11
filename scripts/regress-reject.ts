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

/*
 * This assertion used to require the opposite, and it was the bug.
 *
 * It demanded that ONE press of "Not my kind of place" move her profile. In
 * the deployment that meant: she asked for quiet, peaceful, not Southeast
 * Asia, nothing hot or humid; she was sent to Bali; she pressed the button;
 * and her own agent answered "Right - less food and culture, then." She had
 * said nothing about food or culture. They are simply the two things Bali
 * scores four on that she had not explicitly asked for, and a single click
 * was written into her profile as a fact about her and read back to her as
 * though she had said it.
 *
 * One press records the rejection and nothing else. A strength becomes a
 * leaning when a second rejected destination shares it, which is a pattern
 * rather than a data point.
 */
const kind = reject("notmykind");
check("one press records the rejection",
      (kind.out.profile.rejectedDestinationIds ?? []).includes(kind.dest.id));
check("and does not invent a taste from a single click",
      Object.entries(kind.out.profile.vibeLeanings).filter(([, w]) => (w ?? 0) < 0).length === 0,
      JSON.stringify(kind.out.profile.vibeLeanings));
check("and does not tell her what she thinks",
      !/less /i.test(kind.out.said), kind.out.said);

{
  // A second rejection sharing a strength she never asked for is a pattern.
  const first = reject("notmykind");
  const again = applyRejection("notmykind", first.second, 2500,
    first.out.brief, first.out.profile);
  const pushed = Object.entries(again.profile.vibeLeanings).filter(([, w]) => (w ?? 0) < 0);
  check("two rejections sharing a strength do move the profile",
        pushed.length > 0 && pushed.length <= 2,
        `${again.said} · ${pushed.map(([v, w]) => `${v} ${w}`).join(", ") || "nothing moved"}`);
}

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
