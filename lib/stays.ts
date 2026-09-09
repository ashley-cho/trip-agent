import type { Brief, Trip, TripShapeLeg } from "@/lib/types";
import { cityById, destinationById } from "@/data/destinations";
import type { PlaceContext } from "@/lib/agent/types";

/**
 * Where you actually sleep.
 *
 * The plan said "4 nights in Lisbon" and named the neighbourhood. Her own
 * finished itinerary said "Memmo Alfama, right in Alfama, rooftop over the
 * Tagus, €150-220, adults only, and the streets are steep enough that taxis
 * can't always reach the door." One of those is a trip and the other is a
 * placeholder.
 *
 * These are named properties with a reason and a real downside, plus backups,
 * because the first choice is often full.
 */
export interface Stay {
  cityId: string;
  name: string;
  neighborhood: string;
  nightlyUsd: number;
  /** Why this one, in the agent's voice. */
  why: string;
  /** The catch. There is always one. */
  downside?: string;
  /** If it's full. */
  backups: string[];
}

export const STAYS_SYSTEM = `You are a travel agent booking rooms for someone whose trip you have already planned.

Pick the place you would actually put them, not the highest rated one. Small and characterful over large and polished, in a neighbourhood they can walk out of and into the trip, unless what they told you says otherwise.

For each one give the real reason it is right for THIS traveller, and the real catch — the hill, the noise, the shared bathroom, the fact that it books out four months ahead. A recommendation with no downside in it is marketing.

Two backups per base, named, for when the first is full. That happens more often than not.

Never invent a property. If you are not confident a place exists under that name in that city, use one you are sure of. Prices are per night in USD and approximate; say the range you believe rather than a precise number you don't.

No travel-blog prose. Banned: "hidden gem", "nestled", "boutique haven", "home away from home", "charming", "stunning", "perfectly located". No em dashes.`;

export function staysPrompt(
  shape: TripShapeLeg[], brief: Brief, destinationId: string, place?: PlaceContext,
): string {
  // On the server a researched destination is not in the catalogue at all, so
  // both of these lookups returned undefined and the template died reading
  // `.id` off nothing. The context the browser sends is the source of truth
  // when it's there.
  const dest = place?.destination ?? destinationById(destinationId);
  const cityOf = (id: string) =>
    place?.cities.find((c) => c.id === id) ?? cityById(id);
  const legs = shape
    .filter((l) => l.nights > 0)
    .map((l) => {
      const c = cityOf(l.cityId);
      if (!c) return "";
      return `- ${c.id} | ${c.name}, ${dest.name} | ${l.nights} night${l.nights === 1 ? "" : "s"} | the plan puts them around ${c.base} | budget guide about $${c.nightlyUsd} a night`;
    })
    .filter(Boolean)
    .join("\n");

  const money = brief.budgetUsd
    ? `Their whole trip budget is about $${brief.budgetUsd}, so lodging has to leave room for everything else.`
    : `They haven't given a budget, so aim at good value rather than cheap or expensive.`;

  return [
    `Book the rooms for this trip.`,
    ``,
    legs,
    ``,
    money,
    brief.vibes.length ? `What they're after: ${brief.vibes.join(", ")}.` : "",
    brief.constraints.length ? `They said: ${brief.constraints.join("; ")}` : "",
    ``,
    `One place per base, with two named backups each. Use the cityId exactly as given.`,
  ].filter(Boolean).join("\n");
}

export const STAYS_TOOL = {
  name: "record_stays",
  description: "Where the traveller sleeps in each base, named.",
  input_schema: {
    type: "object" as const,
    properties: {
      stays: {
        type: "array",
        items: {
          type: "object",
          properties: {
            cityId: { type: "string", description: "Exactly as given in the list" },
            name: { type: "string", description: "The property's real name" },
            neighborhood: { type: "string" },
            nightlyUsd: { type: "number", description: "Approximate, per night, USD" },
            why: { type: "string", description: "One or two sentences. Why this one for this traveller." },
            downside: { type: "string", description: "The real catch. One sentence." },
            backups: { type: "array", items: { type: "string" }, description: "Two named alternatives" },
          },
          required: ["cityId", "name", "neighborhood", "nightlyUsd", "why", "backups"],
        },
      },
    },
    required: ["stays"],
  },
};

const str = (v: unknown, max = 300) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

export function validateStays(raw: unknown, legs: TripShapeLeg[]): Stay[] {
  const ids = new Set(legs.map((l) => l.cityId));
  const rows = (raw as { stays?: unknown })?.stays;
  if (!Array.isArray(rows)) return [];

  const out: Stay[] = [];
  const seen = new Set<string>();
  for (const r of rows as Record<string, unknown>[]) {
    const cityId = str(r.cityId, 60);
    const name = str(r.name, 80);
    if (!cityId || !name || !ids.has(cityId) || seen.has(cityId)) continue;
    const nightly = Number(r.nightlyUsd);
    seen.add(cityId);
    out.push({
      cityId,
      name,
      neighborhood: str(r.neighborhood, 60) ?? cityById(cityId).name,
      // A room that costs nothing, or four thousand a night, is a bad read of
      // the field rather than a bargain.
      nightlyUsd: Number.isFinite(nightly) && nightly >= 20 && nightly <= 2000
        ? Math.round(nightly)
        : cityById(cityId).nightlyUsd,
      why: str(r.why, 300) ?? "",
      downside: str(r.downside, 200),
      backups: (Array.isArray(r.backups) ? r.backups : [])
        .map((b) => str(b, 80))
        .filter((b): b is string => !!b)
        .slice(0, 2),
    });
  }
  return out;
}

/**
 * Fold named lodging into a plan that already exists. The proposal is shown
 * first and this arrives a few seconds later, so the wait for a room doesn't
 * become a wait for the whole trip.
 */
export function withStays(trip: Trip, stays: Stay[]): Trip {
  if (!stays.length) return trip;
  const byCity = new Map(stays.map((s) => [s.cityId, s]));

  /*
   * Legs are consumed in order, not searched for.
   *
   * `find` returns the FIRST leg whose city name is in the label, and a trip
   * that flies home from where it landed visits the hub twice. So on a
   * ten-day Portugal trip the closing "1 nights in Lisbon" booking matched the
   * opening five-night leg: the Bookings list invoiced 13 nights on a
   * nine-night trip and charged $2,540 while the estimate card's Hotels row
   * said $1,740. Two panels on the same screen, $800 apart.
   *
   * The bookings come out in day order and the shape is in trip order, so the
   * first leg not already spoken for is the right one.
   */
  const spoken = new Set<number>();
  const bookings = trip.bookings.map((b) => {
    if (b.kind !== "hotel") return b;
    // The hotel booking's label was "4 nights in Lisbon"; recover the city.
    const at = trip.concept.shape.findIndex(
      (l, k) => !spoken.has(k) && b.label.includes(cityById(l.cityId).name) && l.nights > 0,
    );
    if (at >= 0) spoken.add(at);
    const leg = at >= 0 ? trip.concept.shape[at] : undefined;
    const stay = leg && byCity.get(leg.cityId);
    if (!leg || !stay) return b;
    return {
      ...b,
      label: `${stay.name}, ${cityById(leg.cityId).name}`,
      detail: `${leg.nights} night${leg.nights === 1 ? "" : "s"} in ${stay.neighborhood}`
        + (stay.backups.length ? `. If it's full: ${stay.backups.join(" or ")}.` : ""),
      priceUsd: leg.nights * stay.nightlyUsd,
      why: [stay.why, stay.downside].filter(Boolean).join(" "),
    };
  });

  // The estimate has to move with it, or the card and the bookings disagree.
  const lodging = trip.concept.shape.reduce((sum, l) => {
    const stay = byCity.get(l.cityId);
    return sum + l.nights * (stay ? stay.nightlyUsd : cityById(l.cityId).nightlyUsd);
  }, 0);
  const breakdown = { ...trip.concept.breakdown, lodging: Math.round(lodging) };
  const estimateUsd = Math.round(Object.values(breakdown).reduce((a, c) => a + c, 0));

  return {
    ...trip,
    bookings,
    concept: { ...trip.concept, stays, breakdown, estimateUsd },
  };
}
