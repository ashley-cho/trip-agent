import { haversineKm } from "@/lib/geo";

/**
 * Where the traveller is flying from.
 *
 * Every flightUsd in the catalogue was seeded for someone leaving San
 * Francisco. That was fine while the only tester was in San Francisco, but the
 * number was presented as if it were about the trip rather than about an
 * assumption nobody had stated.
 *
 * Origin comes from the browser's IANA timezone, which needs no permission
 * prompt, returns instantly, works offline, and is right to within a few
 * hundred kilometres — well inside the precision a seeded airfare deserves.
 * Actual geolocation would be a modal dialog for a number that is an estimate
 * either way.
 */
export interface Origin {
  label: string;
  lat: number;
  lng: number;
  /** True when we guessed from a region rather than recognising the zone. */
  approximate?: boolean;
}

/** The origin every flightUsd in data/destinations.ts was priced from. */
export const SEEDED_ORIGIN: Origin = { label: "San Francisco", lat: 37.7749, lng: -122.4194 };

const ZONES: Record<string, Origin> = {
  "America/Los_Angeles": SEEDED_ORIGIN,
  "America/Vancouver": { label: "Vancouver", lat: 49.2827, lng: -123.1207 },
  "America/Denver": { label: "Denver", lat: 39.7392, lng: -104.9903 },
  "America/Phoenix": { label: "Phoenix", lat: 33.4484, lng: -112.074 },
  "America/Chicago": { label: "Chicago", lat: 41.8781, lng: -87.6298 },
  "America/New_York": { label: "New York", lat: 40.7128, lng: -74.006 },
  "America/Toronto": { label: "Toronto", lat: 43.6532, lng: -79.3832 },
  "America/Mexico_City": { label: "Mexico City", lat: 19.4326, lng: -99.1332 },
  "America/Sao_Paulo": { label: "São Paulo", lat: -23.5505, lng: -46.6333 },
  "America/Bogota": { label: "Bogotá", lat: 4.711, lng: -74.0721 },
  "America/Anchorage": { label: "Anchorage", lat: 61.2181, lng: -149.9003 },
  "Pacific/Honolulu": { label: "Honolulu", lat: 21.3069, lng: -157.8583 },
  "Europe/London": { label: "London", lat: 51.5072, lng: -0.1276 },
  "Europe/Dublin": { label: "Dublin", lat: 53.3498, lng: -6.2603 },
  "Europe/Paris": { label: "Paris", lat: 48.8566, lng: 2.3522 },
  "Europe/Madrid": { label: "Madrid", lat: 40.4168, lng: -3.7038 },
  "Europe/Lisbon": { label: "Lisbon", lat: 38.7223, lng: -9.1393 },
  "Europe/Berlin": { label: "Berlin", lat: 52.52, lng: 13.405 },
  "Europe/Amsterdam": { label: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  "Europe/Zurich": { label: "Zurich", lat: 47.3769, lng: 8.5417 },
  "Europe/Rome": { label: "Rome", lat: 41.9028, lng: 12.4964 },
  "Europe/Copenhagen": { label: "Copenhagen", lat: 55.6761, lng: 12.5683 },
  "Europe/Stockholm": { label: "Stockholm", lat: 59.3293, lng: 18.0686 },
  "Europe/Warsaw": { label: "Warsaw", lat: 52.2297, lng: 21.0122 },
  "Europe/Istanbul": { label: "Istanbul", lat: 41.0082, lng: 28.9784 },
  "Atlantic/Reykjavik": { label: "Reykjavík", lat: 64.1466, lng: -21.9426 },
  "Asia/Dubai": { label: "Dubai", lat: 25.2048, lng: 55.2708 },
  "Asia/Kolkata": { label: "Mumbai", lat: 19.076, lng: 72.8777 },
  "Asia/Calcutta": { label: "Mumbai", lat: 19.076, lng: 72.8777 },
  "Asia/Bangkok": { label: "Bangkok", lat: 13.7563, lng: 100.5018 },
  "Asia/Singapore": { label: "Singapore", lat: 1.3521, lng: 103.8198 },
  "Asia/Hong_Kong": { label: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  "Asia/Shanghai": { label: "Shanghai", lat: 31.2304, lng: 121.4737 },
  "Asia/Seoul": { label: "Seoul", lat: 37.5665, lng: 126.978 },
  "Asia/Tokyo": { label: "Tokyo", lat: 35.6762, lng: 139.6503 },
  "Australia/Sydney": { label: "Sydney", lat: -33.8688, lng: 151.2093 },
  "Australia/Melbourne": { label: "Melbourne", lat: -37.8136, lng: 144.9631 },
  "Pacific/Auckland": { label: "Auckland", lat: -36.8485, lng: 174.7633 },
  "Africa/Johannesburg": { label: "Johannesburg", lat: -26.2041, lng: 28.0473 },
  "Africa/Cairo": { label: "Cairo", lat: 30.0444, lng: 31.2357 },
  "Africa/Lagos": { label: "Lagos", lat: 6.5244, lng: 3.3792 },
};

/**
 * Airport codes, because "flying out of SFO" is how people say where they are.
 * Only the origins we can already price from; an unrecognised code is left to
 * the timezone guess rather than answered wrongly.
 */
const AIRPORTS: Record<string, string> = {
  sfo: "America/Los_Angeles", oak: "America/Los_Angeles", sjc: "America/Los_Angeles",
  lax: "America/Los_Angeles", bur: "America/Los_Angeles", san: "America/Los_Angeles",
  sea: "America/Vancouver", yvr: "America/Vancouver", pdx: "America/Los_Angeles",
  den: "America/Denver", phx: "America/Phoenix", slc: "America/Denver",
  ord: "America/Chicago", mdw: "America/Chicago", dfw: "America/Chicago",
  aus: "America/Chicago", iah: "America/Chicago", msp: "America/Chicago",
  jfk: "America/New_York", lga: "America/New_York", ewr: "America/New_York",
  bos: "America/New_York", dca: "America/New_York", iad: "America/New_York",
  atl: "America/New_York", mia: "America/New_York", yyz: "America/Toronto",
  mex: "America/Mexico_City", gru: "America/Sao_Paulo", bog: "America/Bogota",
  hnl: "Pacific/Honolulu", anc: "America/Anchorage",
  lhr: "Europe/London", lgw: "Europe/London", stn: "Europe/London",
  dub: "Europe/Dublin", cdg: "Europe/Paris", ory: "Europe/Paris",
  mad: "Europe/Madrid", bcn: "Europe/Madrid", lis: "Europe/Lisbon",
  ber: "Europe/Berlin", muc: "Europe/Berlin", fra: "Europe/Berlin",
  ams: "Europe/Amsterdam", zrh: "Europe/Zurich", fco: "Europe/Rome",
  mxp: "Europe/Rome", cph: "Europe/Copenhagen", arn: "Europe/Stockholm",
  waw: "Europe/Warsaw", ist: "Europe/Istanbul", kef: "Atlantic/Reykjavik",
  dxb: "Asia/Dubai", bom: "Asia/Kolkata", del: "Asia/Kolkata",
  bkk: "Asia/Bangkok", sin: "Asia/Singapore", hkg: "Asia/Hong_Kong",
  pvg: "Asia/Shanghai", icn: "Asia/Seoul", gmp: "Asia/Seoul",
  nrt: "Asia/Tokyo", hnd: "Asia/Tokyo", syd: "Australia/Sydney",
  mel: "Australia/Melbourne", akl: "Pacific/Auckland",
  jnb: "Africa/Johannesburg", cai: "Africa/Cairo", los: "Africa/Lagos",
};

/** Last resort when the zone isn't in the table: the region's rough centre. */
const REGIONS: Record<string, Origin> = {
  America: { label: "North America", lat: 39.8283, lng: -98.5795, approximate: true },
  Europe: { label: "Europe", lat: 50.1109, lng: 8.6821, approximate: true },
  Asia: { label: "Asia", lat: 25.0, lng: 102.0, approximate: true },
  Africa: { label: "Africa", lat: 9.082, lng: 21.0, approximate: true },
  Australia: { label: "Australia", lat: -25.2744, lng: 133.7751, approximate: true },
  Pacific: { label: "the Pacific", lat: -17.0, lng: -175.0, approximate: true },
  Atlantic: { label: "the Atlantic", lat: 38.0, lng: -28.0, approximate: true },
  Indian: { label: "the Indian Ocean", lat: -6.0, lng: 72.0, approximate: true },
};

export function originForZone(tz: string | undefined): Origin | null {
  if (!tz) return null;
  const exact = ZONES[tz];
  if (exact) return exact;
  const region = REGIONS[tz.split("/")[0]];
  return region ?? null;
}

/** Browser only. Returns null on the server or anywhere Intl is unavailable. */
export function detectOrigin(): Origin | null {
  try {
    return originForZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}

/**
 * A typed correction, and only that. The cue is required: "I want to go to
 * Tokyo" states a destination, not an origin, and reading it as one would
 * quietly reprice every trip in the catalogue off the wrong city.
 */
const ORIGIN_CUE =
  /\b(?:i'?m (?:in|based in|living in)|i live in|based (?:in|out of)|fly(?:ing)? (?:from|out of)|leaving from|departing (?:from)?|travel(?:l)?ing from|coming from|from)\s+([a-z\u00C0-\u00FF .'-]{3,30})/i;

/**
 * A trip that hangs off another trip departs from that other trip.
 *
 * "i'm going to london for a business trip, and i wanna extend the trip" reads
 * as a destination everywhere else, and it is — but not for the part she is
 * asking about. The extension leaves from London. Read as a flight from her
 * home airport it produced a seven-day Mexico recommendation, "short flight,
 * big culture payoff", for someone who would be standing in Heathrow.
 */
const EXTENDING =
  /\b(?:extend(?:ing)?|tack(?:ing)? on|add(?:ing)? (?:on|a few days)|stay(?:ing)? on|while i'?m (?:there|out there)|after (?:the|my) (?:conference|wedding|work trip|business trip|meetings?))\b/i;
const HEADED_TO =
  /\b(?:i'?m |i am |going |headed |travel(?:l)?ing |flying )?(?:going |headed |flying |travel(?:l)?ing )?to\s+([a-z\u00C0-\u00FF .'-]{3,30}?)\s*(?:for|on)\s+(?:a |an |the |some )?(?:business|work|conference|wedding|meetings?|job|training|summit|offsite)/i;

/**
 * Where the extension leaves from, when the message describes one. Null when
 * it doesn't, so the caller can fall back to the traveller's actual home.
 */
export function extensionOriginFromText(text: string): Origin | null {
  if (!EXTENDING.test(text)) return null;
  const m = text.match(HEADED_TO);
  if (m) return originByName(m[1]);
  // "while i'm in Berlin, i'd like to extend" — the cue and the city are in
  // the same sentence but not in that shape.
  const inCity = text.match(/\b(?:while |when )?i'?m (?:in|at)\s+([a-z\u00C0-\u00FF .'-]{3,30})/i);
  return inCity ? originByName(inCity[1]) : null;
}

export function originFromText(text: string): Origin | null {
  const extending = extensionOriginFromText(text);
  if (extending) return extending;
  // An airport code is unambiguous, so it wins over a city name in the text.
  const air = text.match(/\b(?:fly(?:ing)? (?:out )?(?:of|from)|out of|from|depart(?:ing)? (?:from)?)\s+([a-z]{3})\b/i);
  if (air) {
    const zone = AIRPORTS[air[1].toLowerCase()];
    if (zone) return originForZone(zone);
  }
  const m = text.match(ORIGIN_CUE);
  if (!m) return null;
  return originByName(m[1]);
}

/** Match a place name anywhere in the given phrase. */
export function originByName(text: string): Origin | null {
  const t = text.toLowerCase();
  let best: Origin | null = null;
  for (const o of Object.values(ZONES)) {
    const name = o.label.toLowerCase();
    if (name.length < 4) continue;
    if (new RegExp(`\\b${name.replace(/[^a-z\s]/g, ".")}\\b`).test(t)) {
      if (!best || o.label.length > best.label.length) best = o;
    }
  }
  return best;
}

/**
 * Airfare from this origin, anchored so San Francisco reproduces the seeded
 * number exactly. Everything else is scaled by how much further, or nearer,
 * the traveller actually is. Still an estimate; it is now an estimate about
 * them rather than about a stranger in California.
 */
export function flightUsdFrom(
  dest: { flightUsd: number; arrival: "fly" | "drive" },
  hub: { lat: number; lng: number },
  origin: Origin | null | undefined,
): number {
  if (!origin) return dest.flightUsd;

  const originKm = haversineKm(origin, hub);

  // Already there. Charging someone in Seoul for a flight to Seoul is the kind
  // of detail that makes the whole estimate untrustworthy.
  if (originKm < 400) return 0;

  if (dest.arrival === "drive") {
    // Seeded as a road trip, which only holds on the same landmass.
    if (originKm < 1200) return dest.flightUsd;
    return clamp(Math.round(300 + originKm * 0.09), 220, 3200);
  }

  // Distance model anchored so San Francisco reproduces the seeded number
  // exactly. The +300 is the part of a fare that isn't distance: taxes, the
  // airport, the fact that no useful flight is free. Ratio-scaling without it
  // priced a $190 domestic hop at $418 from Sydney.
  const seededKm = haversineKm(SEEDED_ORIGIN, hub);
  if (seededKm < 400) return dest.flightUsd;
  const f = (km: number) => 300 + km;
  return clamp(Math.round(dest.flightUsd * (f(originKm) / f(seededKm))), 90, 4000);
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
