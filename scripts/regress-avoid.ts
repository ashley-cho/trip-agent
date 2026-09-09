/**
 * A place she ruled out had nowhere to live.
 *
 * "i wanna go to turkey but not istanbul" parsed the country correctly and
 * dropped the exclusion on the floor. Not a parser miss: there was no field
 * for it. avoidTags is a fixed list of 28 tags and none of them is a city
 * name; constraints is free text that only select.ts reads, and only to match
 * those same tags. So Turkey would be researched and Istanbul come back as the
 * obvious first base, and she would be shown an itinerary starting in the one
 * city she had ruled out.
 *
 * Three layers, because a prompt is not an enforcement mechanism:
 * the parser records it, the researcher is told, the planner refuses to sleep
 * there.
 */
import { interpretRules } from "@/lib/discovery";
import { applyPatch } from "@/lib/brief";
import { researchPrompt } from "@/lib/research";
import { planTrip } from "@/lib/planner";
import { recommend } from "@/lib/recommend";
import { emptyBrief, emptyProfile } from "@/lib/types";
import type { Brief } from "@/lib/types";
import { CITIES, DESTINATIONS, cityById } from "@/data/destinations";
import { critique } from "@/lib/critic";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n  somewhere she ruled out\n");

// --- it is recorded at all ------------------------------------------------
{
  const said = "i wanna go to turkey but not istanbul";
  const b = applyPatch(emptyBrief(said), interpretRules(said, emptyBrief()));
  check("the country still parses", JSON.stringify(b.unknownCandidates) === JSON.stringify(["turkey"]),
    JSON.stringify(b.unknownCandidates));
  check("and the exclusion is kept", JSON.stringify(b.avoidPlaces) === JSON.stringify(["istanbul"]),
    JSON.stringify(b.avoidPlaces));
}
{
  const said = "portugal, not lisbon";
  const b = applyPatch(emptyBrief(said), interpretRules(said, emptyBrief()));
  check("a comma clause works too", (b.avoidPlaces ?? []).includes("lisbon"), JSON.stringify(b.avoidPlaces));
}
{
  // A tag is not a place. "not museums" must stay a tag, or every avoided
  // interest becomes a fake city.
  const said = "japan but not museums";
  const b = applyPatch(emptyBrief(said), interpretRules(said, emptyBrief()));
  check("an avoided interest is not filed as a place",
    !(b.avoidPlaces ?? []).length && b.avoidTags.includes("museum"),
    `places=${JSON.stringify(b.avoidPlaces)} tags=${JSON.stringify(b.avoidTags)}`);
}
{
  const first = "turkey but not istanbul";
  let b = applyPatch(emptyBrief(first), interpretRules(first, emptyBrief()));
  b = applyPatch(b, interpretRules("also not ankara", b));
  check("ruling somewhere out only ever adds", (b.avoidPlaces ?? []).length === 2,
    JSON.stringify(b.avoidPlaces));
}

// --- the researcher is told ----------------------------------------------
{
  const p = researchPrompt("turkey", 7, "San Francisco", "food and coast", ["istanbul"]);
  check("the prompt names it", /RULED THESE OUT: istanbul/.test(p));
  check("and says passing through is fine but staying is not",
    /Passing through on the way somewhere is fine, staying/.test(p));
  check("with nothing ruled out the prompt is unchanged",
    !/RULED THESE OUT/.test(researchPrompt("turkey", 7, "San Francisco", "food and coast")));
}

// --- and the planner will not sleep there --------------------------------
{
  const prof = emptyProfile();
  const dest = "portugal";
  const lisbon = CITIES.find((c) => c.destinationId === dest && /lisbon/i.test(c.name))!;
  const b: Brief = { ...emptyBrief("x"), vibes: ["food"] as any, days: 7, namedDestination: dest };
  const before = planTrip(b, recommend(b, prof), prof);
  check("Lisbon is normally a base", before.concept.shape.some((l) => l.cityId === lisbon.id),
    before.concept.shape.map((l) => l.cityId).join(" > "));

  const avoided: Brief = { ...b, avoidPlaces: ["lisbon"] };
  const after = planTrip(avoided, recommend(avoided, prof), prof);
  check("ruled out, it is not a base", !after.concept.shape.some((l) => l.cityId === lisbon.id),
    after.concept.shape.map((l) => l.cityId).join(" > "));
  check("and the trip still happens", after.days.length === 7 && after.concept.shape.length > 0);
}
{
  // Ruling out everywhere must not produce a tripless trip.
  const prof = emptyProfile();
  const b: Brief = { ...emptyBrief("x"), vibes: ["food"] as any, days: 6,
    namedDestination: "portugal", avoidPlaces: ["portugal", "lisbon", "porto", "sintra", "algarve", "douro", "evora"] };
  const t = planTrip(b, recommend(b, prof), prof);
  check("ruling out everywhere falls back rather than failing",
    t.concept.shape.length > 0 && t.days.length === 6,
    t.concept.shape.map((l) => l.cityId).join(" > "));
}

console.log("\n\x1b[1mAND THE PLAN NEVER QUIETLY GOES THERE ANYWAY\x1b[0m\n");
{
  const TODAY = new Date("2026-09-09T00:00:00Z");
  const plan = (text: string) => {
    const b0 = emptyBrief(text);
    const b = applyPatch(b0, interpretRules(text, b0)) as Brief;
    return { brief: b, trip: planTrip(b, recommend(b), emptyProfile(), { today: TODAY }) };
  };

  /*
   * It used to throw.
   *
   * The "if ruling it out leaves nowhere to sleep, drop the filter" fallback
   * was computed over every city in the destination, day-trip-only towns
   * included. So ruling out the only city with beds still left a bedless town
   * matching, the filter was kept, and the next line indexed an empty array.
   * She got "Something went wrong on my end. Say that again?" — and got it
   * again on every retry — from the exact phrasing this field was built for.
   */
  let threw = 0, tested = 0;
  const cities = new Map<string, string[]>();
  for (const c of CITIES) {
    if (!cities.has(c.destinationId)) cities.set(c.destinationId, []);
    cities.get(c.destinationId)!.push(c.name);
  }
  for (const [dest, names] of cities) {
    for (const name of names) {
      tested++;
      try { plan(`i want to go to ${dest} for 9 days but not ${name.toLowerCase()}`); }
      catch { threw++; console.log(`        threw: ${dest} without ${name}`); }
    }
  }
  check("ruling out any one city never crashes the planner", threw === 0, `${threw} of ${tested}`);

  /*
   * A day out to a place she ruled out is still going there, and a night at
   * the airport city she ruled out is still a night there.
   */
  let visits = 0, cases = 0, dayVisits = 0;
  const overridden: string[] = [];
  for (const [dest, names] of cities) {
    for (const name of names) {
      cases++;
      const { trip } = plan(`i want to go to ${dest} for 9 days but not ${name.toLowerCase()}`);
      const all = trip.concept.shape.flatMap((l) =>
        [l.cityId, ...(l.dayTrip ? [l.dayTrip] : []), ...(l.extraDayTrip ? [l.extraDayTrip] : [])]);
      const there = all.some((id) => CITIES.find((c) => c.id === id)?.name === name);
      // Going anyway is allowed — the catalogue may leave no other trip — but
      // only out loud. Silence is the bug.
      if (there && !trip.concept.overrideNote) visits++;
      if (there && trip.concept.overrideNote) overridden.push(`${dest}/${name}`);
      /*
       * A day trip is never forced. The override exists because a trip has to
       * sleep somewhere; nothing has to spend an afternoon anywhere, so a day
       * out to a city she ruled out is always avoidable and never excusable.
       * `keep` was applied to the bases and not to these.
       */
      const asDayTrip = trip.concept.shape.some((l) =>
        [l.dayTrip, l.extraDayTrip].some((id) => id && CITIES.find((c) => c.id === id)?.name === name));
      if (asDayTrip) { dayVisits++; if (dayVisits <= 2) console.log(`        day trip to ${name} anyway`); }
    }
  }
  check("a ruled-out city is never in the trip without being mentioned",
    visits === 0, `${visits} silent of ${cases}`);
  check("a day out to a ruled-out city is never scheduled", dayVisits === 0, `${dayVisits} of ${cases}`);
  check("and when a base has to be, it says so", overridden.length > 0,
    `${overridden.length} owned up to, e.g. ${overridden[0]}`);

  /*
   * She cannot type the accent, so the comparison must not need it.
   * "not reykjavik" left six nights in Reykjavík; four catalogue cities carry
   * a character that is not on her keyboard and all four exclusions did
   * nothing at all.
   */
  const ACCENTED = CITIES.filter((c) => c.name !== c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  let ignored = 0;
  for (const c of ACCENTED) {
    const plainName = c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const { trip } = plan(`i want to go to ${c.destinationId} for 9 days but not ${plainName}`);
    const there = trip.concept.shape.some((l) => l.cityId === c.id);
    if (there && !trip.concept.overrideNote) { ignored++; console.log(`        ${c.name} ignored`); }
  }
  check("an accent she can't type doesn't defeat the exclusion",
    ignored === 0, `${ignored} of ${ACCENTED.length} accented cities`);
  check("and there are accented cities to test", ACCENTED.length > 0, `${ACCENTED.length}`);
}

console.log("\n\x1b[1mAND THE CRITIC KNOWS ABOUT IT\x1b[0m\n");
{
  /*
   * The one check that runs after every plan and every edit was blind to the
   * two hardest constraints in the brief: `critique` had no avoidPlaces rule
   * and no visited rule, so "denmark but not copenhagen" came back sleeping in
   * Copenhagen with nothing to say about it. The planner's own comment has
   * said this was missing since it was written.
   */
  const TODAY = new Date("2026-09-09T00:00:00Z");
  const plan2 = (text: string) => {
    const b0 = emptyBrief(text);
    const b = applyPatch(b0, interpretRules(text, b0)) as Brief;
    return { brief: b, trip: planTrip(b, recommend(b), emptyProfile(), { today: TODAY }) };
  };
  const byDest = new Map<string, string[]>();
  for (const c of CITIES) {
    if (!byDest.has(c.destinationId)) byDest.set(c.destinationId, []);
    byDest.get(c.destinationId)!.push(c.name);
  }
  let silent = 0, overridden2 = 0;
  for (const [dest, names] of byDest) {
    for (const name of names) {
      const { brief, trip } = plan2(`i want to go to ${dest} for 9 days but not ${name.toLowerCase()}`);
      const there = trip.concept.shape.some((l) => CITIES.find((c) => c.id === l.cityId)?.name === name);
      if (!there) continue;
      overridden2++;
      if (!critique(trip, brief, emptyProfile()).some((i) => /ruled out/.test(i.message))) silent++;
    }
  }
  /*
   * One matcher, or the panels disagree. `overrideNote` matched both
   * directions and the critic matched one, so "not copenhagen please" — the
   * trailing word lands in avoidPlaces — got an override note and no warning.
   */
  {
    const { brief, trip } = plan2("denmark for 9 days, not copenhagen please");
    const goes = trip.concept.shape.some((l) => cityById(l.cityId).name === "Copenhagen");
    check("a trailing word doesn't split the override note from the critic",
      !goes || (!!trip.concept.overrideNote
        && critique(trip, brief, emptyProfile()).some((i) => /ruled out/.test(i.message))),
      `avoidPlaces=${JSON.stringify(brief.avoidPlaces)} note=${!!trip.concept.overrideNote}`);
  }

  check("the critic flags a trip that goes somewhere she ruled out",
    silent === 0, `${silent} silent of ${overridden2}`);
  check("and there were such trips", overridden2 > 0, `${overridden2}`);

  {
    const text = "i want to go to portugal for 9 days. i've been to sintra already";
    const { brief, trip } = plan2(text);
    const goes = trip.concept.shape.some((l) =>
      [l.cityId, l.dayTrip, l.extraDayTrip].some((id) => id === "sintra"));
    check("and one that goes somewhere she has already been",
      !goes || critique(trip, brief, emptyProfile()).some((i) => /already been/.test(i.message)),
      goes ? "goes to Sintra, flagged?" : "doesn't go to Sintra");
  }

  /*
   * One budget threshold, not three: the planner re-cut at 1.02, the card
   * warned at 1.00 and the critic errored at 1.05, so the panel told her the
   * trip was over while the critic said it was fine. 23 of 165.
   */
  let disagree = 0, checked2 = 0;
  for (const d of DESTINATIONS) {
    const b0 = applyPatch(emptyBrief(), { namedDestination: d.id, days: 8, month: "October" }) as Brief;
    const base = planTrip(b0, recommend(b0), emptyProfile(), { today: TODAY });
    for (const frac of [0.95, 0.97, 0.99, 1.0]) {
      checked2++;
      const budgetUsd = Math.round(base.concept.estimateUsd * frac);
      const b = { ...b0, budgetUsd } as Brief;
      const trip = planTrip(b, recommend(b), emptyProfile(), { today: TODAY });
      const panel = trip.concept.budgetShortfallUsd > 0;
      const critic = critique(trip, b, emptyProfile()).some((i) => i.code === "over_budget");
      if (panel !== critic) disagree++;
    }
  }
  check("the panel and the critic agree about the budget",
    disagree === 0, `${disagree} of ${checked2} disagree`);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
