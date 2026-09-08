/**
 * Can she get out of it?
 *
 * Two ways a conversation became unrecoverable, both found by auditing for
 * the same defect class as the Hokkaido bug rather than by anyone hitting
 * them.
 *
 * 1. The subject guard reads `subjects(brief)`, which reads
 *    `unknownCandidates`, and applyPatch merges with `??` so a patch can
 *    never CLEAR a list. So "Hokkaido didn't work, name somewhere else" ->
 *    "ok, Portugal then" left hokkaido on the list forever, and the guard
 *    refused every subsequent message with an offer to switch that it was
 *    itself refusing to honour.
 *
 * 2. Rejecting a pitch clears `namedDestination` but not the pin, and the
 *    pin is read when `namedDestination` is empty. So the rejected
 *    destination came straight back, and because the pitch is only spoken
 *    when the destination CHANGES, it came back in silence.
 */
import { applyPatch } from "@/lib/brief";
import { subjects } from "@/lib/subject";
import { applyRejection } from "@/lib/reject";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { pinnedDestination } from "@/lib/subject";
import { destinationById } from "@/data/destinations";
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mCAN SHE GET OUT OF IT\x1b[0m\n");

// --- 1. naming somewhere else after a failed lookup -----------------------
{
  const failed: Brief = {
    ...emptyBrief(), days: 10,
    unknownCandidates: ["hokkaido"],
    researchTried: ["hokkaido"],
  };
  check("after a failed lookup the subject is still on the table",
    subjects(failed).includes("hokkaido"));

  const moved = applyPatch(failed, { namedDestination: "portugal" });
  check("naming somewhere else clears the failed subject",
    subjects(moved).length === 0,
    `subjects=${JSON.stringify(subjects(moved))}`);
  check("and the new destination is the one she named",
    moved.namedDestination === "portugal", String(moved.namedDestination));
  check("and the old shortlist goes with it",
    !moved.unknownCandidates?.length && !moved.candidates?.length,
    `unknown=${JSON.stringify(moved.unknownCandidates)} candidates=${JSON.stringify(moved.candidates)}`);
}

// --- 2. a stale shortlist must not beat the place she just picked ---------
{
  const shortlisted: Brief = { ...emptyBrief(), days: 7, candidates: ["italy", "france"] };
  const picked = applyPatch(shortlisted, { namedDestination: "italy" });
  const rec = recommend(picked, emptyProfile());
  check("picking one of her own two options gives her that one",
    rec.destinationId === "italy", rec.destinationId);
}

// --- 3. rejecting a pitch must not return the same pitch ------------------
{
  const pitched = "portugal";
  const b: Brief = { ...emptyBrief(), days: 7, namedDestination: "portugal" };
  for (const reason of ["expensive", "far", "been", "notmykind", "other"] as const) {
    const out = applyRejection(reason, destinationById(pitched), 2900, b, emptyProfile());
    const pin = pinnedDestination(pitched, out.brief, out.profile);
    const rec = recommend(
      pin ? { ...out.brief, namedDestination: pin, candidates: undefined, regionIds: undefined } : out.brief,
      out.profile,
    );
    check(`"${reason}" does not hand back the place she just turned down`,
      rec.destinationId !== pitched, `${rec.destinationId} (pin=${pin})`);
  }
}

// --- 4. a town we hold no beds in is still where she said she's going ------
{
  /*
   * "i want to go to sintra for 4 days" resolved Sintra, found no hotel data
   * for it, fell through to the generic country shape and based her in
   * Lisbon. Silently, and at four days without even a day trip out. The
   * catalogue not holding a bed there is a fact about the catalogue.
   */
  for (const [city, dest, base] of [
    ["sintra", "portugal", "lisbon"],
    ["teotihuacan", "mexico", "cdmx"],
    ["hierve", "mexico", "oaxaca"],
    ["chianti", "italy", "florence"],
    ["milford", "newzealand", "teanau"],
  ] as const) {
    const b: Brief = { ...emptyBrief(), days: 4, namedDestination: dest, focusCityId: city };
    const shape = planTrip(b, recommend(b, emptyProfile()), emptyProfile()).concept.shape;
    check(`${city} is on the itinerary, based from ${base}`,
      shape.length === 1 && shape[0].cityId === base && shape[0].dayTrip === city,
      shape.map((l) => `${l.cityId}${l.dayTrip ? ` +${l.dayTrip}` : ""}`).join(" | "));
  }
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
