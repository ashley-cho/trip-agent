import type { Trip, TripShapeLeg } from "@/lib/types";
import { cityById, destinationById } from "@/data/destinations";
import type { Stay } from "@/lib/stays";

/**
 * Outbound links to the places you would actually book this on.
 *
 * Every one of these is a *search* URL built from what the plan already knows:
 * the property name, the city, the real check-in and check-out nights, the
 * coordinates we hold for a place. Nothing here claims a price, an
 * availability or a reservation. The agent's estimates stay estimates; the
 * link is how you go and find out what it really costs.
 *
 * Deliberately deterministic. A model-generated URL is a 404 with confidence.
 */

const q = (s: string) => encodeURIComponent(s.trim());

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Check-in and check-out per leg, walked forward from the start date. */
export function legDates(shape: TripShapeLeg[], startDate: string) {
  const out = new Map<string, { in: string; out: string; nights: number }>();
  let cursor = 0;
  for (const leg of shape) {
    if (leg.nights <= 0) continue;
    const checkin = addDays(startDate, cursor);
    cursor += leg.nights;
    const prev = out.get(leg.cityId);
    // A return leg lands back in the hub; keep both stints rather than
    // overwriting the first one's dates with the last night's.
    out.set(prev ? `${leg.cityId}:return` : leg.cityId, {
      in: checkin,
      out: addDays(startDate, cursor),
      nights: leg.nights,
    });
  }
  return out;
}

export function mapsLink(name: string, lat?: number, lng?: number): string {
  return lat != null && lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${q(name)}`;
}

export function hotelLink(
  name: string, cityName: string, dates?: { in: string; out: string },
): string {
  const search = [name, cityName].map((x) => x.trim()).filter(Boolean).join(", ");
  const p = new URLSearchParams({ ss: search, group_adults: "2", no_rooms: "1" });
  if (dates) { p.set("checkin", dates.in); p.set("checkout", dates.out); }
  return `https://www.booking.com/searchresults.html?${p.toString()}`;
}

/** No property named yet: search the neighbourhood the plan puts you in. */
export function areaHotelLink(cityName: string, dates?: { in: string; out: string }): string {
  return hotelLink("", cityName, dates);
}

export function flightLink(originCity: string, destCity: string, depart: string, back: string): string {
  return `https://www.google.com/travel/flights?q=${q(
    `Flights to ${destCity} from ${originCity} on ${depart} through ${back}`,
  )}`;
}

/** Trains, buses and ferries between two cities, with the real options. */
export function routeLink(fromCity: string, toCity: string): string {
  return `https://www.rome2rio.com/s/${q(fromCity)}/${q(toCity)}`;
}

export interface BookLink {
  label: string;
  href: string;
  note: string;
}

/**
 * The whole trip's outbound links, in the order you'd actually book them:
 * flights first because they set the dates, then a room per base, then the
 * legs between.
 */
export function tripLinks(trip: Trip): BookLink[] {
  const c = trip.concept;
  const dest = destinationById(c.destinationId);
  const dates = legDates(c.shape, c.startDate);
  const stays = new Map((c.stays ?? []).map((s: Stay) => [s.cityId, s]));
  const beds = c.shape.filter((l) => l.nights > 0);
  const links: BookLink[] = [];

  const home = c.origin?.label ?? "your city";
  const lastOut = [...dates.values()].map((d) => d.out).sort().pop();
  if (dest.arrival === "fly" && lastOut) {
    links.push({
      label: `Flights to ${cityById(dest.hubCityId).name}`,
      href: flightLink(home, cityById(dest.hubCityId).name, c.startDate, lastOut),
      note: "Google Flights, your dates already in the search",
    });
  }

  const seen = new Set<string>();
  for (const leg of beds) {
    const key = seen.has(leg.cityId) ? `${leg.cityId}:return` : leg.cityId;
    seen.add(leg.cityId);
    const city = cityById(leg.cityId);
    const d = dates.get(key);
    const stay = stays.get(leg.cityId);
    links.push({
      label: stay ? `${stay.name}, ${city.name}` : `Somewhere to sleep in ${city.name}`,
      href: stay ? hotelLink(stay.name, city.name, d) : areaHotelLink(`${city.name} ${city.base}`, d),
      note: d
        ? `${d.nights} night${d.nights === 1 ? "" : "s"}, ${d.in} to ${d.out}`
        : `${leg.nights} night${leg.nights === 1 ? "" : "s"}`,
    });
  }

  for (let i = 0; i < beds.length - 1; i++) {
    const a = cityById(beds[i].cityId).name;
    const b = cityById(beds[i + 1].cityId).name;
    if (a === b) continue;
    links.push({
      label: `${a} to ${b}`,
      href: routeLink(a, b),
      note: "every train, bus and ferry on that leg",
    });
  }

  return links;
}
