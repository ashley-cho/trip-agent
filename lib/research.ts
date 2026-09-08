import type { City, Destination, Outing, Pace, Place, PlaceKind, Tag, TimeOfDay, Vibe } from "@/lib/types";
import { ALL_VIBES } from "@/lib/types";

/**
 * Researching a destination the catalogue doesn't have.
 *
 * The 394 hand-written places were meant to be a seed and became a boundary:
 * asking for Patagonia got a fifteen-item menu of unrelated countries, which
 * is the questionnaire the whole product exists to avoid. So the catalogue is
 * a cache now. When someone names somewhere we don't hold, the model goes and
 * gets it with web search, and the result is registered in the same shape as
 * the hand-written data.
 *
 * What does NOT move: the planner, the critic, the opening-hours logic and the
 * cost model all still run deterministically over whatever comes back. The
 * model supplies facts; it never does the scheduling or the arithmetic.
 */

export const TAGS: Tag[] = [
  "history", "art", "architecture", "food", "wine", "coffee", "market",
  "nature", "coast", "viewpoint", "walk", "nightlife", "music",
  "museum", "shopping", "beach", "hike", "garden", "contemporary",
  "local", "iconic", "castle", "church", "boat", "spa", "earlystart",
  "adventure", "film",
];
const KINDS: PlaceKind[] = ["sight", "meal", "drink", "walk", "outdoor", "museum", "market", "experience"];
const TIMES: TimeOfDay[] = ["morning", "midday", "afternoon", "evening", "any"];
const PACES: Pace[] = ["relaxed", "light", "mixed", "busy"];

export interface DestinationPack {
  destination: Destination;
  cities: City[];
  places: Place[];
  /** What they came to do. See the Outing comment in types.ts. */
  outings: Outing[];
  /** Where the facts came from, shown to the traveller. */
  sources: string[];
}

export const RESEARCH_SYSTEM = `You are a travel agent who has been doing this for twenty years, answering someone who has just told you where they want to go.

Your answer has two parts, and only the first is shown to them.

PART ONE. Two or three sentences, to them, in your voice. What you actually think of the place for the trip they described, and the shape you'd give it: which bases, how many nights each. Nothing else. No preamble, no narrating that you're looking things up. This is all they read while the rest is being turned into their day-by-day plan, so it has to stand on its own and it has to be short.

Then a line containing only three hyphens.

PART TWO. The working detail, for the scheduler rather than for them. Six to eight specific places across the bases (each base gets filled in properly by a separate pass right after this, so this is the spine, not the whole trip, and running out of room before you finish this list costs the traveller the whole destination), each with rough coordinates, how long it takes, what it costs, opening hours if you're confident of them, and one honest line. Include meals and evenings, not just sights. Say what you'd skip. Then roughly what a night costs in each base, the flight cost, the cheapest credible day, how warm it is, and the real downside of going.

Be specific and opinionated throughout. Banned: "hidden gem", "vibrant", "nestled", "bustling", "must-see", "gateway to", "something for everyone", "immerse yourself", "picturesque", "charming", "stunning", "breathtaking". No stacked adjectives. No em dashes. Short sentences.

PART TWO ALSO NAMES THE DAYS. Before the places, list what they will actually spend their days doing, one entry per day-sized thing, with its real door-to-door hours and where you would have to sleep the night before to start it. Name it the way a person on the ground names it: Base Torres, Valle Frances, Mirador Grey, the Grey glacier boat. Not "hiking in the park", not the town nearest to it.

This matters most exactly when the point of the trip is outside the towns. Torres del Paine is the trip; Puerto Natales is only the bed. A safari is the Mara, not Nairobi. A trek is the pass, not the village with the bakery. Answering with the town is how someone who asked to hike for a week gets museums and a supermarket, and it is the single worst thing you can do here. If the days really are inside the towns, as they are in Lisbon or Seoul, then say so with a short list or none at all; do not pad it.

Where you are unsure of a current opening time or price, say so rather than inventing one. A plan built on a wrong opening time is wrong everywhere it touches.`;

/**
 * Step two's system prompt. No searching here, and the schema tool is forced,
 * so the whole call is spent producing the object. Splitting it this way is
 * what makes research finish: one call could not both search and write the
 * pack inside a serverless function's budget.
 */
export const STRUCTURE_SYSTEM = `You are turning research notes into the working data a scheduler needs.

Use only what the notes contain. Do not invent places, and do not add hours or prices the notes don't give — a missing value is read as "open", which is safer than a wrong one.

Coordinates must be accurate to the building. Getting these wrong makes the agent schedule a two-hour walk as a ten-minute one.

Spread the places across a day: mornings, meals, evenings. Twelve museums cannot be turned into a week. Six to eight is the right number HERE, because each base is filled in properly by a separate pass straight after this one. Getting the bases and the shape right matters far more than the length of this list, and a list so long it gets cut off mid-way is worse than a short one.

outings are the days themselves, and they are the reason this call exists. Take every day-sized thing the notes named, with its hours and the places it can be started from, and put it in "outings". An outing is not somewhere you sleep, it is somewhere you go.

While the scheduler is still being moved onto outings, a bedless place must ALSO appear in "cities" with dayTripOnly true, hanging off the base it is reached from. Both, not one or the other: "outings" is what will carry it, "cities" is what carries it today, and a place that appears only in "outings" currently vanishes from the trip entirely. This is temporary and this note goes when the planner reads outings.

The failure this is here to stop: notes describing a week of walking in Torres del Paine, structured as two towns and their restaurants, because the towns were the only things that looked like a legal answer. If the notes name a route and the schema has nowhere to put it, that is what "outings" is.

notes are the agent's voice: one sentence, specific, opinionated, no travel-blog prose. Never "hidden gem", "vibrant", "nestled", "must-see", "stunning". You are allowed to be negative about a famous thing, and to mark 'skip: true' on something you would steer them away from.`;

/*
 * `days` is undefined when she has not told us a length, and that is not the
 * same as a week.
 *
 * effectiveDays() resolves an unset length to 7 so the planner has a number to
 * do arithmetic with, which is right. Handing that 7 to the researcher as
 * though she had said it is not. She wrote "i wanna go abroad to hike",
 * "proper mountains, altitude and challenge", "multi-day remote trek", and was
 * told "Seven days door to door does not get you to Everest Base Camp itself,
 * not safely anyway" and that "cramming it into six nights is how people get
 * medevac'd out with pulmonary edema". She never gave a length. The app
 * invented one, quoted it at her, and then used it to rule out the exact trip
 * she had asked for.
 */
export function researchPrompt(
  place: string, days: number | undefined, origin?: string, interests?: string,
): string {
  const from = origin ?? "the United States";
  return [
    days
      ? `They want to go to ${place}, for about ${days} days, flying from ${from}.`
      : [
          `They want to go to ${place}, flying from ${from}. They have NOT told you how long they have.`,
          ``,
          `So do not state a trip length, and do not rule the place in or out on`,
          `one. Telling them a trip is too short, when they never said how long`,
          `it was, is a verdict about a number nobody gave you: it refuses the`,
          `thing they asked for on your own invented premise. If the length is`,
          `what decides whether this works,`,
          `say that plainly and say what the realistic lengths buy, then plan`,
          `the shape for about a week because that is what we plan against`,
          `until they say otherwise. Never write the number back at them as`,
          `something they chose.`,
        ].join("\n"),
    // Without this the model writes the country's default tourist route and
    // ignores the person entirely. Asked for hiking in China, it came back
    // with Beijing, Xi'an and Shanghai, which is the itinerary you would get
    // from a guidebook index and has no hiking in it at all.
    interests
      ? [
          ``,
          `THIS IS WHAT THEY ASKED FOR, and it decides which part of ${place} you send them to:`,
          interests,
          ``,
          `Pick the cities and the places that serve that. If the famous route`,
          `does not serve it, do not send them on the famous route: a country`,
          `is not one itinerary. If what they want genuinely isn't good in`,
          `${place}, say so plainly in the verdict rather than quietly`,
          `substituting the standard trip.`,
        ].join("\n")
      : "",
    ``,
    // The verdict is prose, the plan is arithmetic, and they were allowed to
    // disagree. "Edmonton for two nights, then Yellowknife for five" was
    // written for a seven-day trip and built as Edmonton 1, Yellowknife 4,
    // Edmonton 1: seven nights promised, six nights possible, and a return
    // leg the sentence never mentioned. She reads the sentence first, so the
    // sentence has to be true.
    days
      ? [
          `${days} days is ${days - 1} nights. If you name a split, make the nights`,
          `add up to ${days - 1}.`,
        ].join("\n")
      : `If you name a split, make its nights add up to one fewer than the days it covers.`,
    `They also fly home from the airport they flew`,
    `into, so if the last base is more than a couple of hours from it, the`,
    `final night goes back there and your split should say so.`,
    ``,
    `Part one is streamed onto their screen as you write it, so open with the`,
    `verdict, keep it to two or three sentences, and stop. Then the three`,
    `hyphens. Then everything the scheduler needs.`,
  ].filter(Boolean).join("\n");
}

/** Everything before the fence is for the traveller; the rest is working detail. */
export const VERDICT_FENCE = /\n\s*-{3,}\s*(\n|$)/;

export function splitVerdict(text: string): { verdict: string; detail: string } {
  const m = text.match(VERDICT_FENCE);
  if (!m || m.index === undefined) return { verdict: text.trim(), detail: text.trim() };
  return {
    verdict: text.slice(0, m.index).trim(),
    detail: text.slice(m.index + m[0].length).trim(),
  };
}

/**
 * Places, validated the same way wherever they came from.
 *
 * Pulled out of `validatePack` because the places now arrive from two kinds of
 * call: the one that establishes the destination, and one per base afterwards.
 * Both must be held to the same standard, and a second copy of this logic
 * would drift within a week.
 */
/** The shape of a place, shared by the destination call and the per-city ones. */
const PLACE_SCHEMA = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      id: { type: "string" }, cityId: { type: "string" }, name: { type: "string" },
      kind: { type: "string", enum: KINDS },
      tags: { type: "array", items: { type: "string", enum: TAGS } },
      neighborhood: { type: "string" },
      lat: { type: "number" }, lng: { type: "number" },
      durationMin: { type: "number" }, costUsd: { type: "number" },
      opens: { type: "string", description: "HH:MM, 24h" },
      closes: { type: "string", description: "HH:MM, 24h" },
      closedDays: {
        type: "array", items: { type: "number" },
        description: "Weekdays it is SHUT, 0 = Sunday. This is how you say 'Fridays only' (that is [0,1,2,3,4,6]) or 'closed Mondays' ([1]). Put it here, not only in the note: the note is prose and nothing can schedule against it.",
      },
      bestTime: { type: "string", enum: TIMES },
      touristy: { type: "number" },
      note: { type: "string" },
      skip: { type: "boolean", description: "Famous and not worth their time. Say why in the note." },
    },
    required: ["id", "cityId", "name", "kind", "tags", "neighborhood", "lat", "lng",
               "durationMin", "costUsd", "bestTime", "touristy", "note"],
  },
};

const DAY_NAMES = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)s?\b/gi;
const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const daysIn = (text: string): number[] => {
  const out = new Set<number>();
  for (const m of text.matchAll(DAY_NAMES)) {
    const i = DAY_INDEX[m[1].toLowerCase().slice(0, 3)];
    if (i !== undefined) out.add(i);
  }
  return [...out];
};

/**
 * The days a place is shut, read out of the sentence the model wrote about it.
 *
 * The scheduler has honoured `closedDays` all along and the critic checks it.
 * The researcher just doesn't fill it in: asked for "opening hours where you
 * are confident", it writes the hours of the DAY and puts the rest in prose.
 * So Odprta Kuhna went into a Slovenian itinerary on a Monday, carrying its
 * own note saying "Fridays only, roughly March to October" — the fact was
 * right there on the card, in a field nothing can schedule against.
 *
 * This is the seam the whole app is built on: the model supplies the fact, the
 * arithmetic stays deterministic. A weekday constraint is a fact; which day it
 * lands on is arithmetic. Deliberately conservative — an unrecognised sentence
 * returns nothing and the place keeps whatever it was given.
 */
export function closedDaysFromNote(note: string): number[] | undefined {
  const t = note.toLowerCase();
  if (/\bweekends?\s+only\b/.test(t)) return [1, 2, 3, 4, 5];
  if (/\bweekdays?\s+only\b/.test(t)) return [0, 6];

  const only = t.match(/([a-z,&\s-]{3,60}?)\s+only\b/) ?? t.match(/\bonly\s+(?:on\s+)?([a-z,&\s-]{3,40})/);
  if (only) {
    const open = daysIn(only[1]);
    if (open.length && open.length < 7) {
      return [0, 1, 2, 3, 4, 5, 6].filter((d) => !open.includes(d));
    }
  }

  const shut = t.match(/\bclosed\s+(?:on\s+)?([a-z,&\s-]{3,40})/);
  if (shut) {
    const d = daysIn(shut[1]);
    if (d.length && d.length < 7) return d;
  }
  return undefined;
}

export function validatePlaceList(
  raw: unknown, destinationId: string, cities: City[], existing: Place[] = [],
): { places: Place[]; problems: string[] } {
  const problems: string[] = [];
  const places: Place[] = [];
  const ids = new Set(cities.map((c) => c.id));
  const seen = new Set(existing.map((p) => p.id));
  // The per-city calls don't know what the first call already found, so the
  // same restaurant coming back twice is expected rather than exceptional.
  const seenNames = new Set(existing.map((p) => `${p.cityId}|${p.name.toLowerCase()}`));

  for (const p of (Array.isArray(raw) ? raw : []) as Record<string, unknown>[]) {
    const pid = slug(p.id);
    const pname = str(p.name, 80);
    /*
     * The city id arrives in one of two shapes, and for months only one of
     * them worked.
     *
     * The destination call writes short ids ("torshavn") and this prefixes
     * them. The per-base call is TOLD the full id, because the prompt says
     * `use cityId exactly "faroe-islands-torshavn"`, and prefixing that again
     * produced "faroe-islands-faroe-islands-torshavn", which matches no city,
     * so every single place was dropped as "not in a city we have".
     *
     * Every place from every per-base call, silently, since the fan-out
     * shipped. The whole point of that fan-out is to turn a spine into a full
     * trip, and it had never once contributed a place: hence itineraries
     * running at one thing a day, and researched destinations being abandoned
     * for having too little in them.
     */
    const said = slug(p.cityId);
    const cityId = said
      ? (ids.has(said) ? said : `${destinationId}-${said}`)
      : undefined;
    const lat = num(p.lat, -90, 90);
    const lng = num(p.lng, -180, 180);
    const kind = oneOf(p.kind, KINDS);
    const note = str(p.note, 300);
    if (!pid || !pname || !cityId || !ids.has(cityId) || lat === undefined || lng === undefined || !kind || !note) {
      problems.push(`dropped "${String(p.name ?? "?")}": incomplete or not in a city we have`);
      continue;
    }
    const key = `${destinationId}-${pid}`;
    const nameKey = `${cityId}|${pname.toLowerCase()}`;
    if (seen.has(key) || seenNames.has(nameKey)) continue;
    seen.add(key);
    seenNames.add(nameKey);

    const tags = (Array.isArray(p.tags) ? p.tags : [])
      .map((t) => oneOf(t, TAGS)).filter(Boolean) as Tag[];
    const opens = str(p.opens, 5);
    const closes = str(p.closes, 5);
    places.push({
      id: key,
      cityId,
      name: pname,
      kind,
      tags: tags.length ? tags : ["local"],
      neighborhood: str(p.neighborhood, 60) ?? cities.find((c) => c.id === cityId)!.name,
      lat, lng,
      durationMin: num(p.durationMin, 15, 480, 90)!,
      costUsd: num(p.costUsd, 0, 1000, 0)!,
      // A malformed time is worse than no time: the scheduler would parse it
      // to NaN and place the item at midnight.
      opens: opens && HHMM.test(opens) ? opens : undefined,
      closes: closes && HHMM.test(closes) ? closes : undefined,
      // Whatever it filled in, plus whatever its own sentence admits. The
      // model routinely states the constraint in prose and leaves the field
      // empty, and an empty field means "open every day" to the scheduler.
      closedDays: (() => {
        const given = (Array.isArray(p.closedDays) ? p.closedDays : [])
          .map((d) => num(d, 0, 6)).filter((d): d is number => d !== undefined);
        if (given.length) return given;
        return closedDaysFromNote(note) ?? [];
      })(),
      bestTime: oneOf(p.bestTime, TIMES) ?? "any",
      touristy: (num(p.touristy, 1, 5, 3)! as 1 | 2 | 3 | 4 | 5),
      note,
      ...(p.skip === true ? { skip: true as const } : {}),
    });
  }
  return { places, problems };
}

/**
 * How much material a trip of this length actually needs.
 *
 * The old instruction was a flat "ten to twelve places is enough", written
 * when a single research call was timing out. It is right for a long weekend
 * and badly wrong for two weeks: ten places across three bases over twelve
 * days is one thing a day, which is what shipped.
 *
 * Output tokens are the real ceiling, not the model's willingness, so the
 * answer is not to ask one call for forty. It is to ask each base for its own
 * dozen, at the same time.
 */
export function placesPerCity(days: number, cityCount: number): number {
  const wanted = Math.round(days * 3.5);
  return Math.min(14, Math.max(8, Math.round(wanted / Math.max(1, cityCount))));
}

export const PLACES_SYSTEM = `You are a travel agent filling in what there is to do in ONE city, for a traveller whose trip you have already decided on.

Specific places with real names. Not "a local restaurant", not "the old town": the name a taxi driver would recognise. Coordinates to four decimal places, how long it takes, what it costs per person, opening hours only where you are confident, and one honest line about why it is worth their time or what is annoying about it. If it only runs on certain days, or shuts on certain days, that goes in closedDays as well as the note — a market that happens on Fridays will otherwise be scheduled on a Monday.

If what you are filling in is a park, reserve or trail area rather than a town, this list is named routes: the trailhead they start from, the distance, the elevation gain, and the real round-trip hours, with durationMin set to the whole day where it is a whole day. Not "hiking in the park". Base Torres, Valle Frances, Mirador Grey. Include the short one for the day the wind shuts the high ground. Do not pad it with the nearest town's restaurants; the town has its own entry.

Spread across a day and across a trip: mornings, sit-down meals, evenings, walks, things to do when it rains. A list of twelve sights cannot be turned into four days, because nobody eats nothing and sees twelve churches.

Include the ones you would tell them to skip, marked as skipped, with the reason. That is more useful than silence.

Never invent a place. If you are not confident something exists under that name in that city, leave it out. Fewer real places beats a full list with two inventions in it.

No travel-blog prose. Banned: "hidden gem", "nestled", "must-see", "charming", "stunning", "vibrant", "bustling". No em dashes.`;

export function placesPrompt(
  destinationName: string, cityId: string, cityName: string,
  count: number, interests?: string, notes?: string,
): string {
  return [
    `Fill in ${cityName}, in ${destinationName}.`,
    ``,
    `Give me ${count} places. Use cityId exactly "${cityId}" for every one of them.`,
    interests ? `\nWhat this traveller asked for, which decides what belongs on the list: ${interests}` : "",
    notes ? `\nWhat you already said about this trip, so you don't contradict it:\n${notes.slice(0, 4000)}` : "",
  ].filter(Boolean).join("\n");
}

export const PLACES_TOOL = {
  name: "record_places",
  description: "Specific, real places in one city.",
  input_schema: {
    type: "object" as const,
    properties: { places: PLACE_SCHEMA },
    required: ["places"],
  },
};

const OUTING_SCHEMA = {
  type: "array" as const,
  description: "The day-sized things they came to do. Empty only when the days genuinely happen inside the towns.",
  items: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "As a person on the ground says it: 'Base Torres', 'Valle Frances', 'the Grey glacier boat'. Never 'hiking in the park'." },
      hours: { type: "number", description: "Door to door, including the drive to the start. Be honest: a 9 means it is the whole day." },
      startsFrom: {
        type: "array",
        description: "Where they could sleep the night before and still start on time. Name the towns, huts or lodges, with coordinates. This is what decides where they stay, so a wrong one puts them three hours from the trailhead at dawn.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" }, lat: { type: "number" }, lng: { type: "number" },
          },
          required: ["name", "lat", "lng"],
        },
      },
      why: { type: "string", description: "One honest line. What it is, and what is hard about it." },
      km: { type: "number" },
      gainM: { type: "number", description: "Metres of ascent." },
      costUsd: { type: "number", description: "Per person, including permits and shuttles. 0 if free." },
      season: { type: "string", description: "When it is actually on, e.g. 'November to March'." },
      fallback: { type: "string", description: "The short version for the day the weather shuts the long one." },
    },
    required: ["name", "hours", "startsFrom", "why"],
  },
};

export const RESEARCH_TOOL = {
  name: "record_destination",
  description: "The working data for one destination, in the agent's own schema.",
  input_schema: {
    type: "object" as const,
    properties: {
      id: { type: "string", description: "lowercase slug, no spaces" },
      name: { type: "string", description: "How a person refers to it" },
      pitch: { type: "string", description: "One sentence. The verdict, not a brochure." },
      strengths: {
        type: "object",
        description: "0-5 per vibe. Be honest; flat fives make it unrankable.",
        properties: Object.fromEntries(ALL_VIBES.map((v) => [v, { type: "number" }])),
      },
      paceFit: { type: "array", items: { type: "string", enum: PACES } },
      flightUsd: { type: "number", description: "Round trip from San Francisco, economy, USD" },
      floorPerDayUsd: { type: "number", description: "Cheapest credible day on the ground" },
      minDays: { type: "number", description: "Below this it isn't worth the flight" },
      warmth: { type: "number", description: "1 you will not sunbathe, 5 reliably hot" },
      arrival: { type: "string", enum: ["fly", "drive"] },
      caveat: { type: "string", description: "The real downside. One sentence." },
      because: {
        type: "object",
        description: "One sentence per vibe this place is actually strong at.",
        properties: Object.fromEntries(ALL_VIBES.map((v) => [v, { type: "string" }])),
      },
      cities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" }, name: { type: "string" },
            lat: { type: "number" }, lng: { type: "number" },
            nightlyUsd: { type: "number" },
            minNights: { type: "number" }, maxNights: { type: "number" },
            base: { type: "string", description: "The neighbourhood you'd put them in, and why" },
            scale: { type: "string", enum: ["walkable", "driving"] },
            dayTripOnly: { type: "boolean", description: "True for somewhere they visit from a base and do not sleep in: a national park, a trailhead, a ruin, an island, a valley. Set this rather than leaving the place out, and rather than substituting the nearest town for it. A place with no beds is still an entry." },
            dayTripFrom: { type: "string", description: "id of the base it hangs off" },
            transitFromHubMin: { type: "number" },
            transitFromHubUsd: { type: "number" },
            transitMode: { type: "string", enum: ["train", "bus", "car", "ferry"] },
          },
          // nightlyUsd and the night counts are deliberately not required: a
          // park has no beds, and requiring them told the model a bedless
          // place was illegal, so it sent the nearest town instead and the
          // trip lost the thing it was for. Validation defaults them.
          required: ["id", "name", "lat", "lng", "base"],
        },
      },
      outings: OUTING_SCHEMA,
      places: PLACE_SCHEMA,
    },
    // outings is required so that a trip whose substance is outside the towns
    // has somewhere to put it. An empty array is a legal answer, and the right
    // one for a city break; silently having nowhere to put a route is not.
    required: ["id", "name", "pitch", "strengths", "paceFit", "flightUsd", "floorPerDayUsd",
               "minDays", "warmth", "arrival", "caveat", "because", "cities", "outings", "places"],
  },
};

// --- validation ------------------------------------------------------------
// Everything below assumes the model is wrong until proved otherwise. The
// planner does real arithmetic on these numbers, so a string where a latitude
// belongs doesn't produce a bad suggestion, it produces a broken itinerary.

const num = (v: unknown, lo: number, hi: number, fallback?: number): number | undefined => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return fallback;
  return n;
};
const str = (v: unknown, max = 400): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : undefined;
};
const slug = (v: unknown): string | undefined => {
  const s = str(v, 40);
  return s ? s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined;
};
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const oneOf = <T extends string>(v: unknown, allowed: T[]): T | undefined =>
  typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : undefined;

export interface ValidationResult {
  pack?: DestinationPack;
  problems: string[];
}

/**
 * How many real places a trip of this length needs before it can be planned
 * without blank afternoons.
 *
 * Roughly two a day: a trip is mornings and evenings and meals, not a list of
 * sights. Capped, because a fortnight does not need forty before the planner
 * can start, and floored, because two days still needs somewhere to eat.
 */
export function placesNeeded(days: number): number {
  return Math.max(4, Math.min(20, Math.round(days * 2)));
}

/** Whether a finished pack, bases and all, can carry a trip of this length. */
export function enoughToPlan(pack: DestinationPack, days: number): boolean {
  return usablePlaces(pack) >= placesNeeded(days);
}

export const usablePlaces = (pack: DestinationPack) =>
  pack.places.filter((p) => !p.skip).length;

/**
 * The point below which a researched destination is genuinely not plannable.
 *
 * Distinct from placesNeeded, and it has to be, because those two numbers were
 * the same one and it cost a traveller the Faroe Islands. She asked for seven
 * days; the research came back with a good three-base shape and a real spine;
 * two of the three per-base calls then failed; the total landed under the
 * fourteen that a comfortable week wants, and the whole country was thrown
 * away and replaced with Paris.
 *
 * A week with one solid thing a day is a real trip, and downtime is a feature
 * of this product rather than a gap in it. Sending someone to a different
 * continent because the second half of the list didn't arrive is not.
 *
 * So: placesNeeded decides whether to go and fetch MORE. This decides whether
 * to give up, and it is much lower.
 */
export function minimumToPlan(days: number): number {
  return Math.max(4, Math.min(10, days));
}

export const plannable = (pack: DestinationPack, days: number) =>
  usablePlaces(pack) >= minimumToPlan(days);

export function validatePack(raw: unknown, sources: string[] = []): ValidationResult {
  const problems: string[] = [];
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return { problems: ["nothing came back"] };

  const id = slug(r.id);
  const name = str(r.name, 60);
  if (!id || !name) return { problems: ["no usable id or name"] };

  const strengths = {} as Record<Vibe, number>;
  const rawStrengths = (r.strengths ?? {}) as Record<string, unknown>;
  for (const v of ALL_VIBES) strengths[v] = num(rawStrengths[v], 0, 5, 2)!;

  const because: Partial<Record<Vibe, string>> = {};
  const rawBecause = (r.because ?? {}) as Record<string, unknown>;
  for (const v of ALL_VIBES) {
    const s = str(rawBecause[v], 240);
    if (s) because[v] = s;
  }

  const paceFit = (Array.isArray(r.paceFit) ? r.paceFit : [])
    .map((p) => oneOf(p, PACES)).filter(Boolean) as Pace[];

  // Cities first: a place whose cityId names no city cannot be scheduled.
  const cities: City[] = [];
  for (const c of (Array.isArray(r.cities) ? r.cities : []) as Record<string, unknown>[]) {
    const cid = slug(c.id);
    const cname = str(c.name, 60);
    const lat = num(c.lat, -90, 90);
    const lng = num(c.lng, -180, 180);
    if (!cid || !cname || lat === undefined || lng === undefined) {
      problems.push(`city ${String(c.name ?? c.id ?? "?")} is missing a name or coordinates`);
      continue;
    }
    const dayTripOnly = c.dayTripOnly === true;
    cities.push({
      id: `${id}-${cid}`,
      name: cname,
      destinationId: id,
      lat, lng,
      nightlyUsd: dayTripOnly ? 0 : num(c.nightlyUsd, 20, 2000, 140)!,
      minNights: dayTripOnly ? 0 : num(c.minNights, 1, 10, 2)!,
      maxNights: dayTripOnly ? 0 : num(c.maxNights, 1, 14, 4)!,
      base: str(c.base, 200) ?? `Central ${cname}.`,
      scale: oneOf(c.scale, ["walkable", "driving"] as const),
      ...(dayTripOnly ? { dayTripOnly: true as const } : {}),
      dayTripFrom: c.dayTripFrom ? `${id}-${slug(c.dayTripFrom)}` : undefined,
      transitFromHubMin: num(c.transitFromHubMin, 5, 300),
      transitFromHubUsd: num(c.transitFromHubUsd, 0, 500),
      transitMode: oneOf(c.transitMode, ["train", "bus", "car", "ferry"] as const),
    });
  }
  if (cities.length === 0) return { problems: [...problems, "no usable cities came back"] };

  // A day trip hanging off a base that doesn't exist becomes a base itself.
  const ids = new Set(cities.map((c) => c.id));
  for (const c of cities) if (c.dayTripFrom && !ids.has(c.dayTripFrom)) c.dayTripFrom = undefined;

  const { places, problems: placeProblems } = validatePlaceList(
    r.places, id, cities,
  );
  problems.push(...placeProblems);

  /*
   * The spine is not the trip, so it is not allowed to fail the trip.
   *
   * There used to be a floor of eight usable places here, applied to a trip of
   * any length, and it threw away the whole destination when it wasn't met.
   * Two separate conversations died on it. Three days at the Indian Wells
   * tennis tournament came back with seven, which is a comfortable long
   * weekend, and got replaced by Big Sur. A week in the Yucatan came back with
   * ZERO, not because the model had nothing to say but because this call also
   * has to describe the cities and it ran out of output tokens before it
   * reached the places array. She had just been told, in the agent's own
   * voice, four nights in Tulum and three in Valladolid. Then it took the
   * whole country away.
   *
   * Every base gets its own call for its own dozen places immediately after
   * this one, and those calls are the reason the number here doesn't matter.
   * What this stage decides is whether there is somewhere to sleep. Whether
   * there is enough to DO is decided once the bases are filled in, by
   * enoughToPlan, which is the only check that knows how long the trip is.
   */
  const usable = places.filter((p) => !p.skip);

  // Drop cities nothing landed in, so the shape builder can't allocate nights
  // to a base with nothing to do. Only meaningful once something has landed:
  // when the spine came back with no places at all, every city is empty and
  // dropping them all would fail the destination for the wrong reason.
  const populated = new Set(usable.map((p) => p.cityId));
  const keptCities = usable.length
    ? cities.filter((c) => populated.has(c.id) || c.dayTripOnly)
    : cities;
  if (keptCities.filter((c) => !c.dayTripOnly).length === 0) {
    return { problems: [...problems, "no city came back with anything in it"] };
  }

  const hub = keptCities.find((c) => !c.dayTripOnly)!;
  const destination: Destination = {
    id,
    name,
    hubCityId: hub.id,
    pitch: str(r.pitch, 240) ?? `${name}.`,
    strengths,
    paceFit: paceFit.length ? paceFit : ["light", "mixed"],
    flightUsd: num(r.flightUsd, 0, 5000, 900)!,
    floorPerDayUsd: num(r.floorPerDayUsd, 20, 1500, 150)!,
    minDays: num(r.minDays, 2, 21, 5)!,
    because,
    warmth: (num(r.warmth, 1, 5, 3)! as 1 | 2 | 3 | 4 | 5),
    arrival: oneOf(r.arrival, ["fly", "drive"] as const) ?? "fly",
    caveat: [
      str(r.caveat, 300),
      // Never let a researched destination pass itself off as hand-checked
      // data. The traveller should know which half of the catalogue they're in.
      sources.length
        ? "Put together for you just now from a live search, so check anything you're pinning the trip on."
        : "Put together for you just now from what I know, rather than checked against today's opening times. Worth confirming anything you're pinning the trip on.",
    ].filter(Boolean).join(" "),
  };

  /*
   * Outings, validated like everything else here.
   *
   * An outing with no startsFrom is unusable: lodging is derived from that
   * list, so without it we cannot say where she sleeps and the outing cannot
   * be scheduled. Dropped rather than guessed at.
   */
  const outings: Outing[] = [];
  for (const raw of (Array.isArray(r.outings) ? r.outings : []) as Record<string, unknown>[]) {
    const oname = str(raw.name, 80);
    const hours = num(raw.hours, 0.5, 16);
    if (!oname || hours === undefined) continue;
    const from = (Array.isArray(raw.startsFrom) ? raw.startsFrom : [])
      .map((f) => f as Record<string, unknown>)
      .map((f) => ({ name: str(f.name, 60) ?? "", lat: num(f.lat, -90, 90), lng: num(f.lng, -180, 180) }))
      .filter((f) => f.name && f.lat !== undefined && f.lng !== undefined) as Outing["startsFrom"];
    if (!from.length) { problems.push(`outing "${oname}" came back with nowhere to start from`); continue; }
    outings.push({
      id: `${id}-${slug(oname)}`,
      name: oname,
      hours,
      startsFrom: from,
      why: str(raw.why, 240) ?? "",
      km: num(raw.km, 0, 500),
      gainM: num(raw.gainM, 0, 9000),
      costUsd: num(raw.costUsd, 0, 5000),
      season: str(raw.season, 60),
      fallback: str(raw.fallback, 160),
    });
  }

  return {
    pack: { destination, cities: keptCities, outings, places, sources },
    problems,
  };
}
