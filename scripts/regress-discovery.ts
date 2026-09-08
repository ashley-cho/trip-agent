/**
 * Regression: the conversation she actually asked for.
 *
 *   "when i say 'i want to go to croatia or southern france' then it should
 *    ask 'those are great places to visit around x months. what intrigued you
 *    to pick those places?' ... on and on until the agent has a good idea what
 *    would fit and suggest an option, and then get feedback"
 *
 * What the code did instead: naming a place set `candidates`, the slot check
 * was satisfied, and discovery returned null having asked nothing. The ceiling
 * was one question ever, and zero if you named somewhere.
 */
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { applyPatch } from "@/lib/brief";
import { discoveryGate, nextQuestionRules } from "@/lib/discovery";
import { emptyBrief, type Brief } from "@/lib/types";
import type { Turn } from "@/lib/agent/types";
import { DESTINATIONS } from "@/data/destinations";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

/** A model that answers each turn of her script, and records what it was told. */
function scripted(turns: Record<string, unknown>[]) {
  const seen: string[] = [];
  let i = 0;
  const t: Transport = {
    async call(args) {
      if (args.tool.name !== "ask") return null;
      seen.push(args.user);
      return turns[Math.min(i++, turns.length - 1)];
    },
  };
  return { transport: t, seen };
}

(async () => {
  console.log("\nDISCOVERY — the conversation, not the form\n");

  // 1. She names two places and nothing else. This is where it used to stop.
  const b1 = applyPatch(emptyBrief(), {
    candidates: ["france"], unknownCandidates: ["Croatia"], regionLabel: "Croatia or southern France",
  }) as Brief;
  check("naming places does not end discovery", discoveryGate(b1, 0) === "must",
        `gate=${discoveryGate(b1, 0)}`);

  const s1 = scripted([{ prompt: "Both are lovely in October. What made you pick those two?" }]);
  const d1 = createLlmDriver(s1.transport);
  const hist: Turn[] = [{ from: "user", text: "i want to go to croatia or southern france. recs?" }];
  const q1 = await d1.nextQuestion(b1, hist, "discovery");
  check("it asks something", !!q1, `got ${q1 === null ? "null" : q1.id}`);
  check("and the model was told what she named",
        /Croatia/.test(s1.seen[0] ?? "") && /france/i.test(s1.seen[0] ?? ""));
  check("and told to react to them before asking", /React to these/.test(s1.seen[0] ?? ""));
  check("the answer goes back through interpret, not a slot", q1?.freeform === true);

  // 2. She answers loosely. Now it knows why, so the model may keep going.
  // Croatia still has to be looked up, and she has now said how long, which is
  // what that lookup needs. Without a length the gate holds at "must", because
  // researching four days in Croatia is a different job from researching two
  // weeks — that is not the model's call to skip.
  const b2 = applyPatch(b1, {
    vibes: ["relaxation", "food"], interestEcho: "heard they're beautiful and relaxed", days: 10,
  }) as Brief;
  /*
   * This asserted "may" until the turn count became the thing that mattered.
   * Once she has said where and why, one question is the whole allowance:
   * four turns into a Turkey conversation the app was still asking, and the
   * value proposition is "no more planning, just leave". Quality above the
   * floor is now the model's to spend inside a much smaller budget.
   */
  check("where and why between them close discovery after one question",
        discoveryGate(b2, 1) === "stop");
  const s2 = scripted([{ prompt: "Beachy days, or more history and towns?", options: ["Beaches", "History", "A mixture of both"] }]);
  const q2 = await createLlmDriver(s2.transport).nextQuestion(b2, hist, "discovery");
  check("it can ask a follow-up", !!q2 && q2.options?.length === 3, `${q2?.options?.length ?? 0} options`);
  check("the options are things a person would say",
        q2?.options?.some((o) => o.label === "A mixture of both") === true);

  // 3. The model decides it has enough. That is allowed once the floor is met.
  const s3 = scripted([{ done: true }]);
  const q3 = await createLlmDriver(s3.transport).nextQuestion(b2, hist, "discovery");
  check("the model may stop once it understands", q3 === null);

  // 4. But it may not stop while we only know where, not why.
  const s4 = scripted([{ done: true }, { prompt: "What draws you to those?" }]);
  const q4 = await createLlmDriver(s4.transport).nextQuestion(b1, hist, "discovery");
  check("it may not stop knowing only where", q4 !== null);
  check("and it was told so", /must ask/i.test(s4.seen[0] ?? ""));

  // 5. It is an agent, not an interviewer.
  check("four questions is the ceiling", discoveryGate(b2, 4) === "stop");
  const q5 = await createLlmDriver(scripted([{ prompt: "One more thing?" }]).transport)
    .nextQuestion(b2, hist.concat(Array(4).fill({ from: "agent", text: "?" })), "discovery");
  check("and the ceiling is not the model's to raise", q5 === null);

  // 6. "i want to go to africa and see some animals"
  //    Desired: "Great idea. How long have you got? I can take it from there."
  //    What it did: announced it doesn't cover Africa and printed a fifteen
  //    item menu of countries she hadn't asked about.
  const afr = applyPatch(emptyBrief(), { unknownCandidates: ["africa"], unknownDestination: "africa" }) as Brief;
  check("somewhere to look up, with no length, is a question worth asking",
        discoveryGate(afr, 0) === "must", `gate=${discoveryGate(afr, 0)}`);

  const s6 = scripted([{ prompt: "Great idea. How long have you got? I can take it from there." }]);
  const q6 = await createLlmDriver(s6.transport).nextQuestion(
    afr, [{ from: "user", text: "i want to go to africa and see some animals" }], "discovery");
  check("it asks rather than announcing a gap", !!q6);
  check("the model is told to say the idea is good and ask how long",
        /ask how long/i.test(s6.seen[0] ?? ""));
  check("and it is never told to mention the catalogue",
        !/catalogue|don'?t cover/i.test((s6.seen[0] ?? "").replace(/places_to_look_up/g, "")));

  // The menu is gone from the rules layer entirely, in both phases. The test
  // is not "few options" — the vibe chips are options — it is that no question
  // ever offers the catalogue as a list of places to pick from.
  const names = new Set(DESTINATIONS.map((d) => d.name));
  for (const phase of ["discovery", "logistics"] as const) {
    const r = nextQuestionRules(afr, phase);
    const listsPlaces = (r?.options ?? []).some((o) => names.has(o.label));
    check(`no catalogue menu in ${phase}`, !listsPlaces, `${r?.id ?? "none"}`);
  }

  // 7. Discovery closes once a destination has been pitched.
  //    Live, it recommended Thailand and then asked about diving, then about
  //    early starts, because every answer re-entered the loop at the top and
  //    the gate still said "may". The itinerary never arrived.
  const afterPitch = applyPatch(emptyBrief(), {
    namedDestination: "portugal", vibes: ["food", "culture"], days: 9, budgetUsd: 2500,
  }) as Brief;
  check("logistics has nothing left to ask once length and budget are known",
        nextQuestionRules(afterPitch, "logistics") === null);
  check("and the gate is finished too, now that it reads the brief",
        discoveryGate(afterPitch, 2) === "stop",
        "the caller still closes discovery at the pitch; the gate no longer needs it to");

  console.log(`\n  ${fails === 0 ? "\x1b[32mall clear\x1b[0m" : `\x1b[31m${fails} failing\x1b[0m`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
