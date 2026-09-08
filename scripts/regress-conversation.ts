/**
 * Regression: "i want to go to croatia or southern france. recs?"
 *
 * What happened: both places were dropped, two canned questions were asked
 * from a fixed bank ("How long can you disappear for?", "Roughly what do you
 * want to spend?"), and a third place was recommended. A slot filler wearing a
 * conversation's clothes.
 *
 * What has to be true now: every named place survives, budget and length are
 * not asked before there is somewhere to plan, and a shortlist is decided
 * between rather than reduced to whichever name was matched first.
 */
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import { rulesDriver } from "@/lib/agent/rules";
import { applyPatch } from "@/lib/brief";
import { detectNamedPlaces } from "@/lib/discovery";
import { recommend } from "@/lib/recommend";
import { destinationById } from "@/data/destinations";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

(async () => {
  console.log("\nCONVERSATION REGRESSION — a shortlist, and the order of questions\n");

  const input = "i want to go to croatia or souther france. recs?";
  const named = detectNamedPlaces(input);
  check("keeps both places she named", named.known.includes("france") && named.unknown.includes("croatia"),
        `known=[${named.known}] unknown=[${named.unknown}]`);

  const b = applyPatch(emptyBrief(), await rulesDriver.interpret(input, emptyBrief())) as Brief;
  check("records the shortlist on the brief",
        !!b.candidates?.length || !!b.unknownCandidates?.length,
        `candidates=${JSON.stringify(b.candidates)} unknown=${JSON.stringify(b.unknownCandidates)}`);

  // Discovery must not ask for money or length. Those come after a destination.
  const first = await rulesDriver.nextQuestion(b, [], "discovery");
  check("does not open with a budget or duration question",
        first === null || (first.id !== "budget" && first.id !== "duration"),
        `asked: ${first?.id ?? "nothing"} — "${first?.prompt.slice(0, 60) ?? ""}"`);

  // Logistics only once there is somewhere to plan.
  const withDest = { ...b, namedDestination: "france", unknownAcknowledged: true } as Brief;
  const later = await rulesDriver.nextQuestion(withDest, [], "logistics");
  check("asks length only in the logistics phase", later?.id === "duration", `got ${later?.id}`);

  // A shortlist of two is decided, with the runner-up named.
  const two = { ...emptyBrief(), candidates: ["france", "italy"], days: 8, vibes: ["food", "relaxation"] } as Brief;
  const rec = recommend(two, emptyProfile());
  check("picks one of the two she named", ["france", "italy"].includes(rec.destinationId),
        destinationById(rec.destinationId).name);
  check("does not hand the choice back", rec.confidence === "high");
  check("still knows what it turned down", !!rec.alternativeId,
        rec.alternativeId ? destinationById(rec.alternativeId).name : "none");
  check("never recommends a third place she didn't mention",
        rec.scores.every((s) => ["france", "italy"].includes(s.id)),
        rec.scores.map((s) => s.id).join(", "));

  // --- "i want to do a roadtrip in europe" -> the Utah canyon country -------
  // Two failures at once: "europe" was invisible to the parser, and the word
  // "roadtrip" was wired straight to Utah. The weakest signal in the sentence
  // beat the only firm constraint in it.
  console.log("");
  const euro = applyPatch(emptyBrief(), await rulesDriver.interpret("i want to do a roadtrip in europe", emptyBrief())) as Brief;
  check("reads Europe as a region", euro.region === "europe", `got ${euro.regionLabel ?? "nothing"}`);
  check("reads the road trip as a shape, not a place", euro.roadTrip === true && !euro.namedDestination,
        `named=${euro.namedDestination ?? "-"}`);
  const euroRec = recommend({ ...euro, days: 9, vibes: ["nature"] } as Brief, emptyProfile());
  check("recommends somewhere actually in Europe",
        (euro.regionIds ?? []).includes(euroRec.destinationId),
        `got ${destinationById(euroRec.destinationId).name}`);

  // A strong interest hint still names a place; a style hint never does.
  const lotr = applyPatch(emptyBrief(), await rulesDriver.interpret("i'm an lotr fan and want to visit nz", emptyBrief())) as Brief;
  check("a real fandom still names the destination", lotr.namedDestination === "newzealand", `got ${lotr.namedDestination}`);
  const parks = applyPatch(emptyBrief(), await rulesDriver.interpret("national parks, 6 days", emptyBrief())) as Brief;
  check("a style hint does not name a destination", !parks.namedDestination, `got ${parks.namedDestination}`);

  // "go to africa and see some animals" announced it didn't cover
  // "Africa And See" and then tried to research "see some animals".
  const africa = applyPatch(emptyBrief(),
    await rulesDriver.interpret("i want to go to africa and see some animals", emptyBrief())) as Brief;
  check("the place stops at the conjunction",
        africa.unknownDestination?.toLowerCase() === "africa", `got ${africa.unknownDestination}`);
  check("an activity is not treated as a destination",
        !(africa.unknownCandidates ?? []).some((c) => /see|animals/i.test(c)),
        JSON.stringify(africa.unknownCandidates));

  // A region we hold nothing inside is a research prompt, not a wrong answer.
  const balkans = applyPatch(emptyBrief(), await rulesDriver.interpret("road trip in the balkans", emptyBrief())) as Brief;
  check("a region we don't cover is flagged for research",
        balkans.region === "balkans" && (balkans.regionIds ?? []).length === 0);

  console.log(`\n  ${fails === 0 ? "\x1b[32mall clear\x1b[0m" : `\x1b[31m${fails} failing\x1b[0m`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
