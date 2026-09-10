/**
 * Regression: a catalogue too thin for the trip was planned anyway.
 *
 * `npx tsx evals/run.ts --sweep` reads pace adherence at 56% across all
 * fifteen destinations against 74% on the scorecard, because the recommender
 * only ever sends the normal suite to seven of them and those seven are the
 * top of that ranking. Southwest sat at 26%: twenty-four places across two
 * national parks, asked to fill ten days at four things a day. Nothing on the
 * way in said a word. It cleared `dataDepth`, which was a 0.45 fraction of 2.6
 * a day — 1.17 places a day — while the planner was scheduling four and the
 * scorecard was measuring four, and the difference came out as empty
 * afternoons filed as downtime.
 *
 * Ashley's call, twice, and the same call both times: "no degraded mode at all
 * - just stop", and "always ask ... it's better than spitting out nonsensical
 * bs". A thin trip presented as a good one is the degraded mode.
 *
 * So the recommender applies the bar the rest of the app already agreed on.
 * What is pinned here:
 *
 *   1. the bar is the pace SHE asked for, not a constant of ours;
 *   2. it applies to a destination she NAMED, which used to skip every gate;
 *   3. it refuses out loud — `noGoodFit` — rather than planning thin;
 *   4. a length we invented is not grounds to refuse anything;
 *   5. a catalogue we RESEARCHED keeps the low bar, because the alternative
 *      there is a different continent (see `minimumToPlan` in lib/research.ts);
 *   6. the refusal reaches the traveller as a sentence, and does not read as a
 *      quotation of something she never typed.
 *
 * Every check below is mutation-verified: each one has been watched to fail
 * with the gate removed or inverted. `scripts/regress-thin.ts` is the other
 * half of this and pins the OPPOSITE failure — that a short researched pack is
 * not a reason to send her somewhere else. The two bars must not converge.
 */
import { readFileSync } from "node:fs";
import { emptyBrief, PACE_ACTIVITIES, type Brief, type Pace } from "@/lib/types";
import { inferPace } from "@/lib/discovery";
import {
  recommend, scoreDestinations, catalogueSize, catalogueActivities,
  activitiesNeeded, daysSupported, carries, cataloguePlannable, tooThinFor,
} from "@/lib/recommend";
import { destinationById, DESTINATIONS } from "@/data/destinations";
import { registerPack } from "@/data/registry";
import type { DestinationPack } from "@/lib/research";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA CATALOGUE THAT CANNOT CARRY THE TRIP SAYS SO\x1b[0m\n");

/**
 * The thinnest catalogue we SHIP, resolved once, before anything below
 * registers a researched pack into the same array.
 *
 * Picked rather than named so that filling a catalogue moves this test onto
 * the next thinnest instead of quietly making it vacuous — and captured up
 * front, because `registerPack` pushes into DESTINATIONS and the deliberately
 * thin pack in section 5 would otherwise win this every time.
 */
const SHIPPED = [...DESTINATIONS];
const THINNEST = [...SHIPPED].sort((a, b) => catalogueActivities(a) - catalogueActivities(b))[0];

/** A brief with a length she actually gave. */
const asked = (id: string, days: number, vibes: string[] = ["nature"]): Brief =>
  ({ ...emptyBrief("plan me something"), namedDestination: id, days, vibes: vibes as Brief["vibes"] });

// --- 1. the bar is her pace, and it is the app's own number ----------------
{
  check("the floor is the pace asked for, on the days that are not travel days",
    activitiesNeeded(9, "mixed") === 7 * (PACE_ACTIVITIES.mixed - 1)
    && activitiesNeeded(9, "busy") === 7 * (PACE_ACTIVITIES.busy - 1),
    `${activitiesNeeded(9, "mixed")} mixed vs ${activitiesNeeded(9, "busy")} busy`);

  /*
   * One below target, because `paceAdherence` scores a day adherent at
   * target-1 and this is a floor under that band rather than a target. At the
   * full number a busy eight-day trip wanted thirty things, fourteen of the
   * fifteen catalogues were ruled out, and a Korean-food brief was answered
   * with Portugal — a worse answer than Korea slightly under pace.
   */
  check("and it is the tolerated band, not the target",
    activitiesNeeded(8, "busy") < 6 * PACE_ACTIVITIES.busy,
    `${activitiesNeeded(8, "busy")} for a busy eight days`);

  check("so asking for a busy trip needs more than asking for a slow one",
    activitiesNeeded(10, "busy") > activitiesNeeded(10, "relaxed"));

  // The bug this replaced: placesNeeded caps at twenty, so above twenty places
  // the old gate could not fire at any length at all.
  check("and it does not stop growing at twenty places",
    activitiesNeeded(20, "mixed") > 20 && activitiesNeeded(30, "mixed") > activitiesNeeded(20, "mixed"),
    `${activitiesNeeded(20, "mixed")} at 20 days`);

  // Meals feed you during a day; they do not fill one, and `paceAdherence`
  // counts activity items only.
  const pt = destinationById("portugal");
  check("meals are not counted as things to do",
    catalogueActivities(pt) < catalogueSize(pt),
    `${catalogueActivities(pt)} of ${catalogueSize(pt)}`);
}

// --- 2 & 3. a destination she named is not exempt --------------------------
{
  /*
   * The exact shape of the reported case. Pick whichever catalogue we hold is
   * thinnest rather than naming one, so that filling a catalogue later moves
   * this test to the next thinnest instead of quietly making it vacuous.
   */
  const thinnest = THINNEST;
  const need = catalogueActivities(thinnest);
  // A length that is definitely beyond it, at a pace she stated.
  const days = Math.max(thinnest.minDays, Math.ceil(need / 4) + 4);
  const b = asked(thinnest.id, days);

  check("the thinnest catalogue we hold cannot carry a long trip",
    !carries(thinnest, days, inferPace(b)),
    `${thinnest.id}: ${need} things to do, ${activitiesNeeded(days, inferPace(b))} wanted for ${days} days`);

  const rec = recommend(b);
  check("naming it does not get it planned anyway",
    !!rec.noGoodFit, `noGoodFit = ${JSON.stringify(rec.noGoodFit)}`);
  check("and the answer is not dressed up as a confident one",
    rec.confidence === "low", rec.confidence);

  // The whole point: lib/flow.ts returns without a trip when noGoodFit is set.
  const flow = readFileSync("lib/flow.ts", "utf8");
  check("and the turn stops there rather than planning a thin one",
    /if \(rec\.noGoodFit\) return;/.test(flow));
}

// --- the same destination at a length it CAN carry is still planned --------
{
  const pt = destinationById("portugal");
  const short = asked("portugal", 4);
  check("a length the catalogue does carry is planned as normal",
    !recommend(short).noGoodFit && recommend(short).confidence === "high",
    `${catalogueActivities(pt)} things to do, ${activitiesNeeded(4, inferPace(short))} wanted`);
  check("and daysSupported reports the edge rather than a second opinion about it",
    carries(pt, daysSupported(pt, "mixed"), "mixed")
    && !carries(pt, daysSupported(pt, "mixed") + 1, "mixed"),
    `portugal carries ${daysSupported(pt, "mixed")} days at a mixed pace`);
}

// --- 4. a length she never gave is not grounds to refuse -------------------
{
  const thinnest = THINNEST;
  const unstated: Brief = { ...emptyBrief("somewhere like that"), namedDestination: thinnest.id,
    vibes: ["nature"] as Brief["vibes"] };
  check("with no length on the brief it does not refuse on a number we invented",
    !tooThinFor(thinnest, unstated, 7) && !recommend(unstated).noGoodFit,
    `${thinnest.id} with no days`);
  check("but the same brief with her seven days on it is judged",
    tooThinFor(thinnest, { ...unstated, days: 12 }, 12),
    `${thinnest.id} at 12 stated days`);
}

// --- 5. a researched pack keeps the low bar --------------------------------
{
  /*
   * The Faroe Islands. Seven days came back with a real shape and lost two of
   * its three fill-in calls; the total fell short of comfortable and the whole
   * country was replaced with Paris. lib/flow.ts already applied `plannable`
   * to this pack before registering it. Re-judging it here on a stricter
   * number would throw the country away a second time.
   */
  const id = `thintest-${Date.now()}`;
  registerPack({
    destination: { id, name: "Thin Test", hubCityId: `${id}-hub`, pitch: "Somewhere.",
      strengths: { nature: 5, exploration: 3, food: 1, relaxation: 1, culture: 1, adventure: 4, city: 0 },
      paceFit: ["mixed"], flightUsd: 900, floorPerDayUsd: 120, minDays: 3, warmth: 2, arrival: "fly",
      caveat: "Small.", because: { nature: "Cliffs." } },
    cities: [{ id: `${id}-hub`, name: "Thin Test", destinationId: id, lat: 62.0, lng: -6.8,
      nightlyUsd: 140, minNights: 2, maxNights: 7, base: "In town.", scale: "walkable" }],
    outings: [],
    places: Array.from({ length: 11 }, (_, i) => ({
      id: `${id}-p${i}`, cityId: `${id}-hub`, name: `Thing ${i}`,
      kind: i % 4 === 0 ? "meal" : "walk", tags: ["nature"], neighborhood: "Town",
      lat: 62.0, lng: -6.8, durationMin: 120, costUsd: 0, bestTime: "any", touristy: 2,
      note: "A real place, in the test.",
    })),
    sources: [],
  } as unknown as DestinationPack);

  const d = destinationById(id);
  const seven = asked(id, 7);
  check("the researched pack would fail the shipped-catalogue bar",
    !carries(d, 7, inferPace(seven)),
    `${catalogueActivities(d)} things to do, ${activitiesNeeded(7, inferPace(seven))} wanted`);
  check("but it clears the give-up bar, so it is not thrown away",
    cataloguePlannable(d, 7) && !tooThinFor(d, seven, 7));
  check("and a week there is still planned rather than replaced",
    !recommend(seven).noGoodFit, JSON.stringify(recommend(seven).noGoodFit));
  check("the two bars have not converged",
    !carries(d, 7, "mixed") && cataloguePlannable(d, 7));
}

// --- 6. what she actually reads --------------------------------------------
{
  const thinnest = THINNEST;
  const days = Math.max(thinnest.minDays, catalogueActivities(thinnest));
  const why = recommend(asked(thinnest.id, days)).noGoodFit ?? "";

  check("the refusal names the shortfall in days, not in places",
    /days/.test(why) && !/place|catalogue|score|metric/i.test(why), why);

  /*
   * It said "and you asked for 7". `attribution_accuracy` reads "you asked
   * for" as a claim about something she typed, and the 7 is a number this app
   * derived from "about a week" — it cost that metric three points across the
   * sweep before anyone had typed a digit.
   */
  check("and it does not attribute a number she may never have typed",
    !/\byou (said|asked for|wanted|told me)\b/i.test(why), why);

  const banned = ["hidden gem", "vibrant", "nestled", "bustling", "must-see", "charming",
    "stunning", "breathtaking", "iconic landmark", "world-class"];
  check("and it is written in the product's voice",
    !banned.some((w) => why.toLowerCase().includes(w)), why);
}

// --- the open field: down-ranked, and only refused when nothing is left -----
{
  const thinnest = THINNEST;
  const open: Brief = { ...emptyBrief("eight days, somewhere with a lot going on"),
    days: 8, vibes: ["culture", "food"] as Brief["vibes"] };
  // Only the catalogues we ship: the test pack registered above is not one.
  const scored = scoreDestinations(open).filter((x) => SHIPPED.some((d) => d.id === x.id));
  const thin = scored.find((s) => s.id === thinnest.id)!;
  check("a thin catalogue is marked excluded in the open field too",
    !!thin.excluded, `${thinnest.id}: ${thin.excluded ?? "not excluded"}`);
  /*
   * Marking it is not the job; ranking it below everything that can actually
   * carry the trip is. Without the penalty on `excluded` a thin catalogue that
   * scores well on vibe still wins, `noGoodFit` never fires because the top of
   * the list is not the excluded one, and the refusal is silently unreachable.
   */
  const lastLive = scored.map((x) => !x.excluded).lastIndexOf(true);
  const firstDead = scored.findIndex((x) => !!x.excluded);
  check("and every thin catalogue ranks below every one that can carry it",
    firstDead === -1 || lastLive === -1 || firstDead > lastLive,
    scored.map((x) => `${x.id}${x.excluded ? "*" : ""}`).join(" "));
  check("while something that can carry the trip still wins outright",
    !scored[0].excluded && !recommend(open).noGoodFit,
    `${scored[0].id}${scored[0].excluded ? ` — ${scored[0].excluded}` : ""}`);

  /*
   * And the consequence of the bar, written down rather than discovered later.
   *
   * At four things a day a fortnight wants 48, and the fullest catalogue we
   * hold has 31. So the honest answer to "two weeks, somewhere busy" today is
   * that we have nowhere to send her, and it is given as a sentence rather
   * than as fourteen days with six of them empty. That is the rule working,
   * not the rule misfiring — but it is a real product limit, and the fix is
   * more places, not a lower bar. If this check starts failing because a
   * catalogue grew past 48, delete it and be pleased.
   */
  const fortnight: Brief = { ...open, opening: "two weeks, somewhere with a lot going on", days: 14 };
  const shippedAt14 = scoreDestinations(fortnight)
    .filter((x) => SHIPPED.some((d) => d.id === x.id));
  check("and a fortnight is beyond every catalogue we ship, each one said so",
    shippedAt14.every((x) => !!x.excluded),
    `${activitiesNeeded(14, "mixed")} wanted; the fullest we ship has `
    + `${Math.max(...SHIPPED.map(catalogueActivities))}; `
    + `${shippedAt14.filter((x) => !x.excluded).map((x) => x.id).join(", ") || "none"} not excluded`);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
