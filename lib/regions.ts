import { DESTINATIONS } from "@/data/destinations";

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
  { id: "mediterranean", label: "the Mediterranean", ids: ["andalusia", "catalonia", "italy", "france", "portugal"],
    test: /\b(mediterranean|the med)\b/i },
  { id: "balkans", label: "the Balkans", ids: [],
    test: /\b(balkans?|former yugoslavia|adriatic)\b/i },
  { id: "easteurope", label: "Eastern Europe", ids: [],
    test: /\b(eastern europe|central europe|baltics?)\b/i },
  { id: "europe", label: "Europe", ids: ["portugal", "andalusia", "catalonia", "italy", "france", "denmark", "iceland"],
    test: /\b(europe|european|eu\b)\b/i },
  { id: "seasia", label: "Southeast Asia", ids: ["bali"],
    test: /\b(south.?east asia|sea\b(?! level)|thailand|vietnam|cambodia|laos|philippines|malaysia)\b/i },
  { id: "eastasia", label: "East Asia", ids: ["japan", "korea"],
    test: /\b(east asia|far east)\b/i },
  { id: "asia", label: "Asia", ids: ["japan", "korea", "bali"],
    test: /\b(asia|asian)\b/i },
  { id: "westcoast", label: "the West Coast", ids: ["pacificnw", "centralcoast"],
    test: /\b(west coast|pacific coast|california\b)\b/i },
  { id: "usa", label: "the States", ids: ["southwest", "pacificnw", "centralcoast"],
    test: /\b(the states|united states|the us\b|usa\b|domestic(ally)?|stateside|in the country)\b/i },
  { id: "namerica", label: "North America", ids: ["mexico", "southwest", "pacificnw", "centralcoast"],
    test: /\b(north america\w*)\b/i },
  { id: "latam", label: "Latin America", ids: ["mexico"],
    test: /\b(latin america\w*|central america\w*)\b/i },
  { id: "samerica", label: "South America", ids: [],
    test: /\b(south america\w*|patagonia|andes|andean)\b/i },
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
