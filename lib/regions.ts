import { CITIES, DESTINATIONS } from "@/data/destinations";

/**
 * Regions, because people say "a roadtrip in Europe" far more often than they
 * name a country.
 *
 * "europe" was invisible to the parser: it isn't a catalogue destination and it
 * doesn't follow a "go to" cue, so it matched nothing. Meanwhile the word
 * "roadtrip" was wired directly to the Utah canyon country. The weakest signal
 * in the sentence beat the only real constraint in it, and the agent sent
 * someone asking about Europe to Utah.
 *
 * A region is a filter over the catalogue, not a destination. Where we hold
 * nothing inside one, that is a research prompt rather than a dead end.
 */
export interface Region {
  id: string;
  label: string;
  test: RegExp;
  /** Catalogue destinations inside it. Empty means we hold nothing there yet. */
  ids: string[];
}

export const REGIONS: Region[] = [
  { id: "scandinavia", label: "Scandinavia", ids: ["denmark", "iceland"],
    test: /\b(scandinavi\w*|nordics?|norway|sweden|finland|norwegian|swedish|finnish)\b/i },
  { id: "iberia", label: "Iberia", ids: ["portugal", "andalusia", "catalonia"],
    test: /\b(iberia\w*|the iberian peninsula)\b/i },
  { id: "mediterranean", label: "the Mediterranean", ids: ["andalusia", "catalonia", "italy", "france", "portugal", "cyclades", "dalmatia"],
    test: /\b(mediterranean|the med)\b/i },
  { id: "balkans", label: "the Balkans", ids: ["dalmatia"],
    test: /\b(balkans?|former yugoslavia|adriatic)\b/i },
  { id: "easteurope", label: "Eastern Europe", ids: [],
    test: /\b(eastern europe|central europe|baltics?)\b/i },
  { id: "europe", label: "Europe", ids: ["portugal", "andalusia", "catalonia", "italy", "france", "denmark", "iceland", "highlands", "cyclades", "dalmatia"],
    test: /\b(europe|european|eu\b)\b/i },
  /*
   * "thailand" and "vietnam" used to live in this regex for the same reason
   * "patagonia" lived in the South America one: the catalogue held nothing in
   * either, so the honest answer to the word was a region shortlist. Both are
   * destinations now, and a region is read before any named place, so leaving
   * them here would turn "two weeks in Vietnam" into a shortlist of Southeast
   * Asia — the widening this file exists to prevent. The countries we still
   * hold nothing in stay; the two we ship go to NAMED_DESTINATIONS.
   */
  { id: "seasia", label: "Southeast Asia", ids: ["bali", "northernthailand", "vietnam"],
    test: /\b(south.?east asia|sea\b(?! level)|cambodia|laos|philippines|malaysia)\b/i },
  { id: "eastasia", label: "East Asia", ids: ["japan", "korea", "taiwan"],
    test: /\b(east asia|far east)\b/i },
  { id: "asia", label: "Asia", ids: ["japan", "korea", "bali", "taiwan", "northernthailand", "vietnam"],
    test: /\b(asia|asian)\b/i },
  { id: "westcoast", label: "the West Coast", ids: ["pacificnw", "centralcoast"],
    test: /\b(west coast|pacific coast|california\b)\b/i },
  { id: "usa", label: "the States", ids: ["southwest", "pacificnw", "centralcoast"],
    test: /\b(the states|united states|the us\b|usa\b|domestic(ally)?|stateside|in the country)\b/i },
  { id: "namerica", label: "North America", ids: ["mexico", "southwest", "pacificnw", "centralcoast"],
    test: /\b(north america\w*)\b/i },
  { id: "latam", label: "Latin America", ids: ["mexico", "costarica", "peru", "patagonia"],
    test: /\b(latin america\w*|central america\w*)\b/i },
  /*
   * "patagonia" used to live in this regex, because the catalogue held nothing
   * in South America and the honest answer to the word was "let me go and look
   * it up". It is a destination of its own now, so leaving it here would route
   * a named place into a region shortlist — the widening this file exists to
   * prevent. The continent words stay; the place name goes to
   * NAMED_DESTINATIONS.
   */
  { id: "samerica", label: "South America", ids: ["peru", "patagonia"],
    test: /\b(south america\w*|andes|andean)\b/i },
  { id: "africa", label: "Africa", ids: [],
    test: /\b(africa\w*|the sahara|the maghreb)\b/i },
  { id: "meast", label: "the Middle East", ids: [],
    test: /\b(middle east\w*|the levant|the gulf)\b/i },
  { id: "caribbean", label: "the Caribbean", ids: [],
    test: /\b(caribbean|the antilles)\b/i },
  { id: "oceania", label: "Oceania", ids: ["newzealand"],
    test: /\b(oceania|australasia|the south pacific)\b/i },
];

/** The most specific region named, so "Southeast Asia" beats "Asia". */
export function detectRegion(text: string): Region | undefined {
  const hits = REGIONS.filter((r) => r.test.test(text));
  if (hits.length === 0) return undefined;
  // REGIONS is ordered specific-first within each continent, so the first hit
  // is the narrower one.
  return hits[0];
}

/** Only the ids we actually hold, so a stale region entry can't empty the field. */
export function regionIds(region: Region): string[] {
  return region.ids.filter((id) => DESTINATIONS.some((d) => d.id === id));
}

/** A road trip is a shape, not a place. */
export const ROAD_TRIP = /\b(road ?trip|drive around|driving (holiday|trip|tour)|rent a car and|self.?drive)\b/i;

/**
 * Where a destination actually is, from where its bases actually are.
 *
 * `ids` above is hand-written, and hand-written was survivable when the
 * catalogue was fifteen entries someone typed. It is not survivable now: the
 * shared table holds sixty-seven researched destinations and not one of them
 * appears in any list above, so "not southeast asia" would have excluded Bali,
 * Thailand and Vietnam and cheerfully offered Laos, Singapore, Malaysia or
 * Cambodia, all of which were seeded this morning.
 *
 * A box on the map cannot go stale. Every destination already carries cities
 * with validated coordinates — the scheduler trusts them for distance — so
 * membership is computed from those and anything researched tomorrow is
 * covered the moment it arrives, with no backfill and no extra model call.
 *
 * Coarse on purpose. The question is "did she rule this part of the world
 * out", not "which subregion does the UN assign".
 *
 * [south, north, west, east]
 */
const BOXES: Record<string, [number, number, number, number][]> = {
  scandinavia: [[54, 72, 4, 32]],
  iberia:      [[36, 44, -10, 3]],
  mediterranean: [[30, 46, -6, 36]],
  balkans:     [[38, 47, 13, 30]],
  easteurope:  [[44, 60, 15, 50]],
  europe:      [[34, 72, -25, 45]],
  // The seam between these two runs through northern Indochina rather than
  // down a coast, so it is cut by latitude: Hanoi at 21.0N is Southeast Asia,
  // Taipei at 25.0N is East Asia, and a single box drawn to hold both put
  // Taiwan in Southeast Asia.
  seasia:      [[-11, 21.5, 92, 141]],
  eastasia:    [[22, 54, 100, 154]],
  // West edge at 32, not 25: at 25 the box swallowed the Greek islands, so
  // "nowhere in Asia" excluded the Cyclades.
  asia:        [[-11, 60, 32, 154]],
  westcoast:   [[32, 49, -125, -114]],
  usa:         [[24, 72, -170, -66]],
  namerica:    [[14, 72, -170, -52]],
  latam:       [[-57, 33, -118, -34]],
  samerica:    [[-57, 13, -82, -34]],
  /*
   * Two boxes, because the north coast steps down as you go east. One
   * rectangle reaching Tunis at 36.8N also reaches Santorini at 36.4N, so
   * "nowhere in Africa" was excluding the Greek islands. West of 12E the coast
   * runs high (Tangier, Algiers, Tunis); east of it, Libya and Egypt sit well
   * below 33. Andalusia at 37.4N is now Spain again.
   */
  africa:      [[-36, 37.2, -18, 12], [-36, 33, 12, 52]],
  meast:       [[12, 42, 32, 64]],
  // South edge at 10 so San José, at 9.9N, is Central America rather than the
  // Caribbean.
  caribbean:   [[10, 27, -85, -59]],
  /*
   * Two boxes and a step in the middle, because one rectangle holding both
   * Perth and Guam also holds Bali — and Bali is Southeast Asia. South of
   * 10S is Australia and New Zealand; north of it, only east of 130.
   */
  oceania:     [[-50, -10, 110, 180], [-10, 21, 130, 180], [-30, 10, -180, -130]],
};

const inside = (lat: number, lng: number) => ([s, n, w, e]: [number, number, number, number]) =>
  lat >= s && lat <= n && lng >= w && lng <= e;

/** The first base with a fix decides, which is every destination we hold. */
function fix(destinationId: string): { lat: number; lng: number } | undefined {
  const c = CITIES.find((x) => x.destinationId === destinationId
    && Number.isFinite(x.lat) && Number.isFinite(x.lng));
  return c ? { lat: c.lat, lng: c.lng } : undefined;
}

/** Is this destination inside this region, by the map rather than by a list? */
export function inRegion(destinationId: string, regionId: string): boolean {
  const boxes = BOXES[regionId];
  const at = fix(destinationId);
  if (!boxes || !at) return false;
  return boxes.some(inside(at.lat, at.lng));
}

/**
 * Every destination in a region: the hand-written list, plus everything the
 * map puts there. The list stays because it encodes judgment a box cannot —
 * "Iberia" is Portugal and Andalusia and Catalonia, not every point in the
 * rectangle — and the box catches everything nobody has got round to listing.
 */
export function membersOf(regionId: string): string[] {
  const named = REGIONS.find((r) => r.id === regionId);
  const listed = named ? regionIds(named) : [];
  const derived = DESTINATIONS.filter((d) => inRegion(d.id, regionId)).map((d) => d.id);
  return [...new Set([...listed, ...derived])];
}

/**
 * The tropics, for "nowhere humid".
 *
 * Humidity is not a field anyone records and is not worth a model call.
 * Between the tropics, at the altitudes people actually go on holiday, it is
 * humid, and that is what someone means when they rule it out. Latitude is
 * the part of that the data can actually support, so it is the only part this
 * claims.
 */
export const TROPICS = 23.5;
export function inTropics(destinationId: string): boolean {
  const at = fix(destinationId);
  return at ? Math.abs(at.lat) <= TROPICS : false;
}
