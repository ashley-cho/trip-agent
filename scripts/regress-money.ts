/**
 * Regression: the same trip, priced twice, has to come out the same.
 *
 * The Estimate card breaks the trip into Flights / Hotels / Transport /
 * Activities / Food. The Bookings list, on the same screen, invoices the
 * flight, each hotel and the trains. Nobody reconciles them, so for a long
 * time they didn't reconcile: `costBreakdown` applied a 22% discount to the
 * nightly rate whenever the trip had been trimmed to fit a budget, and
 * `mockBookings` charged the full catalogue rate for the same beds. Two
 * numbers for one bill, a few hundred dollars apart, on a trip nobody had
 * touched.
 *
 * The other half of this file is that an edit must not reach back into the
 * trip it was given. `applyOps` swapped items in place through a shallow
 * array copy, so "make it less touristy" rewrote the caller's own trip — the
 * one the UI diffs against to show what changed.
 */
import { emptyBrief, emptyProfile, type Brief, type Trip } from "@/lib/types";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { applyOps, parseEditRules, tidy } from "@/lib/edit";
import type { ItineraryDay } from "@/lib/types";
import { costBreakdown } from "@/lib/planner";
import { critique } from "@/lib/critic";
import type { EditOp } from "@/lib/agent/types";
import { withStays } from "@/lib/stays";
import { namesOtherLength, whyLine } from "@/lib/concept";
import { DESTINATIONS, cityById } from "@/data/destinations";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mTWO PANELS, ONE BILL\x1b[0m\n");

const unspokenBudget: string[] = [];

const hotelTotal = (t: Trip) =>
  t.bookings.filter((b) => b.kind === "hotel").reduce((s, b) => s + b.priceUsd, 0);

/** Every destination, planned twice: once on merit, once squeezed by a budget. */
const plan = (destId: string, budgetUsd?: number): { brief: Brief; trip: Trip } => {
  const brief = applyPatch(emptyBrief(), {
    namedDestination: destId, days: 8, month: "October",
    ...(budgetUsd !== undefined ? { budgetUsd } : {}),
  }) as Brief;
  return { brief, trip: planTrip(brief, recommend(brief), emptyProfile()) };
};

let free = 0, squeezed = 0, trimmedSeen = 0;
const off: string[] = [];
for (const d of DESTINATIONS) {
  for (const budget of [undefined, 1500] as const) {
    const { trip } = plan(d.id, budget);
    const card = trip.concept.breakdown.lodging;
    const bill = hotelTotal(trip);
    if (trip.concept.trimmedForBudget) trimmedSeen++;
    // A dollar of per-leg rounding is fine; a percentage is not.
    const ok = Math.abs(card - bill) <= trip.concept.shape.length;
    if (!ok) off.push(`${d.id}${budget ? " (budget)" : ""}: card $${card} vs bill $${bill}`);
    if (budget === undefined) free += ok ? 1 : 0; else squeezed += ok ? 1 : 0;
  }
}
check("the Hotels row equals the hotel bookings, on merit",
  free === DESTINATIONS.length, `${free}/${DESTINATIONS.length}` + (off.length ? `\n        ${off[0]}` : ""));
check("and still equals it once the trip is trimmed for budget",
  squeezed === DESTINATIONS.length, `${squeezed}/${DESTINATIONS.length}`
    + (off.length ? `\n        ${off[off.length - 1]}` : ""));
// If nothing ever trims, the line above is testing nothing.
check("some trip actually got trimmed, so the case above is real",
  trimmedSeen > 0, `${trimmedSeen} trimmed`);

// The discount has to be visible somewhere, or "trimmed for budget" is a lie.
{
  const loose = plan(DESTINATIONS[0].id).trip;
  const tight = plan(DESTINATIONS[0].id, 900).trip;
  if (tight.concept.trimmedForBudget) {
    check("a trimmed trip really does charge less for the same beds",
      hotelTotal(tight) < hotelTotal(loose),
      `$${hotelTotal(tight)} vs $${hotelTotal(loose)}`);
  }
}

// Named stays move both panels together.
{
  const { trip } = plan(DESTINATIONS[0].id);
  const leg = trip.concept.shape.find((l) => l.nights > 0)!;
  const stayed = withStays(trip, [{
    cityId: leg.cityId, name: "Casa Test", neighborhood: "Old town",
    nightlyUsd: cityById(leg.cityId).nightlyUsd + 90,
    why: "Test.", downside: "Test.", backups: [],
  }]);
  check("a named stay moves the card and the bookings by the same amount",
    Math.abs(stayed.concept.breakdown.lodging - hotelTotal(stayed)) <= stayed.concept.shape.length,
    `card $${stayed.concept.breakdown.lodging} vs bill $${hotelTotal(stayed)}`);
  check("and the estimate is the sum of its own rows",
    stayed.concept.estimateUsd
      === Math.round(Object.values(stayed.concept.breakdown).reduce((a, c) => a + c, 0)));
}

console.log("\n\x1b[1mAN EDIT DOES NOT REWRITE THE TRIP IT WAS GIVEN\x1b[0m\n");
{
  /*
   * Swept across every destination on purpose. The first version of this
   * checked one destination and passed even with the bug put back: the ops
   * that swap items in place only find something to swap where the catalogue
   * has both a touristy place and a local alternative, which is two
   * destinations out of fifteen. A test that never reaches the branch it
   * names is worse than no test.
   */
  const OPS: EditOp[] = [
    { kind: "less_touristy" }, { kind: "increase_pace" }, { kind: "add_downtime" },
  ];
  const leaked: string[] = [];
  let changedSomething = 0;
  for (const d of DESTINATIONS) {
    const { brief, trip } = plan(d.id);
    for (const op of OPS) {
      const before = JSON.stringify(trip);
      const after = applyOps(trip, [op], brief, emptyProfile());
      if (JSON.stringify(trip) !== before) leaked.push(`${d.id} / ${op.kind}`);
      if (JSON.stringify(after.trip.days) !== before) changedSomething++;
    }
  }
  check("no edit writes back into the trip it was handed",
    leaked.length === 0, leaked.slice(0, 3).join(", "));
  check("and the edits under test actually did something, somewhere",
    changedSomething > 0, `${changedSomething} of ${DESTINATIONS.length * OPS.length}`);
}

console.log("\n\x1b[1mTHE NIGHT LANDS WHERE SHE ASKED FOR IT\x1b[0m\n");
{
  /*
   * extend_stay used to replan at days + 1 and THEN move a night between legs
   * of the returned trip — after the itinerary had already been built from the
   * shape it was replacing. "An extra night in Provence" billed two Provence
   * nights, listed two in the bookings, and handed her a fifth day in Paris
   * with still exactly one day in Provence. Eleven destinations of fifteen.
   *
   * The check is on the itinerary, not the shape, because the shape is what
   * lied.
   */
  let wrongBed = 0, wrongDay = 0, tested = 0;
  for (const d of DESTINATIONS) {
    const { brief, trip } = plan(d.id);
    for (const leg of trip.concept.shape) {
      if (leg.nights < 1) continue;
      tested++;
      const nightsBefore = trip.concept.shape.filter((l) => l.cityId === leg.cityId)
        .reduce((s2, l) => s2 + l.nights, 0);
      const based = (t: Trip, city: string) => t.days.filter((day) =>
        day.cityId === city || t.concept.shape.some((l) =>
          l.cityId === city && (l.dayTrip === day.cityId || l.extraDayTrip === day.cityId))).length;
      const daysBefore = based(trip, leg.cityId);
      const out = applyOps(trip, [{ kind: "extend_stay", cityId: leg.cityId, nights: 1 }],
        brief, emptyProfile()).trip;
      const nightsAfter = out.concept.shape.filter((l) => l.cityId === leg.cityId)
        .reduce((s2, l) => s2 + l.nights, 0);
      if (nightsAfter !== nightsBefore + 1) wrongBed++;
      // She is charged for the extra night; the itinerary has to spend it there.
      if (based(out, leg.cityId) !== daysBefore + 1) {
        wrongDay++;
        if (wrongDay <= 2) {
          console.log(`        ${d.id} ${leg.cityId}: nights ${nightsBefore}→${nightsAfter}, `
            + `days there ${daysBefore}→${based(out, leg.cityId)}`);
        }
      }
    }
  }
  check("the extra night is billed in the city she named", wrongBed === 0, `${wrongBed} of ${tested}`);
  check("and the itinerary actually spends it there", wrongDay === 0, `${wrongDay} of ${tested}`);
}

console.log("\n\x1b[1mWHAT SHIPS IS WHAT WAS PRICED\x1b[0m\n");
{
  /*
   * The Estimate card and the Bookings list were computed before the critic
   * was allowed to delete anything, so an edit that dropped the Alhambra still
   * charged for it and still offered a booking card for it, with a price and a
   * cancellation policy, in a trip it was no longer part of.
   */
  let mispriced = 0, selling = 0, shipped = 0, unspoken = 0, cases = 0, missed = 0;
  const MSGS = ["less touristy please", "i don't care about museums", "keep it under $1500"];
  for (const d of DESTINATIONS) {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: d.id, days: 7, month: "October", budgetUsd: 1500,
    }) as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    for (const msg of MSGS) {
      cases++;
      const r = applyOps(trip, parseEditRules(msg, trip), brief, emptyProfile());
      const o = r.trip;
      const recut = costBreakdown(o.concept.destinationId, o.concept.shape, o.days,
        o.concept.trimmedForBudget, o.concept.origin);
      if (JSON.stringify(recut) !== JSON.stringify(o.concept.breakdown)) mispriced++;
      const inTrip = new Set(o.days.flatMap((day) => day.items.map((i) => i.name)));
      for (const bk of o.bookings) {
        if (bk.kind !== "hotel" && bk.kind !== "flight" && !inTrip.has(bk.label)) selling++;
      }
      // Its own critic must not call the thing it just shipped impossible.
      shipped += critique(o, r.brief, r.profile)
        .filter((x) => x.severity === "error" && x.code !== "over_budget").length;
      // Two free-time cards in a row is one empty afternoon shown as two.
      for (const day of o.days) {
        for (let i = 1; i < day.items.length; i++) {
          if (day.items[i - 1].type === "downtime" && day.items[i].type === "downtime") unspoken++;
        }
      }
      if (r.brief.budgetUsd !== undefined && o.concept.estimateUsd > r.brief.budgetUsd) {
        missed++;
        if (!r.summary.some((line) => line.includes(r.brief.budgetUsd!.toLocaleString()))) {
          if (!unspokenBudget.length) unspokenBudget.push(`${d.id}: ${r.summary.join(" | ")}`);
          unspokenBudget.push("x");
        }
      }
    }
  }
  check("the priced trip is the trip that ships", mispriced === 0, `${mispriced} of ${cases}`);
  check("and no booking is offered for something no longer in it", selling === 0, `${selling} stale`);
  check("nothing ships that its own critic calls impossible", shipped === 0, `${shipped} hard errors`);
  check("one empty afternoon is one card, not two", unspoken === 0, `${unspoken} stacked`);
  check("a budget she gave us and we missed is said out loud",
    unspokenBudget.length === 0, unspokenBudget[0] ?? "");
  check("and those cases are real, not zero", missed > 0, `${missed} over budget`);
}

{
  // The post-repair fold, exercised directly: the sweep above doesn't happen to
  // produce this shape, and an untested safety net is not a safety net.
  const day = {
    index: 1, date: "2026-10-12", cityId: "lis", theme: "",
    items: [
      { id: "a", type: "downtime", name: "Free time", start: "10:00", durationMin: 90, reason: "r1", costUsd: 0, tags: [] },
      { id: "c", type: "downtime", name: "Free time", start: "11:30", durationMin: 75, reason: "r2", costUsd: 0, tags: [] },
    ],
  } as unknown as ItineraryDay;
  tidy(day);
  check("a deletion that leaves two free blocks touching folds them into one",
    day.items.length === 1 && day.items[0].durationMin === 165 && day.items[0].id === "a",
    JSON.stringify(day.items.map((i) => `${i.start}+${i.durationMin}`)));
}

console.log("\n\x1b[1mTHE PITCH KEEPS UP WITH THE PLAN\x1b[0m\n");
{
  let stale = 0, rewritten = 0, kept = 0, tested = 0;
  for (const d of DESTINATIONS) {
    const { brief, trip } = plan(d.id);
    // The pitch as the app writes it, naming the length it was written for.
    const pitched: Trip = { ...trip, concept: { ...trip.concept, why: whyLine(trip, brief) } };
    const leg = pitched.concept.shape.find((l) => l.nights > 0);
    if (!leg) continue;
    tested++;
    const out = applyOps(pitched, [{ kind: "extend_stay", cityId: leg.cityId, nights: 1 }],
      brief, emptyProfile()).trip;
    if (out.concept.days === pitched.concept.days) continue;
    if (namesOtherLength(out.concept.why, out.concept.days)) stale++;
    else if (out.concept.why !== pitched.concept.why) rewritten++;
    else kept++;
  }
  check("no trip ends up pitched as a different length than it is",
    stale === 0, `${stale} stale of ${tested}`);
  check("and the ones that named a length got a new one, so this isn't vacuous",
    rewritten > 0, `${rewritten} rewritten, ${kept} left alone`);
  // The detector itself, since everything above leans on it.
  check("a pitch naming the right length is left alone",
    !namesOtherLength("Nine days in Portugal, two bases.", 9));
  check("a pitch naming the wrong one is caught",
    namesOtherLength("Nine days in Portugal, two bases.", 10));
  check("digits count too", namesOtherLength("over 9 days", 10));
  check("a day trip is not a trip length",
    !namesOtherLength("One day out of the city, to Sintra.", 9));
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
