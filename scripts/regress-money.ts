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
import { readFileSync } from "node:fs";
import { namesOtherLength, whyLine } from "@/lib/concept";
import { DESTINATIONS, cityById } from "@/data/destinations";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mTWO PANELS, ONE BILL\x1b[0m\n");

/** The same trip with a named property on every leg she sleeps on. */
const named = (t: Trip) => withStays(t, [...new Set(t.concept.shape.filter((l) => l.nights > 0)
  .map((l) => l.cityId))].map((cityId) => ({
    cityId, name: `Casa ${cityById(cityId).name}`, neighborhood: "Old town",
    nightlyUsd: cityById(cityId).nightlyUsd + 150,
    why: "Test.", downside: "Test.", backups: [],
  })));

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

console.log("\n\x1b[1mNAMED ROOMS, MULTI-OP TURNS, AND A BUDGET SHE ACTUALLY GAVE\x1b[0m\n");
{
  let dropped = 0, cheaperAfterAdd = 0, warnWrong = 0, spokeWrong = 0, cases = 0;
  for (const d of DESTINATIONS) {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: d.id, days: 8, month: "October", budgetUsd: 2000,
    }) as Brief;
    const trip = named(planTrip(brief, recommend(brief), emptyProfile()));
    const leg = trip.concept.shape.find((l) => l.nights > 0)!;
    const OPS: EditOp[] = [
      { kind: "extend_stay", cityId: leg.cityId, nights: 1 },
      { kind: "cheaper" }, { kind: "set_budget", usd: 2000 },
    ];
    for (const op of OPS) {
      cases++;
      const was = trip.concept.estimateUsd;
      const r = applyOps(trip, [op], brief, emptyProfile());
      /*
       * Every replanning op used to splice back headline/vibe/why and drop
       * concept.stays on the floor. The Sleep panel vanished, the Hotels row
       * reverted to placeholders, and "Added a night in Lisbon" was followed
       * by "That's −$622 on the total" — adding a night made it cheaper,
       * because her hotel had silently been swapped for a cheaper one. 15/15.
       */
      if (!r.trip.concept.stays?.length) dropped++;
      if (op.kind === "extend_stay" && r.trip.concept.estimateUsd < was) cheaperAfterAdd++;
      /*
       * The budget was measured before withStays rewrote lodging, so the
       * Estimate card and the orange warning under it disagreed — on one trip
       * the card read $1,879 against a $2,000 budget and the warning said it
       * was $78 over. It was $121 under. 22 of 30.
       */
      const shown = r.trip.concept.estimateUsd;
      if (r.trip.concept.budgetShortfallUsd !== Math.max(0, shown - 2000)) warnWrong++;
      const said = r.summary.find((x) => /still \$/.test(x));
      if (said && !said.includes((shown - 2000).toLocaleString())) spokeWrong++;
    }
  }
  check("a replan keeps the rooms she was given", dropped === 0, `${dropped} of ${cases}`);
  check("so adding a night never makes the trip cheaper", cheaperAfterAdd === 0, `${cheaperAfterAdd}`);
  check("the over-budget figure matches the estimate beside it", warnWrong === 0, `${warnWrong} of ${cases}`);
  check("and the sentence quotes the same number", spokeWrong === 0, `${spokeWrong} of ${cases}`);

  /*
   * A replanning op replaces the whole trip, so anything an earlier op in the
   * same turn did to the days was thrown away while its sentence stayed in the
   * summary: "Cut Ribeira das Naus." next to a trip with Ribeira das Naus in
   * it. 15 of 15 destinations, 19 of 75 multi-op turns.
   */
  let lied = 0, turns = 0;
  for (const d of DESTINATIONS) {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: d.id, days: 8, month: "October", budgetUsd: 2500,
    }) as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    for (const msg of ["too much going on. also keep it under $2000",
      "more free time please, and keep it under $2500"]) {
      const ops = parseEditRules(msg, trip);
      if (ops.length < 2) continue;
      turns++;
      const r = applyOps(trip, ops, brief, emptyProfile());
      for (const line of r.summary) {
        const m = line.match(/(?:Cut|Cleared) (.+?)(?: off day (\d+)|\.$)/);
        if (!m) continue;
        const day = m[2] ? r.trip.days.find((x) => x.index === Number(m[2])) : undefined;
        const stillThere = day
          ? day.items.some((i) => m[1].includes(i.name))
          : r.summary.some(() => false);
        if (stillThere) { lied++; if (lied <= 2) console.log(`        ${d.id}: ${line}`); }
      }
    }
  }
  /*
   * Ordering replans first is not enough on its own: `cheaper` and
   * `set_budget` re-ran buildShape from scratch, which redistributes the
   * nights — so "an extra night in Lisbon, and keep it under $2,000" moved the
   * night back to wherever the shape builder wanted it while the summary still
   * said it had gone to Lisbon. Five of fifteen.
   */
  let moved = 0, pairs = 0;
  for (const d of DESTINATIONS) {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: d.id, days: 8, month: "October",
    }) as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    const leg = trip.concept.shape.find((l) => l.nights > 0);
    if (!leg) continue;
    pairs++;
    const nights = (t: Trip) => t.concept.shape.filter((l) => l.cityId === leg.cityId)
      .reduce((s2, l) => s2 + l.nights, 0);
    const out = applyOps(trip, [
      { kind: "extend_stay", cityId: leg.cityId, nights: 1 },
      { kind: "set_budget", usd: 2000 },
    ], brief, emptyProfile()).trip;
    if (nights(out) !== nights(trip) + 1) {
      moved++;
      if (moved <= 2) console.log(`        ${d.id}: ${nights(trip)} → ${nights(out)} in ${leg.cityId}`);
    }
  }
  check("a later replan doesn't move the night an earlier op just added",
    moved === 0, `${moved} of ${pairs}`);

  /*
   * The price a replan quotes is only knowable once the rooms are back on.
   * `t.concept.estimateUsd` mid-turn is the replan's catalogue lodging while
   * `before` included her named rooms, so on every trip with named rooms the
   * sentence had the wrong number and the wrong sign: "Added a night in
   * Lisbon. That's −$1,327 on the total", beside a card that went up $433.
   */
  let wrongPrice = 0, priced = 0;
  for (const d of DESTINATIONS) {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: d.id, days: 8, month: "October",
    }) as Brief;
    const trip = named(planTrip(brief, recommend(brief), emptyProfile()));
    const leg = trip.concept.shape.find((l) => l.nights > 0);
    if (!leg) continue;
    priced++;
    const was = trip.concept.estimateUsd;
    const r = applyOps(trip, [{ kind: "extend_stay", cityId: leg.cityId, nights: 1 }],
      brief, emptyProfile());
    const actual = r.trip.concept.estimateUsd - was;
    const line = r.summary.find((x) => /on the total/.test(x)) ?? "";
    const m = line.match(/([+\u2212])\$([\d,]+)/);
    const spoken = m ? (m[1] === "\u2212" ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN;
    if (spoken !== actual) {
      wrongPrice++;
      if (wrongPrice <= 2) console.log(`        ${d.id}: card ${actual >= 0 ? "+" : ""}${actual}, said ${spoken}`);
    }
  }
  check("the price a replan quotes is the price the card moved by",
    wrongPrice === 0, `${wrongPrice} of ${priced}`);

  /*
   * `brief` is the pre-edit brief, so on the very turn she types the number it
   * differed from `b.budgetUsd` and the guard called her own "$1,500" an
   * invention — on the one turn where naming it back to her mattered most.
   */
  {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: DESTINATIONS[0].id, days: 9, month: "October",
    }) as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    const r = applyOps(trip, [{ kind: "set_budget", usd: 900 }], brief, emptyProfile());
    check("a number she gives this turn is quoted back as hers",
      r.trip.concept.budgetShortfallUsd === 0 || r.summary.some((x) => /you gave me/.test(x)),
      r.summary.join(" | "));
    check("and the panel is told whose number it is",
      r.trip.concept.budgetStated === true);
    const r2 = applyOps(trip, parseEditRules("make it cheaper", trip), brief, emptyProfile());
    check("while a target we invented is marked as ours",
      r2.trip.concept.budgetStated === false, String(r2.trip.concept.budgetStated));
  }

  check("nothing in the summary describes an edit that was then thrown away",
    lied === 0, `${lied} of ${turns} multi-op turns`);
  check("and there were multi-op turns to test", turns > 0, `${turns}`);

  /*
   * "This is too much sightseeing" is not a complaint about money. It parsed
   * as `cheaper`, which invents a budget at 72% of the quote and writes it to
   * the brief — so every turn after it said "still $507 over the $1,800 you
   * gave me", quoting at her a number she had never said.
   */
  {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: DESTINATIONS[0].id, days: 8, month: "October",
    }) as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    const ops = parseEditRules("This is too much sightseeing.", trip);
    check("'too much sightseeing' is about the pace, not the price",
      !ops.some((o) => o.kind === "cheaper" || o.kind === "set_budget"), JSON.stringify(ops));
    check("but 'this costs too much' still is",
      parseEditRules("this costs too much", trip).some((o) => o.kind === "cheaper"));
    const r = applyOps(trip, parseEditRules("make it cheaper", trip), brief, emptyProfile());
    check("and a budget we inferred is never quoted back as hers",
      !r.summary.some((x) => /you gave me/.test(x)), r.summary.join(" | "));
  }
}

console.log("\n\x1b[1mTWO INSTRUCTIONS IN ONE MESSAGE\x1b[0m\n");
{
  /*
   * `priced` defers each replan's number to the end of the turn, but each op
   * captured its own `before` mid-turn — so in a two-replan turn the second
   * quoted a total that existed for microseconds and was never on any screen:
   * "an extra night in lisbon, and keep it under $2500" answered "Re-cut to
   * $2,677 from $3,053" against a card that read $2,839, and said adding a
   * night made the trip $162 cheaper. Ten to twenty-one of thirty, by order.
   */
  let ghost = 0, turns = 0;
  for (const d of DESTINATIONS) {
    for (const withRooms of [false, true]) {
      const brief = applyPatch(emptyBrief(), {
        namedDestination: d.id, days: 8, month: "October",
      }) as Brief;
      let trip = planTrip(brief, recommend(brief), emptyProfile());
      if (withRooms) trip = named(trip);
      const leg = trip.concept.shape.find((l) => l.nights > 0);
      if (!leg) continue;
      const was = trip.concept.estimateUsd;
      for (const ops of [
        [{ kind: "extend_stay", cityId: leg.cityId, nights: 1 }, { kind: "set_budget", usd: 2500 }],
        [{ kind: "set_budget", usd: 2500 }, { kind: "extend_stay", cityId: leg.cityId, nights: 1 }],
      ] as EditOp[][]) {
        turns++;
        const r = applyOps(trip, ops, brief, emptyProfile());
        const now = r.trip.concept.estimateUsd;
        // Every dollar figure the turn speaks has to be a number she can see:
        // the total before, or the total now.
        for (const line of r.summary) {
          for (const m of line.matchAll(/\$([\d,]+)/g)) {
            const n = Number(m[1].replace(/,/g, ""));
            // The total before, the total now, the budget she gave, the change,
            // or the overage — every one of those she can see or derive.
            if (n === was || n === now || n === 2500 || n === Math.abs(now - was)
              || n === Math.max(0, now - 2500)) continue;
            ghost++;
            if (ghost <= 3) console.log(`        ${d.id}: "${line}" (card was $${was}, is $${now})`);
          }
        }
      }
    }
  }
  check("no sentence quotes a total that was never on the screen",
    ghost === 0, `${ghost} across ${turns} two-op turns`);
  check("and there were such turns", turns > 0, `${turns}`);

  /*
   * "This is too busy, and keep it under $3,000" answered the budget half and
   * left the pace half in silence: the fallback tested the turn-wide summary,
   * and the replan ops run first and push into it. Fifteen of fifteen.
   */
  let mute = 0, both = 0;
  for (const d of DESTINATIONS) {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: d.id, days: 8, month: "October",
    }) as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    const alone = applyOps(trip, [{ kind: "reduce_pace" }], brief, emptyProfile());
    if (!alone.summary.length) continue;
    both++;
    const together = applyOps(trip, [{ kind: "reduce_pace" }, { kind: "set_budget", usd: 3000 }],
      brief, emptyProfile());
    // Whatever it said about the pace on its own, it still says here.
    const paceLine = (out: string[]) => out.some((x) => /light as it gets|things scheduled|Cut /.test(x));
    if (paceLine(alone.summary) && !paceLine(together.summary)) {
      mute++;
      if (mute <= 2) console.log(`        ${d.id}: alone ${JSON.stringify(alone.summary)} / together ${JSON.stringify(together.summary)}`);
    }
  }
  check("a second instruction doesn't silence the answer to the first",
    mute === 0, `${mute} of ${both}`);
  check("and there were turns where it answers at all", both > 0, `${both}`);

  /*
   * One sentence can ask for less of one thing and more of another. The tag
   * scan ran over the whole message and threw the positive half away, so
   * "fewer museums and more food" deleted every restaurant on the trip and
   * printed "they are exactly what you just said you didn't want" beside a
   * sentence asking for more food — and filed `food` in avoidTags for the rest
   * of the session. Fifteen of fifteen.
   */
  let inverted = 0;
  for (const d of DESTINATIONS) {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: d.id, days: 8, month: "October",
    }) as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    for (const [msg, wanted] of [
      ["fewer museums and more food", "food"],
      ["cut the castles, more wine", "wine"],
      ["drop the hiking, i'd love more coffee", "coffee"],
    ] as const) {
      const ops = parseEditRules(msg, trip);
      const r = applyOps(trip, ops, brief, emptyProfile());
      if (ops.some((o) => o.kind === "remove_tag" && o.tag === wanted)
        || r.brief.avoidTags.includes(wanted as never)) {
        inverted++;
        if (inverted <= 2) console.log(`        ${d.id} "${msg}" → ${JSON.stringify(ops)}`);
      }
    }
  }
  check("what she asks for in one half of a sentence is not deleted by the other",
    inverted === 0, `${inverted} of ${DESTINATIONS.length * 3}`);

  /*
   * `hik` and `walk` shared one tag entry, so "drop the hiking" also removed
   * every city walk on the trip and "more walking" pulled in mountain hikes.
   * They are different days.
   */
  {
    const trip = planTrip(
      applyPatch(emptyBrief(), { namedDestination: DESTINATIONS[0].id, days: 8, month: "October" }) as Brief,
      recommend(applyPatch(emptyBrief(), { namedDestination: DESTINATIONS[0].id }) as Brief),
      emptyProfile());
    const ops = parseEditRules("drop the hiking", trip);
    check("dropping the hiking does not also drop the walks",
      !ops.some((o) => o.kind === "remove_tag" && o.tag === "walk"), JSON.stringify(ops));
    check("and it does drop the hiking",
      ops.some((o) => o.kind === "remove_tag" && o.tag === "hike"), JSON.stringify(ops));
  }
}

console.log("\n\x1b[1mWHEN THE ROOMS ARRIVE, THE WHOLE CARD MOVES\x1b[0m\n");
{
  /*
   * The rooms land a moment after the proposal is on screen, and they change
   * the total. `applyOps` recomputes the budget miss and the trimmed-rooms
   * flag after withStays; the flow.ts copy did not — so named rooms at 1.6x
   * the guide left the Estimate card at $3,579 with a paragraph beside it
   * saying "about $101 over what you said" when the truth was $1,208, and
   * where the budget matched the first quote exactly the warning vanished.
   * Fifteen of fifteen, and "simpler rooms" was still printed while the named
   * property was being charged at full rate.
   *
   * This exercises the recompute the way flow.ts does it: withStays, then the
   * two fields. It is a source check as well, because the two copies of this
   * logic drifting apart is the actual bug.
   */
  const flow = readFileSync("lib/flow.ts", "utf8");
  check("flow.ts recomputes the budget miss after the rooms land",
    /budgetShortfallUsd: b\.budgetUsd === undefined/.test(flow));
  check("and stops claiming simpler rooms once they are named",
    /trimmedForBudget: next\.concept\.trimmedForBudget && !allNamed/.test(flow));

  let stale = 0, lying = 0, cases = 0;
  for (const d of DESTINATIONS) {
    const b0 = applyPatch(emptyBrief(), { namedDestination: d.id, days: 8, month: "October" }) as Brief;
    const quote = planTrip(b0, recommend(b0), emptyProfile()).concept.estimateUsd;
    const budgetUsd = Math.round(quote * 0.85);
    const brief = { ...b0, budgetUsd } as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    cases++;
    // What flow.ts does when the rooms come back.
    const withRooms = named(trip);
    const beds = withRooms.concept.shape.filter((l) => l.nights > 0);
    const allNamed = beds.every((l) => withRooms.concept.stays?.some((sy) => sy.cityId === l.cityId));
    const fixed = {
      ...withRooms,
      concept: {
        ...withRooms.concept,
        budgetShortfallUsd: Math.max(0, withRooms.concept.estimateUsd - budgetUsd),
        trimmedForBudget: withRooms.concept.trimmedForBudget && !allNamed,
      },
    };
    if (fixed.concept.budgetShortfallUsd !== Math.max(0, fixed.concept.estimateUsd - budgetUsd)) stale++;
    // The unfixed version is what the bug looked like: keep the assertion
    // pointed at the property, not at my arithmetic.
    if (withRooms.concept.budgetShortfallUsd === fixed.concept.budgetShortfallUsd
      && withRooms.concept.estimateUsd !== trip.concept.estimateUsd) lying++;
    if (fixed.concept.trimmedForBudget && allNamed) stale++;
  }
  check("the miss matches the estimate once the rooms are in", stale === 0, `${stale} of ${cases}`);
  check("and the rooms really did move the total", lying === 0, `${lying} of ${cases}`);
}

console.log("\n\x1b[1mCHEAPER MEANS CHEAPER HERE\x1b[0m\n");
{
  /*
   * `cheaper` and `set_budget` call recommend() through `here()`, which pins
   * the destination. Without the pin, 38 of 40 "make it cheaper" turns changed
   * COUNTRY — "New Zealand's South Island" became "the Olympic Peninsula"
   * while the summary still read "Re-cut to $1,558 from $3,244." Only the
   * set_budget half was covered, so reverting the `cheaper` pin alone left the
   * suite green: two branches, one intent, one test.
   */
  let drifted = 0, turns = 0;
  for (const d of DESTINATIONS) {
    const brief = applyPatch(emptyBrief(), {
      namedDestination: d.id, days: 9, month: "October",
    }) as Brief;
    const trip = planTrip(brief, recommend(brief), emptyProfile());
    for (const ops of [
      parseEditRules("make it cheaper", trip),
      [{ kind: "set_budget", usd: 900 }] as EditOp[],
    ]) {
      if (!ops.length) continue;
      turns++;
      const out = applyOps(trip, ops, brief, emptyProfile()).trip;
      if (out.concept.destinationId !== d.id) {
        drifted++;
        if (drifted <= 2) console.log(`        ${d.id} → ${out.concept.destinationId} via ${ops[0].kind}`);
      }
    }
  }
  check("neither way of asking for cheaper moves the country",
    drifted === 0, `${drifted} of ${turns}`);
  check("and both ways were exercised", turns >= DESTINATIONS.length * 2, `${turns}`);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
