import { rulesDriver as d } from "@/lib/agent/rules";
import { emptyBrief } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";

// Things a person actually types, not chip combinations.
const OPENERS = [
  "I need a vacation. Surprise me.",
  "i wanna be in the nature without breaking the bank. i'm thinking for 3-4 days",
  "somewhere warm for a week, nothing too expensive",
  "i want to eat well and walk a lot",
  "a week off in October, want to relax",
  "take me somewhere beautiful",
  "i'm burnt out and need to switch off for a week",
  "somewhere with good food and wine for 6 days",
  "i want an adventure, 10 days, money's no object",
  "just want to lie on a beach for 5 days",
  "somewhere with great museums and architecture, a week",
  "i'd like to hike and see mountains for a week",
  "a city break, 4 days, somewhere lively",
  "i want to go somewhere i've never been. two weeks.",
  "romantic trip for a week, mid-range budget",
];

const tally = new Map<string, number>();
(async () => {
  for (const o of OPENERS) {
    let b = emptyBrief(o);
    b = applyPatch(b, await d.interpret(o, b));
    // answer whatever it still needs with a neutral default, as a tester would
    let guard = 0;
    for (;;) {
      const q = await d.nextQuestion(b);
      if (!q || guard++ > 3) break;
      // Answer only what was asked, as a person would.
      const reply = q.id === "duration" ? "about a week"
        : q.id === "budget" ? "around $2,500"
        : "surprise me";
      b = applyPatch(b, await d.interpret(reply, b));
    }
    const rec = recommend(b);
    tally.set(rec.destinationId, (tally.get(rec.destinationId) ?? 0) + 1);
    console.log(`${rec.destinationId.padEnd(10)} ${String(b.days ?? "?").padStart(2)}d  [${b.vibes.join(",") || "none"}]`);
    console.log(`   "${o}"`);
  }
  console.log("\nTALLY:", [...tally].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join("  "));
})();
