import { CITIES, DESTINATIONS } from "./destinations";
import { PLACES } from "./index";
import type { DestinationPack } from "@/lib/research";
import type { Destination } from "@/lib/types";
import { key } from "@/lib/text";

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
  const hand = DESTINATIONS.find((d) => d.id === pack.destination.id);
  if (hand) return deepen(hand, pack);
  registered.set(pack.destination.id, pack);
  DESTINATIONS.push(pack.destination);
  CITIES.push(...pack.cities);
  PLACES.push(...pack.places);
  return true;
}

/**
 * A hand-written destination gets DEEPER, it does not get replaced.
 *
 * This used to `return false` and walk away, which was the right instinct and
 * the wrong consequence. The instinct: a hand-checked entry is the verified
 * tier and a model must not overwrite it. The consequence, once the shared
 * catalogue had ninety-six researched destinations in it, was that the
 * verified tier had become the WEAK tier and was permanently protected from
 * improving.
 *
 * Measured: the twenty-four hand-written destinations average 34 places. The
 * researched ones average 75. Bali has exactly the fourteen places its own
 * seven-day minimum asks for, with no margin at all, so a single avoid-tag
 * drops a week in Bali below the bar. Japan is two cities for an eight-day
 * trip. And nothing could ever fix either of them, because a better Bali
 * bounced off this line.
 *
 * The distinction that actually matters is not "which file did this come
 * from". It is: the destination RECORD - the pitch, the strengths, the
 * because clauses, the caveat - is judgment somebody made, and a model should
 * not overwrite judgment. The places are data. So the record is kept exactly
 * as written and the data is merged underneath it.
 *
 * Nothing is replaced on a collision either: an id or a name already in a
 * city keeps the hand-written version. New material only.
 */
function deepen(hand: Destination, pack: DestinationPack): boolean {
  const mine = CITIES.filter((c) => c.destinationId === hand.id);
  const cityIds = new Set(mine.map((c) => c.id));

  /*
   * The same base under two ids is the failure this has to avoid.
   *
   * validatePack namespaces every city it is given, so a pack that correctly
   * reuses the hand-written id "ubud" arrives holding "bali-ubud". Merged
   * naively that is a second Ubud: two bases in one town, the scheduler
   * moving her between them, and every hotel night counted twice.
   *
   * So a researched city is matched to a hand-written one first - by the id
   * with the destination prefix taken off, then by folded name - and when it
   * matches, its places are re-pointed at the base that already exists and
   * the duplicate city is dropped.
   */
  const byKey = new Map(mine.flatMap((c) => [[key(c.id), c.id], [key(c.name), c.id]] as const));
  const remap = new Map<string, string>();
  const fresh: typeof pack.cities = [];
  for (const c of pack.cities) {
    const bare = c.id.startsWith(`${hand.id}-`) ? c.id.slice(hand.id.length + 1) : c.id;
    const existing = byKey.get(key(bare)) ?? byKey.get(key(c.name));
    if (existing) remap.set(c.id, existing);
    else if (!cityIds.has(c.id)) fresh.push(c);
  }
  CITIES.push(...fresh);
  for (const c of fresh) cityIds.add(c.id);

  const have = new Set(PLACES.map((p) => p.id));
  // Also by name within a city: the same restaurant under two ids is worse
  // than missing it, because the scheduler will book both.
  const named = new Set(PLACES.map((p) => `${p.cityId}|${p.name.toLowerCase()}`));
  const add = pack.places
    .map((p) => (remap.has(p.cityId) ? { ...p, cityId: remap.get(p.cityId)! } : p))
    .filter((p) => {
      if (!cityIds.has(p.cityId)) return false;
      const k = `${p.cityId}|${p.name.toLowerCase()}`;
      if (have.has(p.id) || named.has(k)) return false;
      have.add(p.id);
      named.add(k);
      return true;
    });
  PLACES.push(...add);

  if (add.length || fresh.length) {
    console.info(`[catalogue] ${hand.id}: +${add.length} places, +${fresh.length} bases from research`);
  }
  // Not "registered": this is still a hand-written destination, and
  // isResearched must keep saying so.
  return add.length > 0 || fresh.length > 0;
}

export const isResearched = (destinationId: string) => registered.has(destinationId);
export const packFor = (destinationId: string) => registered.get(destinationId);
export const researchedIds = () => [...registered.keys()];
