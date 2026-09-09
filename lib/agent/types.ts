import type { Stay } from "@/lib/stays";
import type { Origin } from "@/lib/origin";
import type { Brief, City, Destination, Pace, Tag, Trip, Vibe, Confidence, TripShapeLeg } from "@/lib/types";

export interface QuestionOption {
  value: string;
  label: string;
}

export type QuestionId =
  | "duration" | "vibes" | "pace" | "budget" | "constraints" | "tiebreak"
  | "unknown_place"
  /** Authored by the model to understand them, not to fill a field. */
  | "open";

export interface Question {
  id: QuestionId;
  prompt: string;
  kind: "single" | "multi" | "text";
  options?: QuestionOption[];
  /** Free text is always accepted; this drives whether we show chips at all. */
  hint?: string;
  /**
   * The chips are natural language, not slot values, so an answer goes back
   * through interpret exactly as if it had been typed. This is what lets the
   * model ask "beachy, or more history?" and have the answer land as vibes.
   */
  freeform?: boolean;
}

export interface Turn { from: "agent" | "user"; text: string }

/**
 * Discovery decides WHERE. Logistics decides how long and how much, and only
 * matters once there is a destination to plan. Asking budget before anyone
 * has agreed on a country is a form.
 */
export type Phase = "discovery" | "logistics";

/** A partial update to the brief, produced by interpreting free text. */
export interface BriefPatch {
  days?: number;
  flexibleDuration?: boolean;
  vibes?: Vibe[];
  /** Vibes to take back out: negated, or stated as not mattering. */
  removeVibes?: Vibe[];
  pace?: Pace;
  budgetUsd?: number;
  flexibleBudget?: boolean;
  budgetInferred?: string;
  constraints?: string[];
  surpriseMe?: boolean;
  wantsWarm?: boolean;
  wantsFar?: boolean;
  wantsNear?: boolean;
  avoidTags?: Tag[];
  /** Places she ruled out, in her words. See Brief.avoidPlaces. */
  avoidPlaces?: string[];
  namedDestination?: string;
  /** They named a city, so the city is the trip. */
  focusCityId?: string;
  candidates?: string[];
  unknownCandidates?: string[];
  region?: string;
  regionLabel?: string;
  regionIds?: string[];
  roadTrip?: boolean;
  wantsInternational?: boolean;
  /** What she wants to do, her words, one per entry. See Brief.activities. */
  activities?: string[];
  visitedIds?: string[];
  visitedNames?: string[];
  unknownAcknowledged?: boolean;
  researchTried?: string[];
  origin?: Origin;
  dates?: { start: string; end: string };
  anchorDate?: string;
  anchorEvent?: string;
  month?: string;
}

export interface Recommendation {
  destinationId: string;
  confidence: Confidence;
  /** Nothing in the catalogue actually fits the brief; this is the least-bad. */
  noGoodFit?: string;
  /** It fits the number and the dates, but has little of what they asked for. */
  weakFor?: string;
  /** Runner-up, present when confidence is not high. */
  alternativeId?: string;
  /** Scores for transparency and for the eval harness. */
  scores: { id: string; score: number }[];
}

export type EditOp =
  | { kind: "remove_tag"; tag: Tag; day?: number }
  | { kind: "remove_item"; itemId: string }
  | { kind: "reduce_pace"; day?: number; removeCount?: number }
  | { kind: "increase_pace"; day?: number }
  | { kind: "more_tag"; tag: Tag; count?: number; day?: number }
  | { kind: "less_touristy" }
  | { kind: "add_downtime"; day?: number; part?: "morning" | "afternoon" | "evening" }
  | { kind: "extend_stay"; cityId: string; nights: number }
  | { kind: "set_budget"; usd: number }
  /** "Make it cheaper" with no figure: anchor to the quote we just gave. */
  | { kind: "cheaper" }
  | { kind: "unknown"; text: string };

/**
 * The seam between judgment (swappable: rules today, LLM when a key exists)
 * and arithmetic (never swappable: scheduling, opening hours, budget, critic).
 */
/**
 * A destination the server doesn't hold.
 *
 * The catalogue is a cache, and a researched destination is only ever put into
 * the browser's copy of it. The server's arrays never learn about Yunnan, so
 * `destinationById("yunnan")` came back undefined and the pitch and the room
 * booking both died on "Cannot read properties of undefined". They fell back
 * to rules prose, and the badge said "model failed" on every single researched
 * trip.
 *
 * Passed per call rather than registered globally: this process is shared by
 * everyone using the deployment, and one traveller's research has no business
 * appearing in another's recommendations.
 */
export interface PlaceContext {
  destination: Destination;
  cities: City[];
}

export interface AgentDriver {
  readonly name: string;
  interpret(input: string, brief: Brief): Promise<BriefPatch>;
  /**
   * `history` is the recent transcript. Without it the model can only rewrite
   * a slot label, which is a questionnaire with better prose. With it, it can
   * follow up on what was actually said.
   */
  nextQuestion(brief: Brief, history?: Turn[], phase?: Phase): Promise<Question | null>;
  pitch(rec: Recommendation, brief: Brief, place?: PlaceContext): Promise<{ headline: string; body: string }>;
  parseEdit(input: string, trip: Trip): Promise<EditOp[]>;
  describeEdit(ops: EditOp[], summary: string[]): Promise<string>;
  /**
   * Go and get a destination the catalogue doesn't hold. Optional: the rules
   * driver genuinely cannot do this, and saying so is better than pretending.
   */
  research?(place: string, days: number | undefined, origin?: string, interests?: string): Promise<ResearchResult>;
  /**
   * Research, split across two HTTP requests. Both steps in one request took
   * longer than a serverless function is allowed to live, so each gets its own
   * budget: search and take notes, then structure the notes.
   */
  researchNotes?(place: string, days: number | undefined, origin?: string, interests?: string, avoid?: string[]): Promise<ResearchNotes>;
  researchStream?(
    place: string, days: number | undefined, origin: string | undefined,
    onChunk: (text: string) => void, interests?: string, avoid?: string[],
  ): Promise<ResearchNotes>;
  researchPack?(place: string, days: number, notes: string, sources: string[], interests?: string): Promise<ResearchResult>;
  /**
   * One base, filled in properly. Run once per city, all at the same time:
   * output tokens are what caps a research call, so three calls of a dozen
   * places cost about the wall-clock of one and produce three times as much.
   */
  researchPlaces?(
    destinationName: string, cityId: string, cityName: string,
    count: number, interests?: string, notes?: string,
  ): Promise<{ places: unknown; problem?: string }>;
  /**
   * Where would you send them, anywhere on earth?
   *
   * The recommender scores the catalogue, and the catalogue was the world:
   * the model's own suggestions were filtered against it and anything else
   * dropped, so "surprise me" could only ever return one of the entries we
   * already held, forever. Someone who wanted Oregon or Florida or Alaska
   * would never be offered them, and adding four more entries by hand would
   * not have changed that.
   *
   * So this asks with no list attached. If the answer is somewhere we hold,
   * it is planned instantly. If it is not, it is researched and joins the
   * catalogue like anywhere else. Only ever called when the traveller has
   * named nowhere themselves: naming a place or a region still decides it
   * outright.
   */
  suggest?(brief: Brief): Promise<{ place?: string; why?: string; problem?: string }>;
  /** Named places to sleep, one per base, with backups. */
  stays?(shape: TripShapeLeg[], brief: Brief, destinationId: string, place?: PlaceContext): Promise<Stay[]>;
}

export interface ResearchNotes {
  text?: string;
  sources?: string[];
  problem?: string;
}

export interface ResearchResult {
  pack?: import("@/lib/research").DestinationPack;
  /** Why it didn't work, in words a traveller can read. */
  problem?: string;
}
