/**
 * "i wanna go abroad" is a hard constraint, and nothing in the app read it.
 *
 * She was pitched the Utah canyon country, said she wanted to go abroad, and
 * was told "Understood, that just doesn't settle it on its own." It settles a
 * great deal: it rules out three of the fifteen destinations outright, and it
 * rules out the one she had just been offered.
 *
 * There was no notion of a country anywhere in the model. Destinations carry
 * a hub city and a price from San Francisco, and origins carry a label and a
 * lat/lng. Neither carries a nationality, so "abroad" had nothing to compare.
 */
import type { Origin } from "@/lib/origin";

/**
 * ISO country for each seeded destination.
 *
 * Kept here rather than added to fifteen objects in data/destinations.ts,
 * because it is a fact about geography rather than about the trip, and
 * because a researched destination has no entry here at all: unknown
 * nationality must never be read as "domestic", or asking to go abroad would
 * silently exclude every place we went and looked up for her.
 */
const COUNTRY: Record<string, string> = {
  portugal: "PT",
  andalusia: "ES",
  catalonia: "ES",
  mexico: "MX",
  japan: "JP",
  denmark: "DK",
  iceland: "IS",
  korea: "KR",
  southwest: "US",
  pacificnw: "US",
  centralcoast: "US",
  newzealand: "NZ",
  italy: "IT",
  bali: "ID",
  france: "FR",
};

/** Origins by the labels lib/origin.ts actually produces. */
const ORIGIN_COUNTRY: Record<string, string> = {
  "San Francisco": "US", "Los Angeles": "US", "Seattle": "US", "Denver": "US",
  "Phoenix": "US", "Chicago": "US", "New York": "US", "Anchorage": "US",
  "Honolulu": "US", "Vancouver": "CA", "Toronto": "CA", "Montreal": "CA",
  "Mexico City": "MX", "São Paulo": "BR", "Bogotá": "BR", "Buenos Aires": "AR",
  "Lima": "PE", "Santiago": "CL", "London": "GB", "Dublin": "IE",
  "Paris": "FR", "Madrid": "ES", "Lisbon": "PT", "Berlin": "DE",
  "Amsterdam": "NL", "Zurich": "CH", "Rome": "IT", "Stockholm": "SE",
  "Oslo": "NO", "Copenhagen": "DK", "Helsinki": "FI", "Warsaw": "PL",
  "Athens": "GR", "Istanbul": "TR", "Dubai": "AE", "Mumbai": "IN",
  "Bangkok": "TH", "Singapore": "SG", "Hong Kong": "HK", "Tokyo": "JP",
  "Seoul": "KR", "Sydney": "AU", "Melbourne": "AU", "Auckland": "NZ",
  "Johannesburg": "ZA", "Cairo": "EG", "Nairobi": "KE", "Lagos": "NG",
};

export function countryOfOrigin(origin?: Origin): string | undefined {
  return origin ? ORIGIN_COUNTRY[origin.label] : undefined;
}

/**
 * Is this destination in the country she is flying from?
 *
 * Undefined on either side means we don't know, and not knowing is not a
 * reason to rule somewhere out. Only a confident match counts as domestic.
 */
export function isDomestic(destinationId: string, origin?: Origin): boolean {
  const home = countryOfOrigin(origin);
  const there = COUNTRY[destinationId];
  return !!home && !!there && home === there;
}

/** Reads the constraint out of her own words. A literal phrase, not a judgement. */
export const ABROAD =
  /\b(?:abroad|overseas|out of the country|outside the country|leave the country|another country|a different country|international(?:ly)?|not (?:in )?the (?:us|usa|states)|somewhere foreign)\b/i;

export const wantsAbroad = (text: string) => ABROAD.test(text);
