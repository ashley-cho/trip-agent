/**
 * Researched destinations, kept.
 *
 * The catalogue is fifteen hand-written destinations. Anywhere else she names
 * gets looked up live, which is four model calls and the slowest thing the
 * app does, and until now the result lived only in memory. Ask about
 * Jerusalem, close the tab, ask again tomorrow: the whole lookup runs again,
 * at the same cost and the same wait.
 *
 * These are kept indefinitely, and the reason is worth writing down because I
 * had it wrong first.
 *
 * The original objection to storing them was staleness: live data ages, and
 * planning next month's trip off last month's opening hours is the failure
 * this feature exists to avoid. So I expired whole packs after ninety days.
 * That confuses two very different things. A pack is mostly a description of
 * a place — which towns are worth basing in, what is in them, how far apart
 * they are, what the character of each one is. None of that ages. What ages
 * is prices, and prices in this catalogue were never accurate to begin with:
 * every flightUsd in the seeded fifteen is an estimate from San Francisco,
 * and the app says "about $2,890" for exactly that reason.
 *
 * Throwing away a good description of Hokkaido because its airfare estimate
 * drifted is losing the valuable part to protect the part that was never
 * precise. So: kept, with the date they were gathered, and the volatile
 * fields treated as the estimates they always were.
 */
import type { DestinationPack } from "@/lib/research";
import { registerPack } from "@/data/registry";

const KEY = "trip-agent.packs.v1";

/** localStorage is a few megabytes for the whole origin, and trips share it. */
const KEEP = 40;

interface Stored { at: number; pack: DestinationPack }

function read(): Stored[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as Stored[]) : [];
    return Array.isArray(all) ? all.filter((s) => s?.pack?.destination?.id && s.at) : [];
  } catch {
    return [];
  }
}

function write(all: Stored[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, KEEP)));
  } catch {
    /*
     * Out of quota, or storage blocked. The pack is already registered in
     * memory, so this trip is unaffected and the only cost is looking the
     * place up again next time. Never worth an error in her face.
     */
  }
}

/** Everything it has ever looked up, newest first. */
export function storedPacks(): DestinationPack[] {
  return read().sort((a, b) => b.at - a.at).map((s) => s.pack);
}

/**
 * Put every fresh pack back into the catalogue.
 *
 * Called once on load. registerPack is idempotent and refuses to shadow a
 * hand-written destination, so this cannot corrupt the seeded fifteen.
 */
export function hydratePacks(): number {
  let n = 0;
  for (const pack of storedPacks()) if (registerPack(pack)) n++;
  return n;
}

/** Remember a pack we just gathered, replacing any older copy of it. */
export function rememberPack(pack: DestinationPack) {
  const id = pack.destination.id;
  const rest = read().filter((s) => s.pack.destination.id !== id);
  write([{ at: Date.now(), pack }, ...rest]);
}

/**
 * Do we already hold this place?
 *
 * The lookup is skipped when this is true, which is the whole point: the
 * second Jerusalem trip should be instant and free.
 */
export function havePack(destinationId: string): boolean {
  return read().some((s) => s.pack.destination.id === destinationId);
}

/** For a "what has it learned" view, and for tests. */
export function packAges(): { id: string; name: string; days: number }[] {
  return read().map((s) => ({
    id: s.pack.destination.id,
    name: s.pack.destination.name,
    days: Math.floor((Date.now() - s.at) / (24 * 60 * 60 * 1000)),
  }));
}
