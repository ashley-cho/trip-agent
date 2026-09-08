import { CITIES, DESTINATIONS } from "./destinations";
import { PLACES } from "./index";
import type { DestinationPack } from "@/lib/research";

/**
 * Researched destinations join the catalogue at runtime.
 *
 * The hand-written arrays are exported as mutable bindings and every importer
 * shares them, so pushing here is visible everywhere without threading a
 * registry through the planner, the critic and the cost model. Blunt, but the
 * alternative is a parameter on forty call sites for a prototype.
 *
 * Deliberately not persisted. Live-researched data ages, and silently planning
 * next month's trip off last month's opening hours is the failure this whole
 * feature exists to avoid.
 */
const registered = new Map<string, DestinationPack>();

export function registerPack(pack: DestinationPack): boolean {
  if (registered.has(pack.destination.id)) return false;
  if (DESTINATIONS.some((d) => d.id === pack.destination.id)) return false;
  registered.set(pack.destination.id, pack);
  DESTINATIONS.push(pack.destination);
  CITIES.push(...pack.cities);
  PLACES.push(...pack.places);
  return true;
}

export const isResearched = (destinationId: string) => registered.has(destinationId);
export const packFor = (destinationId: string) => registered.get(destinationId);
export const researchedIds = () => [...registered.keys()];
