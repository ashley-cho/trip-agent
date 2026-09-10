/**
 * "It must stay faithful to the user's input. That tops everything."
 * "Every single thing that the user types or selects must sustain in that
 *  session at least."
 *
 * Two ways the edit engine broke that rule, and the class behind each.
 *
 * ONE — CLAUSES DROPPED IN SILENCE. `parseEditRules` splits what she typed
 * into clauses and reports per clause, but the more/less scan joined every
 * clause of a polarity into one string and then marked EVERY clause of that
 * polarity heard the moment ANY tag came back out of the join. So "more wine
 * and more helicopters" made one op, marked both clauses, and the helicopters
 * left no trace anywhere — no op, no `unresolved` entry, no sentence. Nothing
 * on screen said so, because the half it did do was described accurately.
 * Thirty of ninety clauses in the corpus below went that way.
 *
 * The rule is not that every clause is obeyed. Plenty of clauses ask for
 * things this engine cannot do, and saying so is the right answer. The rule is
 * that SILENCE is never the answer.
 *
 * TWO — EDITS WERE DESTRUCTIVE AND THERE WAS NO UNDO. `more_tag` and
 * `remove_tag` wrote `avoidTags` and `rejectedPlaceIds` that outlived the
 * instruction that wrote them, so the opposite instruction was answered from a
 * world the first one had already narrowed. "I don't really care about
 * castles" then "actually i'd love more castles" answered "I can't fit more
 * castle into these cities" — the two castles it could have put back were on
 * the rejected list, put there by the sentence she had just withdrawn, and
 * `castle` sat on the avoid list and the favour list at the same time.
 *
 * Acted-on is decided here the way evals/metrics.ts decides it: by ABLATION,
 * not by reading the parser's own flags. Delete a clause, parse again, and see
 * whether anything the engine does changed. A bookkeeping fix cannot pass it.
 */
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { applyOps, parseEditRules } from "@/lib/edit";
import { emptyBrief, emptyProfile, type Brief, type Tag } from "@/lib/types";
import { DESTINATIONS } from "@/data/destinations";
import { clauseAccounting, tripSignature } from "@/evals/metrics";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

/** One day, the way a traveller would notice it changing. */
const sig = (d: { cityId: string; items: { name: string; start: string }[] }) =>
  `${d.cityId}:${d.items.map((i) => `${i.name}@${i.start}`).join("|")}`;

const briefFor = (id: string, days = 8): Brief =>
  applyPatch(emptyBrief(), { namedDestination: id, days, month: "October" }) as Brief;
const planFor = (id: string, days = 8) => {
  const b = briefFor(id, days);
  return { brief: b, trip: planTrip(b, recommend(b), emptyProfile()) };
};

/**
 * Real sentences, several clauses each. Wide rather than deep: one assertion
 * per message, about the only thing that matters here — did anything she typed
 * disappear without a word.
 */
const CORPUS = [
  "more wine and more helicopters",
  "i'd love more markets and a cooking class",
  "more hot springs and fewer temples",
  "fewer museums and more food",
  "less touristy, we need to fly out of boston",
  "more wine, can you book me a car",
  "fewer museums / put the beach day at the end",
  "more food and no temples",
  "make it cheaper and add a night in Tokyo",
  "no museums but more markets",
  "more nature and a hot air balloon ride",
  "less nightlife and more coffee",
  "add a free afternoon on day 2 and more art",
  "more beaches, and can you move the castle to day 4",
  "i don't really care about castles, more wine please",
  "drop the hiking - more spa",
  "this is too busy and I want more markets",
  "more music and less shopping and a day trip to the mountains",
  "fewer churches, more viewpoints, and a cooking class",
  "more coffee and a helicopter tour",
  "less walking please and more food",
  "i'd love more art and some live music and fewer markets",
  "add more wine and a wine tasting class",
  "more nature and please book the ferry",
  "cut the museums and add a spa day and more coffee",
  "more markets and skydiving",
  "more architecture, less nightlife, and swap day 2 with day 3",
  "we want more nature and a private guide",
  "more castles and fewer museums and a sunset cruise",
  "less coast and more history and can you find a babysitter",
  "no museums and no helicopters",
  "drop the hiking and cancel the rental car",
  "less wine and fewer segway tours",
  "no castles, no churches, and no early mornings",
  "i hate museums and i'm not into paragliding",
  "remove the food tour and remove the bike rental",
  "fewer markets and less karaoke",
  "skip the nightlife and skip the airport transfer",
  "more wine and more nightlife and more paragliding",
  "more spa and more surfing",
];

async function main() {
  console.log("\n\x1b[1mEVERY CLAUSE SUSTAINS, AND A CHANGE OF MIND GETS BACK\x1b[0m\n");

  // --- one: the two named instances ---------------------------------------
  {
    const { brief, trip } = planFor("portugal");
    const said = (m: string) => {
      const ops = parseEditRules(m, trip);
      return { ops, ...applyOps(trip, ops, brief, emptyProfile()) };
    };

    const wine = said("more wine and more helicopters");
    check("\"more wine and more helicopters\" still acts on the wine",
      wine.ops.some((o) => o.kind === "more_tag" && o.tag === "wine"),
      JSON.stringify(wine.ops));
    check("and names the helicopters rather than dropping them",
      wine.unresolved.some((u) => /helicopters/i.test(u)),
      JSON.stringify(wine.unresolved));

    const cook = said("i'd love more markets and a cooking class");
    check("\"i'd love more markets and a cooking class\" still acts on the markets",
      cook.ops.some((o) => o.kind === "more_tag"),
      JSON.stringify(cook.ops));
    check("and names the cooking class",
      cook.unresolved.some((u) => /cooking class/i.test(u)),
      JSON.stringify(cook.unresolved));
  }

  // --- one: the class, by ablation, over the whole corpus ------------------
  {
    const { brief, trip } = planFor("portugal");
    const parse = async (text: string) => parseEditRules(text, trip);
    let clauses = 0, dropped = 0;
    const worst: string[] = [];
    for (const said of CORPUS) {
      const r = applyOps(trip, parseEditRules(said, trip), brief, emptyProfile());
      const m = await clauseAccounting(said, parse, r.unresolved);
      const n = m.raw.match(/^(\d+)\/(\d+)/);
      if (n) { clauses += Number(n[2]); dropped += Number(n[2]) - Number(n[1]); }
      if (m.score < 0.999) worst.push(`"${said}" — ${m.raw}`);
    }
    check(`no clause in ${CORPUS.length} real messages disappears in silence`,
      dropped === 0, `${clauses - dropped}/${clauses} accounted for${worst.length ? `\n        ${worst.slice(0, 4).join("\n        ")}` : ""}`);
  }

  /*
   * The joined scan lost clauses outright, not just their accounting: `tagIn`
   * returns the FIRST tag word in whatever string it is handed, so in "more
   * wine and more nightlife" only wine was ever seen. Read per clause, both
   * are. This is the half of the fix that ACTS on what she typed rather than
   * apologising for it, and no honesty test can see it.
   */
  {
    const { trip } = planFor("portugal");
    const ops = parseEditRules("more wine and more nightlife", trip);
    check("a second clause naming a second tag is acted on, not just reported",
      ops.some((o) => o.kind === "more_tag" && o.tag === "wine")
      && ops.some((o) => o.kind === "more_tag" && o.tag === "nightlife"),
      JSON.stringify(ops));
  }

  // A message it understood completely still says nothing spare.
  {
    const { brief, trip } = planFor("portugal");
    for (const m of ["fewer museums and more food", "more wine", "less touristy please"]) {
      const r = applyOps(trip, parseEditRules(m, trip), brief, emptyProfile());
      check(`"${m}" reports nothing it did not need to`,
        r.unresolved.length === 0, JSON.stringify(r.unresolved));
    }
  }

  // --- two: the two named round trips --------------------------------------
  const roundTrip = (destId: string, days: number, a: string, b: string) => {
    const { brief, trip } = planFor(destId, days);
    const r1 = applyOps(trip, parseEditRules(a, trip), brief, emptyProfile());
    const r2 = applyOps(r1.trip, parseEditRules(b, r1.trip), r1.brief, r1.profile);
    return { trip, r1, r2, back: tripSignature(r2.trip) === tripSignature(trip) };
  };

  {
    const w = roundTrip("portugal", 8, "Add more wine.", "less wine");
    check("\"Add more wine.\" then \"less wine\" comes back to the trip she had",
      w.back, w.r2.summary.join(" | "));

    const c = roundTrip("portugal", 8,
      "I don't really care about castles.", "actually i'd love more castles");
    check("\"I don't really care about castles\" then \"actually i'd love more castles\" comes back",
      c.back, c.r2.summary.join(" | "));
    check("and the castles she asked back for are not still on the avoid list",
      !c.r2.brief.avoidTags.includes("castle") && !c.r2.profile.avoidTags.includes("castle"),
      `brief=${JSON.stringify(c.r2.brief.avoidTags)} profile=${JSON.stringify(c.r2.profile.avoidTags)}`);
    check("nor still rejected as places",
      c.r2.profile.rejectedPlaceIds.length === 0,
      JSON.stringify(c.r2.profile.rejectedPlaceIds));
    check("and the reversal replaces the earlier preference instead of stacking on it",
      !(c.r2.profile.avoidTags as Tag[]).includes("castle")
      && !(c.r2.profile.favorTags as Tag[]).includes("castle"),
      `avoid=${JSON.stringify(c.r2.profile.avoidTags)} favor=${JSON.stringify(c.r2.profile.favorTags)}`);
    /*
     * The same rule pointed the other way, and it is not visible in the
     * signature: after "less wine" the engine must not still be seeking wine
     * out. `favoredTags` feeds the candidate scoring and the critic, so a tag
     * left on both lists means the next replan is told to find and avoid the
     * same thing.
     */
    check("asking for less of something takes it off the favour list too",
      !(w.r2.profile.favorTags as Tag[]).includes("wine"),
      `favor=${JSON.stringify(w.r2.profile.favorTags)}`);
  }

  // --- two: the class, at every destination we hold -------------------------
  {
    let brokeLess = 0, brokeMore = 0, triedLess = 0, triedMore = 0;
    const example: string[] = [];
    for (const d of DESTINATIONS) {
      const { brief, trip } = planFor(d.id);
      for (const [tag, a, b] of [
        ["museum", "no museums", "actually i'd love more museums"],
        ["wine", "more wine", "less wine"],
      ] as const) {
        // Only meaningful where the first instruction has something to do.
        const r1 = applyOps(trip, parseEditRules(a, trip), brief, emptyProfile());
        if (tripSignature(r1.trip) === tripSignature(trip)) continue;
        const r2 = applyOps(r1.trip, parseEditRules(b, r1.trip), r1.brief, r1.profile);
        const ok = tripSignature(r2.trip) === tripSignature(trip);
        if (a.startsWith("no")) { triedLess++; if (!ok) brokeLess++; }
        else { triedMore++; if (!ok) brokeMore++; }
        if (!ok && example.length < 3) example.push(`${d.id} ${tag}: ${r2.summary.join(" | ")}`);
      }
    }
    check("taking back a refusal gets the plan back, everywhere",
      brokeLess === 0, `${brokeLess} of ${triedLess}${example.length ? `\n        ${example.join("\n        ")}` : ""}`);
    check("and taking back a request does too",
      brokeMore === 0, `${brokeMore} of ${triedMore}`);
  }

  /*
   * The memory it must NOT delete. A refusal that has not been taken back is
   * still a refusal, and an undo that fired on a plan which had moved on would
   * silently discard the edit that moved it — which is the same sin, pointed
   * the other way.
   */
  {
    const { brief, trip } = planFor("portugal");
    const r = applyOps(trip, parseEditRules("no castles", trip), brief, emptyProfile());
    check("a refusal that is never taken back still avoids the tag",
      r.brief.avoidTags.includes("castle") && r.profile.avoidTags.includes("castle"),
      JSON.stringify(r.profile.avoidTags));
    check("and still holds the places it ruled out",
      r.profile.rejectedPlaceIds.length > 0, JSON.stringify(r.profile.rejectedPlaceIds));
    check("and files them as this tag's, not as places she turned down herself",
      (r.profile.rejectedForTag?.castle ?? []).length === r.profile.rejectedPlaceIds.length,
      JSON.stringify(r.profile.rejectedForTag));

    /*
     * Say something else in between. The undo restores the days its own
     * instruction changed and nothing else: the castles come back, and the
     * pace cut made on other days in between survives. Putting a whole stale
     * trip back would discard what she typed in between, which is the same
     * sin pointed the other way.
     */
    const mid = applyOps(r.trip, parseEditRules("this is too busy", r.trip), r.brief, r.profile);
    const movedByPace = r.trip.days
      .filter((d, i) => sig(d) !== sig(mid.trip.days[i])).map((d) => d.index);
    const after = applyOps(mid.trip, parseEditRules("actually i'd love more castles", mid.trip),
      mid.brief, mid.profile);
    check("the castles come back after an unrelated edit in between",
      after.trip.days.some((d) => d.items.some((i) => /castle/i.test(i.name))),
      after.summary.join(" | "));
    check("and the edit made in between is not thrown away with them",
      movedByPace.length > 0 && movedByPace.every((idx) =>
        sig(mid.trip.days.find((d) => d.index === idx)!)
        === sig(after.trip.days.find((d) => d.index === idx)!)),
      `pace moved days ${movedByPace.join(", ")}`);

    /*
     * And now an edit that moved the SAME days. The undo must stand down: a
     * snapshot from before that edit is a copy of a plan she has since changed,
     * and putting it back would delete what she typed in between. She still
     * gets her castle — the normal more_tag path runs, with the avoid list
     * cleared and the collateral lifted — she just does not get it by having
     * the other edit thrown away.
     */
    const same = applyOps(r.trip, parseEditRules("more to do on day 3", r.trip), r.brief, r.profile);
    const added = same.trip.days.find((d) => d.index === 3)!.items
      .find((i) => !r.trip.days.find((d) => d.index === 3)!.items.some((j) => j.name === i.name));
    const then = applyOps(same.trip, parseEditRules("actually i'd love more castles", same.trip),
      same.brief, same.profile);
    check("an undo stands down rather than overwriting an edit to the same days",
      !!added && then.trip.days.some((d) => d.items.some((i) => i.name === added.name)),
      `${added?.name ?? "nothing was added on day 3"} — ${then.summary.join(" | ")}`);
    check("and she still gets the castle she asked back for",
      then.trip.days.some((d) => d.items.some((i) => /castle/i.test(i.name)))
      && !then.brief.avoidTags.includes("castle"),
      then.summary.join(" | "));

    // And a place turned down for another reason stays down through a reversal.
    const nz = planFor("newzealand");
    const touristy = applyOps(nz.trip, [{ kind: "less_touristy" }], nz.brief, emptyProfile());
    const kept = touristy.profile.rejectedPlaceIds;
    const back = applyOps(touristy.trip, parseEditRules("more viewpoints", touristy.trip),
      touristy.brief, touristy.profile);
    check("a place ruled out for another reason is not un-rejected by an unrelated ask",
      kept.length > 0 && kept.every((id) => back.profile.rejectedPlaceIds.includes(id)),
      `${JSON.stringify(kept)} → ${JSON.stringify(back.profile.rejectedPlaceIds)}`);
  }

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}

void main();
