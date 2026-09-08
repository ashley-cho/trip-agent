import type { Origin } from "@/lib/origin";
// ---------------------------------------------------------------------------
import type { TransportMode } from "@/lib/transport";

// Domain model. Deliberately small: every entity here is load-bearing for the
// MVP loop (discover -> recommend -> concept -> itinerary -> edit -> profile).
// ---------------------------------------------------------------------------

export type Vibe =
  | "nature" | "exploration" | "food" | "relaxation"
  | "culture" | "adventure" | "city";

export const ALL_VIBES: Vibe[] = [
  "nature", "exploration", "food", "relaxation", "culture", "adventure", "city",
];

export const VIBE_LABEL: Record<Vibe, string> = {
  nature: "🌿 Nature",
  exploration: "🏛️ Exploration",
  food: "🍷 Food & drink",
  relaxation: "🏖️ Relaxation",
  culture: "🎨 Art & culture",
  adventure: "🥾 Adventure",
  city: "🌃 City energy",
};

/** Activity density the traveler wants. Drives items-per-day directly. */
export type Pace = "relaxed" | "light" | "mixed" | "busy";

export const PACE_ACTIVITIES: Record<Pace, number> = {
  relaxed: 2, light: 3, mixed: 4, busy: 5,
};

export type Tag =
  | "history" | "art" | "architecture" | "food" | "wine" | "coffee" | "market"
  | "nature" | "coast" | "viewpoint" | "walk" | "nightlife" | "music"
  | "museum" | "shopping" | "beach" | "hike" | "garden" | "contemporary"
  | "local" | "iconic" | "castle" | "church" | "boat" | "spa" | "earlystart"
  | "adventure" | "film";

export type PlaceKind =
  | "sight" | "meal" | "drink" | "walk" | "outdoor"
  | "museum" | "market" | "experience";

export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening" | "any";

/**
 * The thing they came to do, which is not a property of a town.
 *
 * The whole pipeline was built around cities: research returned cities,
 * fillInBases filled cities with places, the planner put places near the bed.
 * So the only question the system could ever ask was "what is in this town",
 * and a hiking trip came back as Puerto Natales, a trek came back as Namche
 * Bazaar, and a safari came back as Nairobi. The town is where you sleep. It
 * is not what you came for, and for any trip whose substance is outside the
 * towns the two are not the same place.
 *
 * An Outing is that substance. It owns its day, it carries its own hours, and
 * lodging is derived FROM it rather than being the input it hangs off.
 */
export interface Outing {
  id: string;
  name: string;
  /** Door to door, including the drive to the trailhead. An 9h outing IS the day. */
  hours: number;
  /** Where you can plausibly sleep the night before and still start on time. */
  startsFrom: { lat: number; lng: number; name: string }[];
  /** One honest line: what it is, and what is hard about it. */
  why: string;
  km?: number;
  gainM?: number;
  costUsd?: number;
  /** "November to March"; outside it this is not on. */
  season?: string;
  /** The short version for the day the weather shuts the long one. */
  fallback?: string;
}

export interface Place {
  id: string;
  cityId: string;
  name: string;
  kind: PlaceKind;
  tags: Tag[];
  neighborhood: string;
  lat: number;
  lng: number;
  durationMin: number;
  /** Per person, USD. 0 = free. */
  costUsd: number;
  opens?: string;   // "09:00"
  closes?: string;  // "18:30"
  /** 0 = Sunday. Days the place is shut. */
  closedDays?: number[];
  bestTime: TimeOfDay;
  /** 1 = genuinely local, 5 = coach-tour famous. Used by "less touristy". */
  touristy: 1 | 2 | 3 | 4 | 5;
  /** Hand-written. Never model-generated. This is the agent's actual voice. */
  note: string;
  /**
   * Section 34: the agent is allowed to say no. These are never scheduled —
   * they surface as "what I left out, and why" so the judgment is visible
   * rather than silently applied.
   */
  skip?: true;
}

export interface City {
  id: string;
  name: string;
  destinationId: string;
  lat: number;
  lng: number;
  /** Lodging + incidentals per night, USD, mid-range. */
  nightlyUsd: number;
  minNights: number;
  maxNights: number;
  /** Neighborhood the agent would put you in, and why. */
  base: string;
  /** "driving" means the places here are tens of km apart by design. */
  scale?: "walkable" | "driving";
  /** Is this a day-trip target rather than a place you sleep? */
  dayTripOnly?: boolean;
  /**
   * Which base this day trip hangs off. Explicit rather than inferred from
   * distance — Jeonju is closer to Busan than to Seoul as the crow flies, but
   * it is a Seoul day trip because that's where the fast train runs.
   */
  dayTripFrom?: string;
  /** Minutes from the base named by dayTripFrom. */
  transitFromHubMin?: number;
  transitFromHubUsd?: number;
  transitMode?: "train" | "bus" | "car" | "ferry";
}

export interface Destination {
  id: string;
  name: string;
  /** The one-line verdict. Written, not generated. */
  pitch: string;
  /** Per-vibe strength, 0-5. Drives the scoring. */
  strengths: Record<Vibe, number>;
  /** Paces this destination genuinely suits. */
  paceFit: Pace[];
  /** Round-trip air from the traveler's origin, USD. Seeded. */
  flightUsd: number;
  /** Cheapest credible day (lodging + food + local transit). */
  floorPerDayUsd: number;
  minDays: number;
  /** Sentence per vibe, used to build the "why this" without templating slop. */
  because: Partial<Record<Vibe, string>>;
  /** 1 = you will not sunbathe, 5 = reliably hot. Only consulted when asked. */
  warmth: 1 | 2 | 3 | 4 | 5;
  /** How you get there. "drive" trips have no airfare and say so. */
  arrival: "fly" | "drive";
  /** The honest downside. The agent volunteers this. */
  caveat: string;
  /** Hub city id — where you land and base. */
  hubCityId: string;
}

// --- Itinerary -------------------------------------------------------------

export type ItemType = "activity" | "meal" | "downtime" | "transit" | "logistics";

export interface ItineraryItem {
  id: string;
  type: ItemType;
  placeId?: string;
  name: string;
  /** "10:30" */
  start: string;
  durationMin: number;
  /** Why THIS, for THIS traveler. Surfaced as "Why this?". */
  reason: string;
  costUsd: number;
  tags: Tag[];
  lat?: number;
  lng?: number;
  neighborhood?: string;
  note?: string;
}

export interface ItineraryDay {
  index: number;      // 1-based
  /** ISO date. Real dates matter: closedDays are weekday-based. */
  date: string;
  cityId: string;
  theme: string;
  items: ItineraryItem[];
}

export interface TripShapeLeg {
  cityId: string;
  /** A final night back at the arrival hub so the flight home is reachable. */
  returnLeg?: boolean;
  nights: number;
  dayTrip?: string;      // city id
  /** A second day out, only when the base cannot fill its own days. */
  extraDayTrip?: string;
}

export interface TripConcept {
  destinationId: string;
  days: number;
  startDate: string;
  headline: string;
  vibe: string;        // the paragraph
  why: string;         // the reasoning paragraph
  shape: TripShapeLeg[];
  estimateUsd: number;
  breakdown: { flights: number; lodging: number; transport: number; activities: number; food: number };
  /** True when the plan was re-cut to hold the stated budget. Surfaced, never hidden. */
  trimmedForBudget: boolean;
  /** Dollars over the stated budget after every lever was pulled. 0 when it fits. */
  budgetShortfallUsd: number;
  /** Set when the destination can't sustain the pace they asked for. */
  paceShortfall?: string;
  /** Carried so edits reprice from the same origin the plan was built for. */
  origin?: Origin;
  /** Named lodging, one per base. Filled after the plan, by the model. */
  stays?: import("@/lib/stays").Stay[];
  caveat: string;
}

export interface PassedOn {
  placeId: string;
  name: string;
  cityId: string;
  note: string;
}

export interface Trip {
  id: string;
  concept: TripConcept;
  days: ItineraryDay[];
  /** Famous things deliberately not scheduled, with the reasoning. */
  passedOn: PassedOn[];
  /** Mocked. Clearly labelled everywhere in the UI. */
  bookings: MockBooking[];
}

export interface MockBooking {
  id: string;
  kind: "flight" | "hotel" | "train" | "activity";
  label: string;
  detail: string;
  date: string;
  priceUsd: number;
  cancellation: string;
  why: string;
  added: boolean;
}

// --- Traveler brief & profile ---------------------------------------------

export type Confidence = "high" | "medium" | "low";

export interface Brief {
  opening: string;
  days?: number;
  flexibleDuration?: boolean;
  vibes: Vibe[];
  pace?: Pace;
  budgetUsd?: number;
  flexibleBudget?: boolean;
  /** Budget was read from a phrase, not a number. Say so rather than assume. */
  budgetInferred?: string;
  /** Raw free text of what they don't want. */
  constraints: string[];
  /** Tags parsed out of constraints — hard avoids. */
  avoidTags: Tag[];
  /** They declined to state a preference and asked us to choose. */
  surpriseMe?: boolean;
  /** They asked for sun, a beach, or warmth. A climate request, not a vibe. */
  wantsWarm?: boolean;
  /** They asked to be somewhere genuinely unlike home. Distance is the point. */
  wantsFar?: boolean;
  /** The opposite: they've said the last suggestion was too far to be worth it. */
  wantsNear?: boolean;
  /**
   * Where they're flying from, guessed from the browser's timezone. Airfare in
   * the catalogue is seeded from San Francisco; this is what makes that an
   * assumption we state and correct rather than one we hide.
   */
  origin?: Origin;
  /** Destination they named themselves, if any. */
  namedDestination?: string;
  /**
   * They named a CITY, not the country around it.
   *
   * "oaxaca" resolves to the Mexico pack because that is where the data lives,
   * and the shape builder then did what it does for Mexico: picked the hub,
   * added a second base, and produced "Mexico City & Oaxaca" for someone who
   * had asked for Oaxaca. Naming a city is naming the whole trip.
   */
  focusCityId?: string;
  /** A place they named that isn't in the catalogue. Never silently dropped. */
  unknownDestination?: string;
  /**
   * They named more than one. "Croatia or southern France" is a shortlist to
   * decide between, not a first match to keep and a second to throw away.
   */
  candidates?: string[];
  unknownCandidates?: string[];
  /**
   * A region they named: Europe, Scandinavia, the Balkans. A filter over the
   * catalogue rather than a destination. `regionIds` empty means we hold
   * nothing inside it, which is a research prompt, not a dead end.
   */
  region?: string;
  regionLabel?: string;
  regionIds?: string[];
  /** They want to drive it. A shape, not a place. */
  roadTrip?: boolean;
  /**
   * They asked to leave the country. A hard filter, not a preference: being
   * told "that just doesn't settle it on its own" after saying it, and then
   * being shown Utah again, is the app arguing with her.
   */
  wantsInternational?: boolean;
  /** Why they picked it, when they told us — a fandom, an obsession, a reason. */
  interestEcho?: string;
  /**
   * Places they've already been. Section 34 in reverse: the agent is allowed
   * to say no, and so are they, permanently. "I've been to Zion" has to ban
   * Zion, or the next three replies recommend it anyway.
   */
  visitedIds?: string[];
  /** What they actually said, including places we don't hold. */
  visitedNames?: string[];
  /** We've already told them we don't cover it; don't ask twice. */
  unknownAcknowledged?: boolean;
  /**
   * Subjects we have actually gone and tried to research, successful or not.
   *
   * The gate used to read a boolean, and a parser that had done no work at
   * all could set it. This records events rather than confidence: a name only
   * appears here after a research attempt has been made for it.
   */
  researchTried?: string[];
  /** Stated travel dates. Carries the calendar, not just the length. */
  dates?: { start: string; end: string };
  /**
   * A dated event the whole trip is built around: an eclipse, a festival, a
   * race, a wedding.
   *
   * "i wanna plan a trip to see the solar eclipse next year in egypt" got a
   * pitch naming the total eclipse of 2 August 2027 and an itinerary starting
   * on 24 October of this year. The model knew the date, said it out loud,
   * and nothing carried it into the brief, so the planner used its default of
   * "a few weeks from now" and built a trip that misses the only thing she
   * asked for by twenty-one months.
   */
  anchorDate?: string;
  anchorEvent?: string;
  month?: string;
}

export function emptyBrief(opening = ""): Brief {
  return { opening, vibes: [], constraints: [], avoidTags: [] };
}

export type PrefSource = "explicit" | "learned";

export interface Preference {
  id: string;
  text: string;
  source: PrefSource;
  /** How many observations back this (learned only). */
  observations?: number;
  muted?: boolean;
}

export interface TravelerProfile {
  preferences: Preference[];
  /** Explicitly turned down. Never offered again. */
  rejectedPlaceIds: string[];
  /** Cut to reduce pace. Can come back, but only after fresh options. */
  deprioritizedPlaceIds: string[];
  avoidTags: Tag[];
  favorTags: Tag[];
  /**
   * Destinations already pitched, oldest first. "Surprise me" was a pure
   * function of the brief, so ten clicks returned one answer. Knowing what it
   * has already offered is what makes a second surprise possible.
   */
  seenDestinationIds: string[];
  /** Turned down at the pitch. Weighted against hard, never banned outright. */
  rejectedDestinationIds: string[];
  /** Already been. Never offered again — this one IS a ban. */
  visitedDestinationIds: string[];
  /**
   * What they keep choosing, accumulated across trips. Signed: turning down a
   * destination as "not my kind of place" pushes its strengths negative, so
   * saying no teaches it as much as saying yes. Used only when they state
   * nothing themselves, which is exactly when the agent has to guess.
   */
  vibeLeanings: Partial<Record<Vibe, number>>;
  /**
   * How they want to travel between bases, once they have said.
   *
   * Asked once and kept, rather than decided silently on their behalf. The
   * app used to pick for them and pick wrong: every leg it did not have real
   * data for became a train, including an 11-hour one to a city with no
   * railway. Deciding quietly is what made that possible.
   */
  transport?: TransportMode;
  /** Trips taken through to an itinerary. Shown so the memory is legible. */
  tripsPlanned: number;
  /**
   * Stable per-traveller seed, created once. Only ever used to break ties that
   * are ties: without it every first-time traveller who says "surprise me"
   * gets the identical answer, because a 0.4% score gap is not a decision.
   * Absent server-side, so evals stay deterministic.
   */
  seed?: number;
}

export function emptyProfile(): TravelerProfile {
  return {
    preferences: [], rejectedPlaceIds: [], deprioritizedPlaceIds: [],
    avoidTags: [], favorTags: [],
    seenDestinationIds: [], rejectedDestinationIds: [], visitedDestinationIds: [],
    vibeLeanings: {}, tripsPlanned: 0,
  };
}
