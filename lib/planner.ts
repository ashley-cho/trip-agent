import { fold } from "@/lib/text";
import { SEEDED_ORIGIN, type Origin } from "@/lib/origin";
import { addDays as addDaysIso, prettyDate, startOfStatedMonth } from "@/lib/dates";
import { fitDays, flightFor } from "@/lib/recommend";
import type {
  Brief, City, Destination, ItineraryDay, ItineraryItem, MockBooking, Place,
  Trip, TripShapeLeg, TravelerProfile, Pace,
} from "@/lib/types";
import { PACE_ACTIVITIES } from "@/lib/types";
import { CITIES, INTERCITY, cityById, destinationById } from "@/data/destinations";
import { placesInCity } from "@/data";
import { candidatesFor, passedOnIn, type Candidate } from "@/lib/select";
import { ReasonBank } from "@/lib/reasons";
import { effectiveDays, inferPace } from "@/lib/discovery";
import { haversineKm, toClock, toMin, travelMinutes } from "@/lib/geo";
import { fitsTimeOfDay, isOpenFor } from "@/lib/hours";
import { unenforcedNote } from "@/lib/concept";
import { lodgingUsd, nightlyUsdFor } from "@/lib/lodging";
import { resolveLeg, legVerb, legReason, type TransportMode } from "@/lib/transport";
import type { Recommendation } from "@/lib/agent/types";

type Slot = "morning" | "midday" | "afternoon" | "evening";

const START_MIN: Record<Pace, number> = { relaxed: 570, light: 570, mixed: 540, busy: 510 };
const DOWNTIME_MIN: Record<Pace, number> = { relaxed: 210, light: 195, mixed: 180, busy: 75 };

let seq = 0;
const uid = (p: string) => `${p}-${(seq++).toString(36)}`;

// --- dates -----------------------------------------------------------------

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekdayOf = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();

/** A Saturday far enough out to actually book. Deterministic for evals. */
export function defaultStartDate(today = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 45);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// --- inter-city transit ----------------------------------------------------

/**
 * Kept as the one name the planner calls; the judgment moved to lib/transport.
 * See that file for why the old one-line fallback was selling train tickets
 * to places with no railway.
 */
export function interCity(a: City, b: City, prefer?: TransportMode) {
  return resolveLeg(a, b, prefer);
}

// --- trip shape ------------------------------------------------------------

/**
 * Section 32 (geographic coherence): at most one base change on a short trip,
 * and at most one day trip under 9 days. Transit is the thing that quietly
 * eats a vacation, so the shape is where we defend against it.
 */
/**
 * How well a base serves this particular brief, counting the day trip it
 * unlocks. Reykjavík has two genuinely outdoor places; Vík has a handful but
 * puts the whole south coast within reach. Without this, a landscape trip
 * spends four of seven nights in a city and fills the days with museums.
 */
function baseFit(cityId: string, dayTripId: string | undefined, brief: Brief, profile: TravelerProfile): number {
  const pool = [
    ...candidatesFor(cityId, brief, profile),
    ...(dayTripId ? candidatesFor(dayTripId, brief, profile) : []),
  ];
  if (!pool.length) return 0;
  return pool.filter((c) => c.relevant).length / pool.length;
}

/**
 * Lower-cased and stripped of accents, for comparing what she typed against a
 * name she cannot type. "not reykjavik" left six nights in Reykjavík, because
 * the comparison was exact; four catalogue cities carry a character that isn't
 * on her keyboard, and all four exclusions of them did nothing at all.
 */
/** The shared fold, re-exported under the name this file's callers use. */
export const plain = fold;

/**
 * The one test for "is this city the place she ruled out".
 *
 * There were three: `buildShape`'s `allowed` and `overrideNote` matched both
 * directions, `critique` matched one, and `unenforced` matched one without
 * stripping accents. So "not copenhagen please" got an override note and no
 * critic warning, and the accented cities the `plain` comment exists for were
 * still compared raw in the third copy.
 */
export function isRuledOut(cityName: string, ruledOut: readonly string[]): boolean {
  const name = plain(cityName);
  return ruledOut.map(plain).filter(Boolean)
    .some((x) => name.includes(x) || x.includes(name));
}

export function buildShape(
  destinationId: string,
  days: number,
  brief?: Brief,
  profile?: TravelerProfile,
): TripShapeLeg[] {
  const dest = destinationById(destinationId);
  // A city with no seeded places produces an empty day, which reads as a bug
  // rather than as downtime. Until the dataset covers it, it isn't in play.
  const inDest = CITIES.filter((c) => c.destinationId === destinationId && placesInCity(c.id).length > 0);
  /*
   * A place she ruled out is not a base, whatever the research came back with.
   *
   * The prompt asks the researcher to leave it out, which is where this should
   * be settled. This is the backstop for when it doesn't: a model instruction
   * is not an enforcement mechanism, and "turkey but not istanbul" ending in
   * Istanbul is the whole point of the field.
   *
   * Name match, because that is what she typed. If ruling it out would leave
   * nowhere to sleep, the filter is dropped rather than the destination: a
   * trip with the wrong base beats no trip, and the verdict already had its
   * chance to say so.
   */
  const ruledOut = (brief?.avoidPlaces ?? []).map(plain).filter(Boolean);
  const allowed = (c: City) => !isRuledOut(c.name, ruledOut);
  /*
   * The fallback is computed over the set it filters.
   *
   * It was computed over `inDest`, which includes day-trip-only towns. So
   * ruling out the only city with beds still left a day-trip town matching
   * `allowed`, the filter was kept, `sleepable` came back empty, and the next
   * line threw on `sleepable[0].id`. "i want to go to catalonia for 9 days but
   * not barcelona" — the exact phrasing this field was built for — died with
   * "Something went wrong on my end. Say that again?", and did it again on
   * every retry. Three destinations of fifteen.
   */
  const beds = inDest.filter((c) => !c.dayTripOnly);
  const keep = beds.filter(allowed).length ? allowed : () => true;

  const sleepable = beds.filter(keep)
    .sort((a, b) => (a.id === dest.hubCityId ? -1 : b.id === dest.hubCityId ? 1 : 0));
  /*
   * A day out to a place she ruled out is still going there.
   *
   * `keep` was applied to the bases and not to these, so "portugal but not
   * Sintra" based her in Lisbon and then spent day two in Sintra. Thirteen of
   * thirty-six exclusions I measured came back as a day trip to the very place
   * that was refused, and the critic has no rule about avoidPlaces, so nothing
   * downstream noticed.
   */
  const dayTrips = inDest.filter((c) => c.dayTripOnly).filter(keep);

  const nights = Math.max(1, days - 1);
  const legs: TripShapeLeg[] = [];

  const tripOf = (id: string) =>
    dayTrips.find((t) => (t.dayTripFrom ?? dest.hubCityId) === id)?.id;

  /*
   * They named a city, so that city is the trip.
   *
   * The data for Oaxaca lives in the Mexico pack, so naming Oaxaca resolves to
   * Mexico, and everything below then did what it does for a country: took the
   * hub, added a second base, and produced "Mexico City & Oaxaca" for someone
   * who asked for Oaxaca. Sleeping somewhere they did not name is going
   * somewhere they did not name.
   *
   * Day trips out and back still belong to the trip: you have not left Oaxaca
   * by spending an afternoon at Hierve el Agua. Only the bases are pinned.
   */
  const focus = brief?.focusCityId
    ? sleepable.find((c) => c.id === brief.focusCityId)
    : undefined;
  if (focus) return [{ cityId: focus.id, nights }];

  /*
   * She named a town we hold no beds in.
   *
   * The lookup above only searches `sleepable`, and `focusCityId` is resolved
   * against every city we know, day-trip-only ones included. So "i want to go
   * to Sintra for 4 days" resolved Sintra, found nothing sleepable, fell
   * silently through to the generic country shape, and based her in Lisbon.
   * Under five days she did not even get Sintra as a day trip out. Same for
   * Jeonju, Gyeongju, Teotihuacán, the Douro, Hierve el Agua, Wanaka,
   * Glenorchy, Milford and Chianti.
   *
   * The catalogue not holding a hotel there is a fact about the catalogue. It
   * is not permission to send her somewhere she did not name and say nothing.
   * So base her where the town is actually reached from, and pin that town as
   * the day trip so it is unmistakably part of the trip rather than a
   * coincidence. The pitch copy reads the shape, so it says so.
   */
  const named = brief?.focusCityId
    ? inDest.find((c) => c.id === brief.focusCityId)
    : undefined;
  if (named?.dayTripOnly) {
    const from = sleepable.find((c) => c.id === (named.dayTripFrom ?? dest.hubCityId))
      ?? sleepable[0];
    if (from) return [{ cityId: from.id, nights, dayTrip: named.id }];
  }

  if (days <= 5 || sleepable.length < 2) {
    legs.push({ cityId: sleepable[0].id, nights });
  } else {
    /**
     * How many places you sleep. This used to be two, always, whatever the
     * length of the trip and however many bases the destination had.
     *
     * On a twelve-day Yunnan trek that produced six nights in Kunming and
     * four in Lijiang: the transport hub and the nearest old town, with the
     * gorge and the mountains it had just promised sitting unreachable in the
     * catalogue. The agent's own verdict said Tiger Leaping Gorge, Haba and
     * Shangri-La, and then the shape offered none of them, because there was
     * no third slot to put them in.
     *
     * Roughly a base per four nights, never more than the destination
     * actually holds, and never so many that the trip becomes the packing
     * and unpacking that section 10 exists to prevent.
     */
    const wanted = Math.min(
      sleepable.length,
      Math.max(2, Math.min(4, Math.floor(nights / 4) + 1)),
    );

    // The hub is always first: you land there. After that, take whichever
    // bases serve what they actually asked for.
    const [hub, ...rest] = sleepable;
    const ranked = brief && profile && brief.vibes.length
      ? [...rest].sort((x, y) =>
          baseFit(y.id, tripOf(y.id), brief, profile) - baseFit(x.id, tripOf(x.id), brief, profile))
      : rest;
    const bases = [hub, ...ranked.slice(0, wanted - 1)];

    // Start everyone at their floor, then hand out what's left to whichever
    // base serves the brief best and still has room. A base that can only
    // absorb two nights should not be given five.
    const share = bases.map((c) => ({
      city: c,
      nights: Math.max(1, c.minNights),
      fit: brief && profile && brief.vibes.length ? baseFit(c.id, tripOf(c.id), brief, profile) : 0.5,
    }));

    let left = nights - share.reduce((sum, x) => sum + x.nights, 0);
    // Over-committed at the floors: take nights back from the worst fit first.
    while (left < 0) {
      const give = [...share].sort((x, y) => x.fit - y.fit).find((x) => x.nights > 1);
      if (!give) break;
      give.nights--; left++;
    }
    while (left > 0) {
      const take = [...share]
        .sort((x, y) => y.fit - x.fit)
        .find((x) => x.nights < x.city.maxNights);
      if (!take) { share[0].nights += left; left = 0; break; }
      take.nights++; left--;
    }

    for (const x of share) legs.push({ cityId: x.city.id, nights: x.nights });
  }

  // The hub always earns one day trip on a trip of five days or more — that's
  // the Lisbon/Sintra shape the spec asks for. A SECOND one goes to another
  // base only when that base genuinely can't fill its own days, so we never
  // add the transit day section 34 warns about just because we can.
  const takeTrip = (leg: TripShapeLeg) =>
    dayTrips.find(
      (t) => !legs.some((l) => l.dayTrip === t.id)
        && (t.dayTripFrom ?? dest.hubCityId) === leg.cityId
        && (t.transitFromHubMin ?? 60) <= 135,
    );

  if (days >= 5 && legs[0].nights >= 2) {
    const t = takeTrip(legs[0]);
    if (t) legs[0].dayTrip = t.id;
  }
  for (const leg of legs.slice(1)) {
    const legDays = leg.nights + 1;
    const starved = placesInCity(leg.cityId).length < legDays * 4;
    if (!starved || leg.nights < 2) continue;
    const t = takeTrip(leg);
    if (t) leg.dayTrip = t.id;
  }

  // A long stay in a base that can't fill its own days earns a second day out
  // rather than three blank afternoons. Only when it is genuinely short.
  for (const leg of legs) {
    if (leg.extraDayTrip || leg.nights < 4) continue;
    if (placesInCity(leg.cityId).length >= (leg.nights + 1) * 3.5) continue;
    const t = takeTrip(leg);
    if (t) leg.extraDayTrip = t.id;
  }

  return returnLegHome(legs, dest, keep);
}

/**
 * You fly home from where you flew in. A plan that has you waking up four
 * hours from your departure airport on the morning of a transatlantic flight
 * is wrong, however good the last two days were.
 *
 * This is the one correction a real traveller had to make by hand: the plan
 * ended with two nights in Porto and a 6:30am flight out of Lisbon. The fix is
 * the same one she made — give the last night back to the hub.
 */
function returnLegHome(legs: TripShapeLeg[], dest: Destination, allowed?: (c: City) => boolean): TripShapeLeg[] {
  if (dest.arrival !== "fly" || legs.length < 2) return legs;
  // She ruled the hub out. A night there to make the flight easier is still a
  // night there: better a 6am start than a bed she said she didn't want.
  if (allowed && !allowed(cityById(dest.hubCityId))) return legs;
  const last = legs[legs.length - 1];
  if (last.cityId === dest.hubCityId) return legs;

  const back = interCity(cityById(last.cityId), cityById(dest.hubCityId));
  // Under two hours you can leave after breakfast and still make an afternoon
  // flight. Beyond that, the last night belongs next to the airport.
  if (back.minutes <= 120) return legs;
  const hubLeg = legs.find((l) => l.cityId === dest.hubCityId);

  /*
   * First choice: end near the airport by ORDER, not by an extra bed.
   *
   * Split, Hvar, Dubrovnik and then one night back in Split read as "Dubrovnik
   * 1 night, then Split 1 night" -- two one-night stays at the end of an
   * eleven-day trip, which is what a person would never book. Visiting the
   * far base first and the near one last is what they would do: Split, then
   * Dubrovnik, then Hvar, and the ferry back to Split is under the two hours
   * that need no return night at all.
   */
  if (hubLeg && legs.length >= 3 && legs[0] === hubLeg) {
    const away = legs.slice(1).filter((l) => l.cityId !== dest.hubCityId);
    const far = [...away].sort((a, b) =>
      interCity(cityById(b.cityId), cityById(dest.hubCityId)).minutes
      - interCity(cityById(a.cityId), cityById(dest.hubCityId)).minutes);
    const nearest = far[far.length - 1];
    if (nearest && interCity(cityById(nearest.cityId), cityById(dest.hubCityId)).minutes <= 120) {
      return [hubLeg, ...far];
    }
  }

  /*
   * Otherwise a night at the hub, taken from the base that can best spare it:
   * the final base when it keeps two nights, then the hub's own opening stay
   * (same city, same total), then the longest stay with three or more.
   * Never a night that leaves a base with one: a one-night stay is a hotel
   * you see in the dark twice.
   */
  const donor = last.nights >= 3
    ? last
    : hubLeg && hubLeg.nights >= 2
      ? hubLeg
      : [...legs].sort((a, b) => b.nights - a.nights).find((l) => l.nights >= 3);
  if (!donor) return legs;
  donor.nights -= 1;
  return [...legs, { cityId: dest.hubCityId, nights: 1, returnLeg: true, dayTrip: undefined, extraDayTrip: undefined }]
    .filter((l) => l.nights > 0 || l === hubLeg);
}

interface DaySpec {
  index: number;
  date: string;
  cityId: string;       // where the day happens
  baseCityId: string;   // where you sleep
  kind: "arrival" | "full" | "daytrip" | "transit" | "departure";
  fromCityId?: string;
}

export function daySpecs(shape: TripShapeLeg[], days: number, startDate: string): DaySpec[] {
  const specs: DaySpec[] = [];
  let day = 1;
  shape.forEach((leg, li) => {
    // Every leg but the last gets its own nights; the last absorbs the
    // remainder, including the departure day. Handing ALL remaining days to
    // leg two meant a third leg got none of them, so the return-to-hub night
    // existed in the shape and never appeared in the itinerary.
    const legDays = li === shape.length - 1 ? days - specs.length : leg.nights;
    for (let i = 0; i < legDays && day <= days; i++) {
      const isFirstOfLeg = i === 0;
      const kind: DaySpec["kind"] =
        day === 1 ? "arrival"
        : day === days ? "departure"
        : isFirstOfLeg && li > 0 ? "transit"
        : "full";
      specs.push({
        index: day,
        date: addDays(startDate, day - 1),
        cityId: leg.cityId,
        baseCityId: leg.cityId,
        kind,
        fromCityId: kind === "transit" ? shape[li - 1].cityId : undefined,
      });
      day++;
    }
  });
  // Place the day trips on the best candidate days inside their leg: "full"
  // days, never the first or last day of the trip.
  for (const leg of shape) {
    // Never the day after landing: that day is for adjusting, not for a 6am
    // start. Prefer later full days, and space two day trips apart.
    for (const tripId of [leg.dayTrip, leg.extraDayTrip]) {
      if (!tripId) continue;
      const full = specs.filter(
        (s) => s.baseCityId === leg.cityId && s.kind === "full" && s.index > 2);
      const candidate = full[1] ?? full[0]
        ?? specs.find((s) => s.baseCityId === leg.cityId && s.kind === "full");
      if (candidate) { candidate.kind = "daytrip"; candidate.cityId = tripId; }
    }
  }
  return specs;
}

// --- day construction ------------------------------------------------------

const isOpen = isOpenFor;

interface Ctx {
  brief: Brief;
  profile: TravelerProfile;
  bank: ReasonBank;
  used: Set<string>;
  costPressure: boolean;
}

class DayBuilder {
  items: ItineraryItem[] = [];
  cursor: number;
  private last?: { lat: number; lng: number };

  constructor(start: number, private weekday: number, private ctx: Ctx) {
    this.cursor = start;
  }

  here() { return this.last; }

  /** Try candidates in order until one actually fits the clock and the
   *  opening hours. A single closed venue must not abort the whole block. */
  tryPlace(
    pool: Candidate[],
    opts: PickOpts & { notBefore?: number; depth?: number; asMeal?: boolean; allowRepeat?: boolean; mustEndBy?: number },
  ): boolean {
    // allowRepeat means "a place from earlier in the trip is acceptable", never
    // "the same place twice today". Without this the market you spent the
    // morning in came back as the lunch booking three hours later.
    const today = new Set(this.items.map((i) => i.placeId).filter(Boolean) as string[]);
    for (const p of ranked(pool, this.ctx, opts, this.here()).slice(0, opts.depth ?? 8)) {
      if (today.has(p.id)) continue;
      if (this.place(p, opts.slot, opts.notBefore, opts.asMeal, opts.mustEndBy)) return true;
    }
    return false;
  }

  /** Insert an explicit transit item when the hop is long enough to matter. */
  private moveTo(p: { lat: number; lng: number }) {
    if (!this.last) { this.last = p; return; }
    const mins = travelMinutes(this.last, p);
    if (mins >= 12) {
      this.items.push({
        id: uid("t"), type: "transit", name: "Across town", start: toClock(this.cursor),
        durationMin: mins, reason: "Metro or tram — budgeted so the next thing isn't a rush.",
        costUsd: 2, tags: [], lat: p.lat, lng: p.lng,
      });
    }
    this.cursor += mins;
    this.last = p;
  }

  place(p: Place, slot: Slot, notBefore?: number, asMeal = false, mustEndBy?: number): boolean {
    const probe = Math.max(this.cursor, notBefore ?? 0);
    const saved = this.cursor;
    const savedLast = this.last;   // moveTo mutates this; a rejected candidate
    this.cursor = probe;           // must not move where we think we are.
    const before = this.items.length;
    this.moveTo(p);
    if (p.opens) this.cursor = Math.max(this.cursor, toMin(p.opens));
    // Hard stop at the end of the day. Without this the cursor rolls past
    // midnight and toClock silently wraps it to 00:xx.
    const hardEnd = Math.min(
      mustEndBy ?? Infinity,
      p.kind === "meal" || p.kind === "drink" ? 1410 : 1350,
    );
    // A place called "at sunset" has no business at half past eleven. The slot
    // score only nudged this; for evening-only places it has to be a rule.
    // The rule itself is in lib/hours.ts, because the edit path needs it too.
    const tooEarly = !fitsTimeOfDay(p, this.cursor);
    if (tooEarly || this.cursor + p.durationMin > hardEnd || !isOpen(p, this.cursor, this.weekday)) {
      this.items.length = before;
      this.cursor = saved;
      this.last = savedLast;
      return false;
    }
    this.items.push({
      id: uid("i"),
      type: asMeal || p.kind === "meal" ? "meal" : "activity",
      placeId: p.id,
      name: p.name,
      start: toClock(this.cursor),
      durationMin: p.durationMin,
      reason: p.kind === "meal" && p.tags.includes("food")
        ? this.ctx.bank.forMeal(slot)
        : this.ctx.bank.forPlace(p, slot, this.ctx.brief),
      costUsd: p.costUsd,
      tags: p.tags,
      lat: p.lat, lng: p.lng,
      neighborhood: p.neighborhood,
      note: p.note,
    });
    this.cursor += p.durationMin;
    this.ctx.used.add(p.id);
    return true;
  }

  downtime(minutes: number) {
    /*
     * A day ends at the end of the day.
     *
     * This was emitted at whatever the cursor happened to be and never
     * clamped, so a single evening-opening venue could push it to 21:00 and
     * the card read "10:30 PM to 1:45 AM. Free time." 464 trips in 8,400 had a
     * block running past midnight. Anything that would spill is trimmed to
     * 23:00, and if there is no room left it is not a rest, so nothing is
     * added.
     */
    const room = Math.max(0, 1380 - this.cursor);
    const mins = Math.min(minutes, room);
    if (mins < 30) return;
    this.items.push({
      id: uid("d"), type: "downtime", name: "Free time",
      start: toClock(this.cursor), durationMin: mins,
      reason: this.ctx.bank.forDowntime(), costUsd: 0, tags: [],
    });
    this.cursor += mins;
  }

  logistics(name: string, minutes: number, reason: string, at?: number, cost = 0) {
    if (at !== undefined) this.cursor = Math.max(this.cursor, at);
    this.items.push({
      id: uid("l"), type: "logistics", name, start: toClock(this.cursor),
      durationMin: minutes, reason, costUsd: cost, tags: [],
    });
    this.cursor += minutes;
  }

  transit(name: string, minutes: number, cost: number, reason: string, at?: number, to?: { lat: number; lng: number }) {
    if (at !== undefined) this.cursor = Math.max(this.cursor, at);
    this.items.push({
      id: uid("x"), type: "transit", name, start: toClock(this.cursor),
      durationMin: minutes, reason, costUsd: cost, tags: [],
      lat: to?.lat, lng: to?.lng,
    });
    this.cursor += minutes;
    if (to) this.last = to;
  }
}

interface PickOpts {
  allowRepeat?: boolean;
  slot: Slot;
  kinds?: Place["kind"][];
  tags?: string[];
  exclude?: (p: Place) => boolean;
  /** Reject anything not explicitly good at this time (used for dinner). */
  strictSlot?: boolean;
  /**
   * Exclude content carrying the signature of a vibe they didn't pick. An open
   * afternoon beats an art museum on a trip they told us was about landscape —
   * section 10 makes that a feature, not a hole. Neutral filler still passes,
   * because a trip made only of its own theme is exhausting.
   */
  excludeForeign?: boolean;
}

/**
 * Rank candidates for one slot. Two adjustments matter here:
 * slot fit, and distance from where you already are — section 9 asks for
 * geographic efficiency, and this is where it's actually enforced.
 */
function ranked(
  pool: Candidate[],
  ctx: Ctx,
  opts: PickOpts,
  from?: { lat: number; lng: number },
): Place[] {
  return pool
    .filter((c) => (opts.allowRepeat || !ctx.used.has(c.place.id))
      && (!opts.kinds || opts.kinds.includes(c.place.kind))
      && (!opts.tags || opts.tags.some((t) => (c.place.tags as string[]).includes(t)))
      && (!opts.exclude || !opts.exclude(c.place))
      && (!opts.strictSlot || c.place.bestTime === opts.slot)
      && (!opts.excludeForeign || !c.foreign))
    .map((c) => {
      let s = c.score;
      if (c.place.bestTime === opts.slot) s += 0.25;
      else if (c.place.bestTime !== "any") s -= 0.15;
      if (from) s -= Math.min(0.3, haversineKm(from, c.place) * 0.022);
      // Under allowRepeat, somewhere they haven't been still wins.
      if (opts.allowRepeat && ctx.used.has(c.place.id)) s -= 0.5;
      return { place: c.place, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.place);
}

function buildDay(spec: DaySpec, pace: Pace, ctx: Ctx): ItineraryDay {
  const weekday = weekdayOf(spec.date);
  const city = cityById(spec.cityId);
  const base = cityById(spec.baseCityId);
  const pool = candidatesFor(spec.cityId, ctx.brief, ctx.profile, ctx.costPressure);
  const basePool = spec.cityId === spec.baseCityId
    ? pool
    : candidatesFor(spec.baseCityId, ctx.brief, ctx.profile, ctx.costPressure);

  let budget = PACE_ACTIVITIES[pace];
  const b = new DayBuilder(START_MIN[pace], weekday, ctx);

  const ACTIVITY_KINDS: Place["kind"][] = ["walk", "sight", "museum", "market", "outdoor", "experience"];
  // Only reach for off-brief content when the city has genuinely run out of
  // anything else. "First activity of the day" was too generous a licence: on
  // a two-activity day it meant half the trip could be things they didn't ask for.
  const outOfOnBrief = () => !pool.some((c) => !c.foreign && !ctx.used.has(c.place.id));

  // --- how the day opens, by kind ---
  if (spec.kind === "arrival") {
    budget = 1;
    const dest = destinationById(base.destinationId);
    if (dest.arrival === "drive") {
      b.transit(`Drive to ${base.name}`, 195, 90,
        "No airport, no security, no time zone. Leave after breakfast and you're there for lunch.", 570, base);
    } else {
      b.transit("Land and get into town", 75, 18,
        "Flights from the west coast land early afternoon. Nothing is scheduled against jet lag.", 810);
    }
    b.logistics(`Check in — ${base.base}`, 45, `Where I'd put you: ${base.base}`);
  } else if (spec.kind === "transit" && spec.fromCityId) {
    const from = cityById(spec.fromCityId);
    const leg = interCity(from, city, ctx.profile?.transport);
    /*
     * A short hop is not a lost day. The old fixed penalty assumed every leg
     * ate the same chunk of the day because every leg claimed to be a train:
     * a two-hour flight leaves the afternoon, and the day should be filled.
     */
    budget = Math.max(1, budget - (leg.minutes >= 300 ? 3 : leg.minutes >= 150 ? 2 : 1));
    b.transit(`${legVerb(leg.mode)} ${city.name}`, leg.minutes, leg.usd,
      legReason(leg, city.name), 570, city);
    b.logistics(`Check in — ${base.base}`, 45, `Where I'd put you: ${base.base}`);
  } else if (spec.kind === "daytrip") {
    const how = city.transitMode === "car" ? "Drive to" : "Train to";
    b.transit(`${how} ${city.name}`, city.transitFromHubMin ?? 60, city.transitFromHubUsd ?? 8,
      "Short enough that this stays a day out rather than a second trip.", 540, city);
  } else {
    if (pace !== "busy") b.tryPlace(pool, { slot: "morning", kinds: ["meal"], tags: ["coffee"] });
  }

  // --- morning ---
  const isEdge = spec.kind === "arrival" || spec.kind === "departure";
  const returningHome = spec.kind === "departure"
    && cityById(destinationById(cityById(spec.baseCityId).destinationId).hubCityId).id !== spec.baseCityId;
  const morningTarget = spec.kind === "departure" ? (returningHome ? 0 : 1)
    : spec.kind === "arrival" ? 1
    : Math.max(1, Math.ceil(budget * 0.5));
  const eveningTarget = spec.kind === "departure" ? 0 : 1;
  let placed = 0;

  const openingSlot: Slot = spec.kind === "arrival" ? "afternoon" : "morning";
  const longHaul = spec.kind === "departure" ? (p: Place) => p.durationMin > 90 : undefined;
  for (let i = 0; i < morningTarget && b.cursor < 780; i++) {
    // On-brief first, always. Off-brief content is a last resort for a day
    // that would otherwise be empty, not a daily allowance.
    const opts = { slot: openingSlot, kinds: ACTIVITY_KINDS, exclude: longHaul };
    if (!b.tryPlace(pool, { ...opts, excludeForeign: true })
      && !(outOfOnBrief() && b.tryPlace(pool, opts))) break;
    placed++;
  }

  // --- lunch ---
  if (spec.kind !== "arrival") {
    const lunchOpts = {
      slot: "midday" as Slot, kinds: ["meal", "market"] as Place["kind"][],
      notBefore: 765, mustEndBy: 960, asMeal: true,
      // A coffee shop is not lunch, however hungry the repeat pass is.
      exclude: (p: Place) => p.tags.includes("coffee") && !p.tags.includes("food"),
    };
    if (!b.tryPlace(pool, lunchOpts)
      && !b.tryPlace(basePool, lunchOpts)
      && !b.tryPlace(pool, { ...lunchOpts, allowRepeat: true })) {
      b.tryPlace(basePool, { ...lunchOpts, allowRepeat: true });
    }
  }

  // --- downtime: a feature, not a gap (section 10) ---
  if (spec.kind === "full" || spec.kind === "arrival" || spec.kind === "transit") {
    b.downtime(DOWNTIME_MIN[pace]);
  } else if (spec.kind === "daytrip" && pace !== "busy") {
    // A day out is still a day off. Shorter block, because the train bookends
    // it, but section 10 applies here too.
    b.downtime(pace === "mixed" ? 90 : 120);
  }

  // --- afternoon ---
  const afternoonTarget = spec.kind === "departure" ? 0 : Math.max(0, budget - placed - eveningTarget);
  for (let i = 0; i < afternoonTarget && b.cursor < 1110; i++) {
    const opts = { slot: "afternoon" as Slot, kinds: ACTIVITY_KINDS };
    if (!b.tryPlace(pool, { ...opts, excludeForeign: true })
      && !(outOfOnBrief() && b.tryPlace(pool, opts))) break;
    placed++;
  }

  if (spec.kind === "daytrip") {
    b.transit(`${city.transitMode === "car" ? "Drive" : "Train"} back to ${base.name}`,
      city.transitFromHubMin ?? 60, city.transitFromHubUsd ?? 8,
      "Back in time to eat where you're staying rather than at a station.", Math.max(b.cursor, 1050), base);
  }

  if (spec.kind === "departure") {
    // You have to get back to where you flew in. On a two-base trip that is
    // the day, not a footnote to it.
    const hub = cityById(destinationById(cityById(spec.baseCityId).destinationId).hubCityId);
    if (hub.id !== spec.baseCityId) {
      const back = interCity(base, hub);
      b.transit(`${back.mode === "car" ? "Drive" : "Train"} back to ${hub.name}`,
        back.minutes, back.usd,
        `You're ${Math.round(back.km)}km from the airport, so this is the morning. I haven't scheduled anything against it.`,
        Math.max(b.cursor, 540), hub);
    }
    b.logistics("Bags, then to the airport", 120,
      "Left deliberately loose. An airport morning is not a morning to schedule against.",
      Math.max(b.cursor, 870), 22);
    return { index: spec.index, date: spec.date, cityId: spec.cityId,
      theme: themeFor(spec, city.name, b.items), items: fillGaps(b.items, ctx.bank) };
  }

  // --- evening ---
  // Order matters here. A 9pm stargazing stop placed before dinner pushes
  // dinner past every kitchen's closing time, and the day ends with no meal.
  // So: something before dinner if it fits, dinner, then anything late.
  const eveningPool = spec.kind === "daytrip" ? basePool : pool;
  const eveningKinds: Place["kind"][] = ["drink", "sight", "experience", "walk", "outdoor"];

  for (let i = 0; i < eveningTarget; i++) {
    if (!b.tryPlace(eveningPool, {
      slot: "evening", kinds: eveningKinds, notBefore: 1080, mustEndBy: 1200,
      excludeForeign: true,
    })) break;
  }

  const dinnerOpts: PickOpts & { notBefore: number } = {
    slot: "evening", kinds: ["meal"], strictSlot: true, notBefore: 1200,
    exclude: (p) => p.tags.includes("coffee") || p.durationMin < 45,
  };
  // Relax "unused" before relaxing "is actually a dinner place" — and never
  // relax the second one, because a packed lunch at ten o'clock is not dinner.
  // Then try again earlier: plenty of kitchens shut at nine, and holding out
  // for an eight o'clock table means no dinner at all in a small town.
  const dinnerAttempts = [
    { pool: eveningPool, o: dinnerOpts },
    { pool: basePool, o: dinnerOpts },
    { pool: eveningPool, o: { ...dinnerOpts, notBefore: 1110 } },
    { pool: basePool, o: { ...dinnerOpts, notBefore: 1110 } },
    { pool: eveningPool, o: { ...dinnerOpts, notBefore: 1110, allowRepeat: true } },
    { pool: basePool, o: { ...dinnerOpts, notBefore: 1110, allowRepeat: true } },
  ];
  for (const a of dinnerAttempts) if (b.tryPlace(a.pool, a.o)) break;

  // Anything that only happens after dark.
  b.tryPlace(eveningPool, {
    slot: "evening", kinds: ["outdoor", "drink", "experience"], notBefore: 1260,
    excludeForeign: true,
  });

  b.items.sort((x, y) => toMin(x.start) - toMin(y.start));
  return { index: spec.index, date: spec.date, cityId: spec.cityId,
    theme: themeFor(spec, city.name, b.items), items: fillGaps(b.items, ctx.bank) };
}

/**
 * Section 10: an unscheduled hour must read as a decision, not as an itinerary
 * that failed to load. Any real gap becomes an explicit block.
 */
function fillGaps(items: ItineraryItem[], bank: ReasonBank): ItineraryItem[] {
  const out: ItineraryItem[] = [];
  for (let i = 0; i < items.length; i++) {
    out.push(items[i]);
    const next = items[i + 1];
    if (!next) continue;
    const end = toMin(items[i].start) + items[i].durationMin;
    const gap = toMin(next.start) - end;
    /*
     * Never a Free time block next to a Free time block.
     *
     * The explicit downtime the pace asks for, and the gap this function
     * fills, are the same thing arriving by two routes, so 90% of trips
     * rendered two "Free time" cards back to back with different prose under
     * them. If either side of the gap is already downtime, widen it instead of
     * adding a second card.
     */
    if (items[i].type === "downtime") {
      if (gap > 0) items[i] = { ...items[i], durationMin: items[i].durationMin + gap };
      out[out.length - 1] = items[i];
      continue;
    }
    if (gap >= 45 && next.type !== "logistics" && next.type !== "downtime") {
      out.push({
        id: uid("d"), type: "downtime", name: "Free time",
        start: toClock(end), durationMin: gap, reason: bank.forDowntime(),
        costUsd: 0, tags: [],
      });
    }
  }
  return out;
}

/**
 * A day with nothing in it is a data gap showing through, not a rest day.
 * Say so rather than rendering an empty column.
 */
function guardEmpty(day: ItineraryDay, cityName: string, bank: ReasonBank): ItineraryDay {
  const real = day.items.filter((i) => i.type === "activity" || i.type === "meal").length;
  // Arrival and departure days legitimately hold only transit and logistics —
  // replacing those with "nothing scheduled" loses the flight.
  const structural = day.items.filter((i) => i.type === "logistics" || i.type === "transit").length;
  if (real > 0 || structural > 0) return day;
  return {
    ...day,
    theme: `A day off in ${cityName}`,
    items: [
      {
        id: uid("d"), type: "downtime", name: "Nothing scheduled",
        start: "10:00", durationMin: 600,
        reason: `I'd rather give you an open day than send you somewhere I don't rate. ${cityName} rewards wandering — or tell me what you want and I'll fill it.`,
        costUsd: 0, tags: [],
      },
    ],
  };
}

function themeFor(spec: DaySpec, cityName: string, items: ItineraryItem[]): string {
  if (spec.kind === "arrival") return `Land in ${cityName}, do nothing much`;
  if (spec.kind === "departure") return "Slow morning, then home";
  if (spec.kind === "transit") return `Move to ${cityName}`;
  if (spec.kind === "daytrip") return `Out to ${cityName}`;
  const anchor = items.find((i) => i.type === "activity");
  const hood = anchor?.neighborhood;
  return hood ? `${cityName}: ${hood} and around` : cityName;
}

// --- assembly --------------------------------------------------------------

export interface PlanOptions {
  today?: Date;
  startDate?: string;
  /*
   * A shape decided by the caller, used instead of building one.
   *
   * `extend_stay` used to replan and then reach into the returned trip to move
   * a night from one leg to another — after the itinerary had already been
   * built from the shape it was replacing. So "an extra night in Provence"
   * charged for two Provence nights, listed two in the bookings, and gave her
   * a fifth day in Paris and still one day in Provence. Eleven destinations
   * of fifteen. The night has to be moved before the days are built, not
   * after.
   */
  shape?: TripShapeLeg[];
}

export function planTrip(
  brief: Brief,
  rec: Recommendation,
  profile: TravelerProfile,
  opts: PlanOptions = {},
): Trip {
  const dest = destinationById(rec.destinationId);
  // Not effectiveDays: when she gave a range, the trip is as long as this
  // destination can actually carry inside it. See fitDays.
  const days = Math.max(3, fitDays(brief, dest));
  const pace = inferPace(brief);
  // Their real dates when they gave us any. A long-haul flight lands the next
  // day, so day one of the itinerary is the arrival, not the departure — the
  // difference between a plan that matches their ticket and one that's a day
  // out for its whole length.
  const stated = brief.dates?.start;
  const longHaul = stated
    ? haversineKm(brief.origin ?? SEEDED_ORIGIN, cityById(dest.hubCityId)) > 5000
      && dest.arrival === "fly"
    : false;
  /*
   * A trip built around a dated event starts when that event says it does.
   *
   * "i wanna plan a trip to see the solar eclipse next year in egypt" was
   * pitched with the right date in the prose — the total eclipse of 2 August
   * 2027 — and then planned starting 24 October of this year, because nothing
   * carried the date out of the sentence and the planner fell back to its
   * default of a few weeks from now. The itinerary missed the only thing she
   * asked for by twenty-one months, and said so in its own opening paragraph.
   *
   * Dates she stated outright still win: a booked flight beats an inference.
   * The event is placed a little before the middle of the trip, so there is
   * room to arrive, and room afterwards rather than a flight home hours later.
   */
  const anchored = !stated && brief.anchorDate
    ? addDaysIso(brief.anchorDate, -Math.min(days - 1, Math.floor((days - 1) / 2)))
    : undefined;
  /*
   * Her month, when she gave one and no dates.
   *
   * Nothing read brief.month, so "9 days in march" was planned for 24 October
   * — 45 days out, next Saturday — and then printed real weekdays and enforced
   * opening hours against them, which makes a plan that is wrong about the
   * season look precise. The month she said beats our default; her actual
   * dates still beat the month.
   */
  const inMonth = !stated && !anchored && brief.month
    ? startOfStatedMonth(brief.month, opts.today, days)
    : undefined;
  const startDate = opts.startDate
    ?? anchored
    ?? (stated ? (longHaul ? addDaysIso(stated, 1) : stated) : (inMonth ?? defaultStartDate(opts.today)));

  /*
   * If we picked the day, say which day and why.
   *
   * The plan is dated to the day: every card carries a weekday, and closedDays
   * is enforced against it. Presenting a date we invented with that much
   * precision, silently, is the part that misleads — not the inventing.
   */
  const dateNote = opts.startDate || stated || anchored
    ? undefined
    : inMonth
      ? `You said ${brief.month} but not which days, so I've dated this from ${prettyDate(startDate)}. `
        + `The weekdays and opening hours below are real for those dates — give me your actual ones and I'll re-cut it.`
      : `You haven't given me dates, so I've dated this from ${prettyDate(startDate)} to make the weekdays `
        + `and opening hours below mean something. Tell me when you're actually going and I'll re-cut it.`;

  const shape = opts.shape ?? buildShape(dest.id, days, brief, profile);

  /*
   * If the only trip we can build goes somewhere she ruled out, say so.
   *
   * buildShape drops the exclusion rather than the destination when honouring
   * it would leave nowhere to sleep — "a trip with the wrong base beats no
   * trip". That is a defensible call and it was made in silence, which is the
   * part that isn't: she ruled out Copenhagen and got eight nights there with
   * nothing acknowledging it. If we override her, she hears it from us.
   */
  const overridden = [...new Set(shape.flatMap((l) =>
    [l.cityId, ...(l.dayTrip ? [l.dayTrip] : []), ...(l.extraDayTrip ? [l.extraDayTrip] : [])]))]
    .map((id) => cityById(id).name)
    .filter((name) => isRuledOut(name, brief.avoidPlaces ?? []));
  const overrideNote = overridden.length
    ? `You said not ${overridden.join(" or ")}, and I've put ${overridden.length === 1 ? "it" : "them"} `
      + `in anyway — everything else here is reached from ${overridden.length === 1 ? "there" : "those"}, `
      + `and a trip built around avoiding ${overridden.length === 1 ? "it" : "them"} wouldn't be this trip. `
      + `Say the word and I'll take you somewhere else entirely instead.`
    : undefined;
  const specs = daySpecs(shape, days, startDate);

  const build = (costPressure: boolean) => {
    const ctx: Ctx = { brief, profile, bank: new ReasonBank(), used: new Set(), costPressure };
    const itinerary = specs.map((s) =>
      guardEmpty(buildDay(s, pace, ctx), cityById(s.cityId).name, ctx.bank));
    const breakdown = costBreakdown(dest.id, shape, itinerary, costPressure, brief.origin);
    const estimateUsd = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return { itinerary, breakdown, estimateUsd };
  };

  // First pass on merit. If that lands over budget, re-plan with cost pressure
  // rather than quietly ignoring the number they gave.
  let out = build(false);
  let trimmed = false;
  if (brief.budgetUsd !== undefined && out.estimateUsd > brief.budgetUsd * 1.02) {
    const cheaper = build(true);
    if (cheaper.estimateUsd < out.estimateUsd) { out = cheaper; trimmed = true; }
  }

  const shortfall = brief.budgetUsd !== undefined
    ? Math.max(0, out.estimateUsd - brief.budgetUsd)
    : 0;

  // Did the destination actually sustain the pace they asked for?
  const target = PACE_ACTIVITIES[pace];
  const middle = out.itinerary.filter((d) => d.index !== 1 && d.index !== out.itinerary.length);
  const short = middle.filter((d) => d.items.filter((i) => i.type === "activity").length < target - 1);
  const paceShortfall = short.length > middle.length / 2
    ? `I've given you about ${(() => { const n = Math.max(1, Math.round(middle.reduce((s, d) => s + d.items.filter((i) => i.type === "activity").length, 0) / Math.max(1, middle.length))); return n === 1 ? "one thing" : `${n} things`; })()} a day. More than that here means padding the trip with stops I wouldn't otherwise send you to.`
    : undefined;

  return {
    id: uid("trip"),
    concept: {
      destinationId: dest.id,
      days,
      startDate,
      headline: "",
      vibe: "",
      why: "",
      shape,
      estimateUsd: out.estimateUsd,
      breakdown: out.breakdown,
      trimmedForBudget: trimmed,
      budgetShortfallUsd: shortfall,
      // Not "is there a budget" — whose it is. `cheaper` writes a target of its
      // own to the brief and marks it, and this line used to re-assert it as
      // hers on the very next replan.
      budgetStated: brief.budgetUsd !== undefined && !brief.budgetIsOurs && !brief.budgetInferred,
      paceShortfall,
      dateNote,
      overrideNote,
      // Her refusals that map to no tag reach no deterministic check. Said
      // rather than silently dropped — see unenforcedNote.
      unenforcedNote: unenforcedNote(brief),
      origin: brief.origin,
      caveat: dest.caveat,
    },
    days: out.itinerary,
    passedOn: passedOnIn(shape.flatMap((l) => [l.cityId, ...(l.dayTrip ? [l.dayTrip] : [])])),
    bookings: mockBookings(dest.id, shape, out.itinerary, startDate, brief.origin, trimmed),
  };
}

export function costBreakdown(
  destinationId: string, shape: TripShapeLeg[], days: ItineraryDay[], simpleRooms = false,
  origin?: Origin | null,
) {
  const dest = destinationById(destinationId);
  const lodging = lodgingUsd(shape, simpleRooms);
  let transport = 0, activities = 0, food = 0;
  for (const d of days) {
    for (const i of d.items) {
      if (i.type === "transit" || i.type === "logistics") transport += i.costUsd;
      else if (i.type === "meal") food += i.costUsd;
      else activities += i.costUsd;
    }
  }
  // Meals and incidentals the itinerary doesn't name explicitly.
  food += days.length * 22;
  return { flights: flightFor(dest, origin), lodging, transport, activities, food };
}

export function mockBookings(
  destinationId: string, shape: TripShapeLeg[], days: ItineraryDay[], startDate: string,
  origin?: Origin | null, simpleRooms = false,
): MockBooking[] {
  const dest = destinationById(destinationId);
  const out: MockBooking[] = [];

  const air = flightFor(dest, origin);

  // Already in the region. A $0 "SEO → SEO" line item is worse than no line.
  if (air === 0 && dest.arrival !== "drive") {
    out.push({
      id: uid("bk"), kind: "flight",
      label: `No flight needed`,
      detail: `${cityById(dest.hubCityId).name} is a train or a short drive from you`,
      date: startDate, priceUsd: 0,
      cancellation: "Nothing to cancel",
      why: "You're already in the region, so the airfare that usually dominates this budget just isn't a cost here.",
      added: false,
    });
  } else out.push(dest.arrival === "drive"
    ? {
        id: uid("bk"), kind: "flight",
        label: "Fuel and tolls",
        detail: `Round trip by car, about ${Math.round(195 / 60)} hours each way`,
        date: startDate, priceUsd: air,
        cancellation: "Nothing to cancel",
        why: "There's no airport worth using for this one. Driving is faster door to door and you'll want the car anyway.",
        added: false,
      }
    : {
        id: uid("bk"), kind: "flight",
        label: `${origin?.label ?? SEEDED_ORIGIN.label} → ${cityById(dest.hubCityId).name}`,
        detail: "Round trip, one stop, economy",
        date: startDate, priceUsd: air,
        cancellation: "Refundable within 24 hours of booking",
        why: "Cheapest itinerary that still lands in the early afternoon rather than at midnight.",
        added: false,
      });

  let cursor = startDate;
  shape.forEach((leg) => {
    const c = cityById(leg.cityId);
    out.push({
      id: uid("bk"), kind: "hotel",
      label: `${leg.nights} nights in ${c.name}`,
      detail: c.base, date: cursor,
      // Same rate the Estimate card's Hotels row uses. See lib/lodging.ts.
      priceUsd: Math.round(leg.nights * nightlyUsdFor(leg, simpleRooms)),
      cancellation: "Free cancellation until 48 hours before check-in",
      why: `Chosen for the neighborhood over the room — ${c.base.toLowerCase()}`,
      added: false,
    });
    cursor = addDays(cursor, leg.nights);
  });

  for (const d of days) {
    for (const i of d.items) {
      if (i.type === "transit" && /^(Train|Drive) to/.test(i.name) && i.costUsd >= 15) {
        out.push({
          id: uid("bk"), kind: "train", label: i.name,
          // floor, not round: Math.round turned a 170-minute train into "3h 50m".
          detail: `${d.date} · ${i.start} · ${Math.floor(i.durationMin / 60)}h ${i.durationMin % 60}m`,
          date: d.date, priceUsd: i.costUsd,
          cancellation: "Exchangeable up to 1 hour before departure",
          why: i.reason, added: false,
        });
      }
    }
  }

  const paid = days.flatMap((d) => d.items.filter((i) => i.type === "activity" && i.costUsd >= 15).map((i) => ({ d, i })));
  for (const { d, i } of paid.slice(0, 4)) {
    out.push({
      id: uid("bk"), kind: "activity", label: i.name,
      detail: `${d.date} · ${i.start}`, date: d.date, priceUsd: i.costUsd,
      cancellation: "Free cancellation up to 24 hours before",
      why: i.reason, added: false,
    });
  }
  return out;
}
