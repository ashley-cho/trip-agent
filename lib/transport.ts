/**
 * How you actually get from one base to the next.
 *
 * There was one line for this, and it said "train":
 *
 *   return { minutes: km / 1.55 + 25, usd: km * 0.115, mode: "train", km };
 *
 * That is the fallback for any city pair not in INTERCITY, which is a
 * hand-written table of eight entries covering only the seeded destinations.
 * So every leg of every researched trip became a train at 93 km/h. Edmonton
 * to Yellowknife is 983 km of subarctic bush with no railway: the app sold an
 * 11-hour train, twice, in the bookings panel. The same fabrication put a
 * metro and a tram into Reykjavík.
 *
 * It also ate two whole days. A 665-minute leg leaving at 09:30 lands at
 * 20:35, so the planner found no room for anything and produced "Move to
 * Yellowknife — 0 things". The empty transit day was never its own bug.
 *
 * Three sources, in this order, and the order is the point:
 *
 *   1. The seeded table. Real, checked, and it wins.
 *   2. What the traveller told us they want to use.
 *   3. Geography.
 *
 * Nothing here pretends to be timetabled. `known` says which legs came from
 * real data and which were reasoned from a distance, and the copy downstream
 * is allowed to say so.
 */
import type { City } from "@/lib/types";
import { haversineKm } from "@/lib/geo";
import { INTERCITY } from "@/data/destinations";

export type TransportMode = "fly" | "train" | "car" | "bus" | "ferry";

export interface Leg {
  minutes: number;
  usd: number;
  mode: TransportMode;
  km: number;
  /** From the seeded table, rather than reasoned from the distance. */
  known: boolean;
}

/**
 * Past this, on the ground, it stops being a journey and becomes the trip.
 * Edmonton to Yellowknife is 983 km. Lisbon to Porto is 274.
 */
const TOO_FAR_TO_DRIVE = 700;
/** Below this, getting to an airport costs more than the flight saves. */
const TOO_CLOSE_TO_FLY = 250;

/** Door to door, including the airport, which is most of a short flight. */
const flightMinutes = (km: number) => Math.round(90 + km / 13);
const driveMinutes = (km: number) => Math.round(km / 1.25 + 20);
/** Rail where it exists is roughly motorway speed on the short hops that have it. */
const railMinutes = (km: number) => Math.round(km / 1.5 + 25);

/** Is this mode a straight-faced answer over this distance? */
export function plausible(mode: TransportMode, km: number): boolean {
  switch (mode) {
    case "fly": return km >= TOO_CLOSE_TO_FLY;
    case "car": return km <= 900;
    case "train": return km <= TOO_FAR_TO_DRIVE;
    case "bus": return km <= 500;
    // A ferry is a fact about the water, not about the distance. We only ever
    // believe one if the table told us.
    case "ferry": return false;
  }
}

/**
 * `prefer` is what they said they want to travel by. It wins wherever it is
 * plausible, which is the whole reason for asking: someone who would rather
 * drive should not be put on a plane because the algorithm likes planes.
 */
export function resolveLeg(a: City, b: City, prefer?: TransportMode): Leg {
  const km = Math.round(haversineKm(a, b));
  const known = INTERCITY[`${a.id}>${b.id}`] ?? INTERCITY[`${b.id}>${a.id}`];
  // Real data beats a preference: if we know the Lisbon-Porto train, saying
  // "I'd rather drive" should change the drive, not invent a different train.
  if (known) return { ...known, km, known: true };

  if (prefer && plausible(prefer, km)) return { ...byMode(prefer, km), km, known: false };

  const mode: TransportMode = km > TOO_FAR_TO_DRIVE ? "fly" : "car";
  return { ...byMode(mode, km), km, known: false };
}

function byMode(mode: TransportMode, km: number): { minutes: number; usd: number; mode: TransportMode } {
  switch (mode) {
    case "fly":   return { minutes: flightMinutes(km), usd: Math.round(70 + km * 0.09), mode };
    case "train": return { minutes: railMinutes(km), usd: Math.round(km * 0.115), mode };
    case "bus":   return { minutes: Math.round(km / 1.0 + 30), usd: Math.round(km * 0.06), mode };
    case "ferry": return { minutes: Math.round(km / 0.6 + 45), usd: Math.round(km * 0.15), mode };
    case "car":   return { minutes: driveMinutes(km), usd: Math.round(km * 0.19), mode };
  }
}

/** "Fly to Yellowknife". Never "Train to" a place with no railway. */
export function legVerb(mode: TransportMode): string {
  return { fly: "Fly to", train: "Train to", car: "Drive to", bus: "Bus to", ferry: "Ferry to" }[mode];
}

/**
 * What we say about it.
 *
 * A checked leg gets the confident sentence it has earned. An inferred one
 * says the hours and admits it hasn't been looked up, which is the same
 * standard the rest of the itinerary already holds itself to.
 */
export function legReason(leg: Leg, toName: string): string {
  const hours = leg.minutes >= 90
    ? `About ${Math.round(leg.minutes / 60)} hours`
    : `About ${leg.minutes} minutes`;
  if (leg.known) return `Mid-morning, so you don't lose the evening to travelling. ${hours}.`;
  return leg.mode === "fly"
    ? `${hours} door to door. I haven't checked today's schedules, so confirm before you count on the afternoon.`
    : `${hours} on the road to ${toName}. Worked out from the distance rather than a timetable.`;
}

/**
 * Is there a real choice to make on this trip, and what are the options?
 *
 * Only worth asking when we are guessing. A leg from the seeded table is
 * checked, and a single-base trip has no leg at all: asking either time is a
 * question that buys the traveller nothing, and every question spent is a
 * question she notices.
 *
 * `undefined` means don't ask.
 */
export function transportChoice(
  legs: { fromId: string; toId: string; km: number; known: boolean }[],
): { options: TransportMode[]; km: number } | undefined {
  const guessed = legs.filter((l) => !l.known);
  if (!guessed.length) return undefined;
  // The longest guessed leg is the one that decides the shape of the trip, so
  // that is the one worth asking about.
  const worst = guessed.reduce((a, b) => (b.km > a.km ? b : a));
  const options = (["fly", "train", "car", "bus"] as const).filter((m) => plausible(m, worst.km));
  return options.length > 1 ? { options: [...options], km: worst.km } : undefined;
}

/** How the option reads on a chip. */
export const MODE_LABEL: Record<TransportMode, string> = {
  fly: "Fly", train: "Train", car: "Drive", bus: "Bus", ferry: "Ferry",
};

/**
 * The legs of a finished trip, as `transportChoice` wants them.
 *
 * Reads the shape rather than the itinerary, because the shape is where the
 * base changes are and the itinerary is where they have already been turned
 * into a time of day.
 */
export function legsOfShape(
  shape: { cityId: string }[],
  city: (id: string) => City,
): { fromId: string; toId: string; km: number; known: boolean }[] {
  const out = [];
  for (let i = 1; i < shape.length; i++) {
    const from = city(shape[i - 1].cityId);
    const to = city(shape[i].cityId);
    if (from.id === to.id) continue;
    const leg = resolveLeg(from, to);
    out.push({ fromId: from.id, toId: to.id, km: leg.km, known: leg.known });
  }
  return out;
}
