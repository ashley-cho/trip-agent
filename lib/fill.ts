/**
 * Filling a researched destination in, base by base.
 *
 * This lived in flow.ts, where it could only ever be reached by a browser
 * turn. The seeding path needs exactly the same thing on the server, and the
 * one thing that must not happen is a second implementation of it: the
 * catalogue the seeder writes and the catalogue a traveller's own research
 * writes have to be the same shape, built by the same code, or the two drift
 * apart and only one of them is tested.
 *
 * So: one function, one home, two callers.
 */
import type { DestinationPack } from "@/lib/research";
import { placesPerCity, validatePlaceList } from "@/lib/research";

/** Only the one method this needs, so a server driver satisfies it too. */
export interface PlaceFiller {
  researchPlaces(
    destinationName: string, cityId: string, cityName: string,
    count: number, interests?: string, notes?: string,
  ): Promise<{ places?: unknown; problem?: string }>;
}

/**
 * One call per base, in parallel, merged back into the pack.
 *
 * Deliberately forgiving: a base whose call fails or returns nothing keeps
 * whatever the first pass found for it. A thinner trip is a worse trip; no
 * trip is a broken product.
 */
export async function fillInBases(
  pack: DestinationPack, days: number, interests: string, notes: string | undefined,
  api: PlaceFiller,
): Promise<DestinationPack> {
  const cities = pack.cities.slice(0, 5);
  if (!cities.length) return pack;

  const perCity = placesPerCity(days, cities.length);
  const ask = async (c: { id: string; name: string }) => {
    try {
      const r = await api.researchPlaces(
        pack.destination.name, c.id, c.name, perCity, interests, notes,
      );
      return r.places;
    } catch {
      return undefined;
    }
  };

  let places = pack.places;
  const absorb = (raw: unknown) => {
    if (!raw) return 0;
    // Same validation as the first pass, and it knows what we already hold, so
    // the same restaurant coming back twice is dropped rather than scheduled
    // twice.
    const { places: extra } = validatePlaceList(raw, pack.destination.id, pack.cities, places);
    places = [...places, ...extra];
    return extra.length;
  };

  const first = await Promise.all(cities.map(ask));
  const empty = cities.filter((c, i) => absorb(first[i]) === 0);

  /*
   * Ask again for the bases that came back with nothing.
   *
   * These calls used to fail silently: a base that returned nothing simply got
   * no places, and a week in the Faroes came out as five things across seven
   * days with Tórshavn showing "A day off" twice in a row and ten hours free.
   * One of the three calls had failed and nobody asked it again.
   *
   * Only the empty ones, all at once, and only once. In the good case this
   * costs nothing at all, because there is nothing to retry.
   */
  if (empty.length) {
    const second = await Promise.all(empty.map(ask));
    second.forEach(absorb);
  }
  return { ...pack, places };
}

