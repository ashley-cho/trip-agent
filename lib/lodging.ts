import { cityById } from "@/data/destinations";
import type { TripShapeLeg } from "@/lib/types";

/*
 * One place decides what a night costs.
 *
 * There were three. `costBreakdown` discounted the nightly rate when the trip
 * had been trimmed for budget; `mockBookings` charged the full catalogue rate
 * for the same beds; `withStays` overwrote the estimate with a third number.
 * On every destination I measured, the Estimate card's Hotels row and the
 * Bookings list's hotel lines were about 22% apart, on the same screen, on a
 * trip nobody had edited.
 *
 * A price the user is shown twice has to be computed once.
 */

/**
 * A trimmed trip is not staying somewhere cheaper by magic — it's the same
 * city with a plainer room. The discount belongs to the room, not the city.
 */
export const SIMPLE_ROOM_FACTOR = 0.78;

/** What one night on this leg costs, whether it's shown as an estimate or a booking. */
export function nightlyUsdFor(
  leg: TripShapeLeg, simpleRooms: boolean, stayNightlyUsd?: number,
): number {
  // A named property is priced as itself: we know the actual room.
  if (stayNightlyUsd !== undefined) return stayNightlyUsd;
  return cityById(leg.cityId).nightlyUsd * (simpleRooms ? SIMPLE_ROOM_FACTOR : 1);
}

/** What the whole trip's beds cost. */
export function lodgingUsd(
  shape: TripShapeLeg[], simpleRooms: boolean,
  stayNightlyUsd?: (leg: TripShapeLeg) => number | undefined,
): number {
  return Math.round(shape.reduce(
    (sum, l) => sum + l.nights * nightlyUsdFor(l, simpleRooms, stayNightlyUsd?.(l)), 0,
  ));
}
