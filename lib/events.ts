/**
 * Where the big sporting events are, and when.
 *
 * "wimbledon", "the monaco grand prix", "f1 in may", "a warriors game":
 * each of these is a place and a date wearing a different name, and the
 * catalogue had no idea. They were read as activities ("For wimbledon:
 * ...") or refused. The table in data/events.json holds the host city, the
 * venue and the published dates of the editions we know about; this module
 * finds an event in what she typed, picks the edition she means, and turns
 * it into a brief: the host's pack, pinned to the host city, dated round
 * the event, with the event on the days it runs.
 *
 * Leagues (NFL, NBA, MLB) carry a season window and no dates: a "warriors
 * game" pins the city and says which months the season runs; it does not
 * pick a night, because the fixture list is not ours to know.
 */
import EVENTS_JSON from "@/data/events.json";
import { fold } from "@/lib/text";
import { resolvePlaceName } from "@/lib/places";
import { prettyDate } from "@/lib/dates";

export interface Edition { year: number; start: string; end: string; provisional?: boolean }
export interface SportEvent {
  id: string;
  name: string;
  aliases: string[];
  sport: "f1" | "tennis" | "football" | "golf" | "olympics" | "nfl" | "nba" | "mlb";
  series?: string;
  city: string;
  country: string;
  venue: string;
  lat: number | null;
  lng: number | null;
  editions: Edition[];
  season?: string;
  ticketNote?: string;
  note?: string;
  source?: string;
}

export const EVENTS: SportEvent[] = EVENTS_JSON as SportEvent[];

/** The event on the brief: enough to date the trip and to put it on the days. */
export interface BriefEvent {
  id: string;
  /** The dates are last year's shifted a year: the organiser has not published this year's. */
  provisional?: boolean;
  name: string;
  venue: string;
  city: string;
  lat?: number;
  lng?: number;
  /** The edition she means; absent for a league, which has a season instead. */
  start?: string;
  end?: string;
  season?: string;
  ticketNote?: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december"];

/**
 * The generic words that mean "one of these", with no event named:
 * "f1 in may", "a grand prix", "a masters 1000", "the champions league final".
 */
const GENERIC: [RegExp, SportEvent["sport"], string | undefined][] = [
  [/\b(f1|formula ?(1|one)|grand prix|gp weekend)\b/i, "f1", undefined],
  [/\b(grand slam|atp|masters 1000|tennis tournament)\b/i, "tennis", undefined],
  [/\b(champions league|ucl)\b/i, "football", "champions"],
  [/\b(europa league)\b/i, "football", "europa"],
  [/\b(golf major|the majors)\b/i, "golf", undefined],
  [/\b(olympics|olympic games)\b/i, "olympics", undefined],
  [/\b(nfl|football game|american football)\b/i, "nfl", undefined],
  [/\b(nba|basketball game)\b/i, "nba", undefined],
  [/\b(mlb|baseball game|ballgame)\b/i, "mlb", undefined],
];

const key = (s: string) => fold(s).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Every name the event answers to, folded, longest first. */
function namesOf(e: SportEvent): string[] {
  const out = new Set<string>([e.name, ...(e.aliases ?? [])]);
  if (e.sport === "f1") {
    // "monaco grand prix", "monaco gp", "the grand prix in monaco"
    out.add(`${e.city} grand prix`); out.add(`${e.city} gp`); out.add(`${e.city} f1`);
    out.add(`grand prix in ${e.city}`); out.add(`f1 in ${e.city}`);
  }
  if (["nfl", "nba", "mlb"].includes(e.sport)) {
    // The team name on its own ("warriors", "the 49ers"), and "a warriors game".
    const team = e.name.split(" ").slice(-1)[0];
    out.add(team); out.add(`${team} game`); out.add(`${e.name} game`);
  }
  return [...out].map(key).filter((n) => n.length >= 3).sort((a, b) => b.length - a.length);
}

/**
 * The edition she means: the next one from today. When the organiser has
 * not published next year's dates, last year's shifted by 52 weeks (same
 * weekdays) stand in, marked provisional, and the card says so; a trip
 * dated to a tournament that already happened is worse than an estimate.
 */
export function editionFor(e: SportEvent, today: Date, year?: number): Edition | undefined {
  if (!e.editions.length) return undefined;
  if (year) return e.editions.find((x) => x.year === year);
  const iso = today.toISOString().slice(0, 10);
  const next = e.editions.find((x) => x.end >= iso);
  if (next) return next;
  const last = e.editions[e.editions.length - 1];
  const shift = (d: string) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 364); return t.toISOString().slice(0, 10); };
  return { year: last.year + 1, start: shift(last.start), end: shift(last.end), provisional: true };
}

/** Events that can still be gone to: a future edition, or a season. */
const upcoming = (e: SportEvent, today: Date) =>
  !!e.season || e.editions.some((x) => x.end >= today.toISOString().slice(0, 10)) || e.editions.length > 0;

export interface EventMatch {
  event: SportEvent;
  edition?: Edition;
  /** The words of hers the match consumed, so the gate can count them landed. */
  matched: string;
}

/**
 * Find the event in what she typed.
 *
 * A named event wins ("wimbledon", "monaco gp", "warriors game"). Failing
 * that, a generic word plus a month picks the rounds of that series in that
 * month ("f1 in may"); one round is a match, several are returned so the
 * caller can ask which. A generic word alone ("a grand prix") is also
 * returned with the whole series, for the same reason.
 */
export function findEvent(text: string, today = new Date()): EventMatch | { choices: SportEvent[]; sport: SportEvent["sport"]; matched: string } | undefined {
  const t = ` ${key(text)} `;
  const year = t.match(/\b(202[5-9])\b/)?.[1];
  const wanted = year ? Number(year) : undefined;

  let best: { e: SportEvent; n: string } | undefined;
  for (const e of EVENTS) {
    for (const n of namesOf(e)) {
      if (t.includes(` ${n} `) && (!best || n.length > best.n.length)) best = { e, n };
    }
  }
  if (best) {
    return { event: best.e, edition: editionFor(best.e, today, wanted), matched: best.n };
  }

  for (const [re, sport, sub] of GENERIC) {
    const m = text.match(re);
    if (!m) continue;
    let pool = EVENTS.filter((e) => e.sport === sport && upcoming(e, today));
    // A row that is one past edition of a moving final (UCL 2026, Aronimink
    // 2026) is history, not a choice.
    pool = pool.filter((e) => e.season || e.editions.some((x) => x.end >= today.toISOString().slice(0, 10)));
    if (sub === "champions") pool = pool.filter((e) => /champions/i.test(e.name));
    if (sub === "europa") pool = pool.filter((e) => /europa/i.test(e.name));
    const month = MONTHS.findIndex((mo) => new RegExp(`\\b${mo}\\b`, "i").test(text));
    if (month >= 0 && pool.some((e) => e.editions.length)) {
      pool = pool.filter((e) => e.editions.some((x) => {
        const d = new Date(x.start + "T00:00:00Z");
        return d.getUTCMonth() === month && (!wanted || x.year === wanted) && x.end >= today.toISOString().slice(0, 10);
      }));
    }
    if (pool.length === 1) {
      return { event: pool[0], edition: editionFor(pool[0], today, wanted), matched: key(m[0]) };
    }
    if (pool.length > 1) return { choices: pool, sport, matched: key(m[0]) };
  }
  return undefined;
}

/** The event as the brief carries it. */
export function briefEvent(m: EventMatch): BriefEvent {
  const { event: e, edition } = m;
  return {
    id: e.id, name: e.name, venue: e.venue, city: e.city,
    lat: e.lat ?? undefined, lng: e.lng ?? undefined,
    start: edition?.start, end: edition?.end, provisional: edition?.provisional,
    season: e.season, ticketNote: e.ticketNote,
  };
}

/** Where the event is, in the catalogue: the host's pack and, when held, the host city. */
export function hostOf(e: SportEvent): { destinationId: string; cityId?: string } | undefined {
  return resolvePlaceName(e.city, { exact: true })
    ?? resolvePlaceName(e.country, { exact: true });
}

/** One line for the card: when it runs, where, and how tickets go. */
export function eventLine(ev: BriefEvent): string {
  const when = ev.start && ev.end
    ? (ev.start === ev.end ? `on ${prettyDate(ev.start)}` : `from ${prettyDate(ev.start)} to ${prettyDate(ev.end)}`)
    : ev.season ? `during the ${ev.season} season` : "";
  const where = ev.venue ? ` at ${ev.venue}` : "";
  const dated = ev.start
    ? (ev.provisional
      ? " Those are last year's dates moved a year; this year's are not published yet, so check before booking. The trip is dated round them."
      : " The trip is dated round it.")
    : " I have not picked a game: the fixture list is not mine to know, so check the schedule and tell me the date.";
  return `${ev.name} runs ${when}${where}.${dated}${ev.ticketNote ? ` ${ev.ticketNote}` : ""}`;
}

/** The sentence when the host is not in the bag. */
export function unheldEventSays(m: EventMatch): string {
  const { event: e, edition } = m;
  const when = edition ? ` (${prettyDate(edition.start)} to ${prettyDate(edition.end)})` : e.season ? ` (${e.season})` : "";
  return `${e.name} is in ${e.city}${when}, and ${e.city} isn't somewhere I hold yet.`;
}

/** The sentence when several rounds fit: "f1 in may" is Miami and Monaco. */
export function whichEventSays(c: { choices: SportEvent[]; sport: SportEvent["sport"] }, today = new Date()): string {
  const named = c.choices.slice(0, 6).map((e) => {
    const ed = editionFor(e, today);
    return ed ? `${e.name} (${prettyDate(ed.start)})` : e.name;
  });
  const more = c.choices.length > 6 ? `, and ${c.choices.length - 6} more` : "";
  return `Which one: ${named.join(", ")}${more}?`;
}
