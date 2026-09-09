/**
 * Reading dates out of how people actually state a trip.
 *
 * "flying out on 10/12 from sfo to lisbon, and coming back on 10/21" contains
 * the duration, the month and the calendar. The agent was throwing all three
 * away and then asking "how long can you disappear for?", which is the wasted
 * turn that makes a planning session feel slow.
 */

export interface DateRange {
  /** ISO yyyy-mm-dd. */
  start: string;
  end: string;
  /** Nights on the ground: end minus start. */
  days: number;
}

import { CLAUSE_BREAK_SOURCE } from "@/lib/clauses";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/**
 * No year stated means the next time that date comes round. Someone saying
 * "10/12" in September means this October, not one already gone.
 */
function resolveYear(month: number, day: number, today: Date): number {
  const y = today.getFullYear();
  const candidate = new Date(Date.UTC(y, month - 1, day));
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return candidate < todayUtc ? y + 1 : y;
}

interface Hit { month: number; day: number; year?: number; index: number }

function collect(text: string): Hit[] {
  const hits: Hit[] = [];
  // 2026-10-12
  for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    hits.push({ year: +m[1], month: +m[2], day: +m[3], index: m.index! });
  }
  // 10/12 or 10/12/26 — US order, which is what "10/12 ... 10/21" means to
  // someone flying out of SFO. Ambiguous by nature; stated back to them.
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const mo = +m[1], d = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    let year: number | undefined;
    if (m[3]) year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    hits.push({ month: mo, day: d, year, index: m.index! });
  }
  // Oct 12, October 12th, 12 October
  const names = Object.keys(MONTHS).join("|");
  for (const m of text.matchAll(new RegExp(`\\b(${names})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi"))) {
    hits.push({ month: MONTHS[m[1].toLowerCase()], day: +m[2], index: m.index! });
  }
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${names})\\b`, "gi"))) {
    hits.push({ month: MONTHS[m[2].toLowerCase()], day: +m[1], index: m.index! });
  }
  // "October 12-21" — one month, two days.
  for (const m of text.matchAll(new RegExp(`\\b(${names})\\.?\\s+(\\d{1,2})\\s*(?:-|–|to|through|until)\\s*(\\d{1,2})\\b`, "gi"))) {
    const mo = MONTHS[m[1].toLowerCase()];
    hits.push({ month: mo, day: +m[2], index: m.index! });
    hits.push({ month: mo, day: +m[3], index: m.index! + 1 });
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** Two dates in one message are a trip. One is a start we don't have an end for. */
export function parseDateRange(text: string, today = new Date()): DateRange | null {
  const hits = collect(text);
  if (hits.length < 2) return null;

  // Deduplicate overlapping matches at the same position.
  const seen = new Set<string>();
  const uniq = hits.filter((h) => {
    const k = `${h.month}-${h.day}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (uniq.length < 2) return null;

  const [a, b] = uniq;
  const ya = a.year ?? resolveYear(a.month, a.day, today);
  // The return is in whichever year keeps it after the departure.
  let yb = b.year ?? ya;
  if (new Date(iso(yb, b.month, b.day)) < new Date(iso(ya, a.month, a.day))) yb = ya + 1;

  const start = iso(ya, a.month, a.day);
  const end = iso(yb, b.month, b.day);
  const days = Math.round(
    (Date.parse(end) - Date.parse(start)) / 86_400_000,
  );
  if (days < 1 || days > 60) return null;
  return { start, end, days };
}

/** "Oct 13 (Tue)" — the header a person actually recognises. */
export function prettyDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return isoDate;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  return `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()} (${wd})`;
}

export function monthName(isoDate: string): string | undefined {
  const d = new Date(isoDate + "T12:00:00Z");
  return Number.isNaN(d.getTime()) ? undefined : MONTH_NAMES[d.getUTCMonth()];
}

export function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * A month she named with no day attached.
 *
 * `parseDateRange` needs two dates and returns null otherwise, and `month` was
 * only ever set from a parsed range. So "portugal, 9 days in march" carried
 * nothing about March anywhere: the planner fell back to its default of 45
 * days out, the itinerary printed real October weekdays, and seven of the
 * fifteen destinations carry a caveat about the wrong season that could never
 * fire. She said March and nothing downstream knew.
 */
export function bareMonth(text: string): string | undefined {
  const names = Object.keys(MONTHS).join("|");
  /*
   * Every month in the sentence, not the first one.
   *
   * Reading the first match made "i've never been in august but let's go in
   * december" an August trip and "last time we went in june, this time we want
   * october" a June one. A month sitting inside a refusal or a memory is not
   * when she is going.
   */
  const re = new RegExp(`\\b(${names})\\b(?!\\s*\\d{1,2}\\b)`, "gi");
  for (const m of text.matchAll(re)) {
    const at = m.index!;
    const before = text.slice(Math.max(0, at - 40), at);
    const after = text.slice(at + m[0].length);
    // "march 9" and "the 9th of march" are parseDateRange's job, not this one.
    if (/\d\s*(st|nd|rd|th)?\s*(of\s*)?$/i.test(before)) continue;
    // The clause the month sits in. "but" ends one — except in "anywhere but
    // december", where it is part of the refusal rather than a new thought.
    const mb = before.split(
      new RegExp(`[.;,]|${CLAUSE_BREAK_SOURCE}|(?<!\\b(?:any|every)(?:thing|where|one))\\sbut\\s`, "i"),
    ).pop() ?? "";
    /*
     * A month she ruled out is not the month she is going — and the refusal
     * only governs its own clause — which is what `mb` is. Tested against the
     * whole run-up, "i've never been in august but let's go in december"
     * refused December: the "never" was four words and a "but" away, in the
     * clause it belonged to. The character class here stays simple because the
     * clause has already been cut; two overlapping guards for one rule is how
     * a test comes out green with the bug live.
     */
    if (/\b(not|no|avoid|skip|never|except|hate|hated|can'?t|cannot|won'?t|would'?nt|rather not|prefer not|other than|apart from|(?:any|every)(?:thing|where) but)\b[^.;,]*$/i.test(mb)) continue;
    /*
     * A month she is remembering is not a month she is going: "we were in june
     * last year, this time october" and "june nearly killed us; october
     * please" both planned June.
     *
     * A memory word only disqualifies the month if nothing between them turns
     * the sentence back to the future. "been to porto before so october this
     * time" and "we went in june last year and want to go in october" are both
     * plans; the memory is what she is contrasting the plan with.
     */
    const FUTURE = /\b(so|then|this time|instead|want|wanna|would like|go|going|let'?s|now|next)\b/i;
    const memoryBefore = /\b(last|previous|already|been|was|were|went|did|before|used to|nearly|almost|brutal)\b/gi;
    // Every memory word in the clause, not the first: "last time we went in
    // june" puts "last" 21 characters out and "went" eight, and only the
    // second one is the reason june is a memory.
    let memory = false;
    for (const hit of mb.matchAll(memoryBefore)) {
      const at = hit.index ?? 0;
      if (mb.length - at <= 20 && !FUTURE.test(mb.slice(at + hit[0].length))) { memory = true; break; }
    }
    if (memory) continue;
    // "june last year" — the memory rides directly on the month. "october and
    // last year was brutal" does not: that is a second clause about a
    // different year.
    if (/^\s{0,2}(last (year|time|summer|winter)|was|were|nearly|killed|brutal)\b/i.test(after)) continue;
    /*
     * The three months that are also ordinary English have to earn it.
     *
     * "we want to march up to the top of the hill", "a trip to Mar del Plata",
     * "travelling with jan and her brother", "may i ask about portugal" — all
     * became a month. A date word in front, or the end of the clause behind,
     * is what tells them apart.
     */
    /*
     * The months that are also ordinary English have to earn it — with a date
     * word in front, or a year behind. An end-of-clause comma is not enough:
     * "we want to march, then relax" and "jan, my sister, is coming too" both
     * became months on the strength of the punctuation after them.
     */
    if (/^(may|march|mar|jan|aug|sept?)$/i.test(m[1])) {
      const lead = /\b(in|during|around|about|for|early|mid|late|by|until|till|through|come|next|this|sometime|go|going|travel|travelling|traveling|visit|leave|leaving|fly|flying|love|loves|d love|fancy|thinking|prefer|aiming|target|targeting)\s+$/i.test(before)
        /*
         * Or it opens the message and is followed by a date-ish continuation:
         * "march, 9 days in portugal". Not merely opening it — "jan, my
         * sister, is coming too" and "may i ask about portugal" both do that.
         */
        || (/^\s*$/.test(before) && /^\s*,\s*\d/.test(after));
      const year = /^\s*\d{4}\b/.test(after);
      if (!lead && !year) continue;
    }
    return MONTH_NAMES[MONTHS[m[1].toLowerCase()] - 1];
  }
  return undefined;
}

/**
 * One date, where a range needs two: "flying out on october 12".
 *
 * Returned separately from the range so the caller can decide what it means.
 * A departure with no return is still the day the trip starts.
 */
export function singleDate(text: string, today = new Date()): string | undefined {
  const hits = collect(text);
  if (hits.length !== 1) return undefined;
  const h = hits[0];
  return iso(h.year ?? resolveYear(h.month, h.day, today), h.month, h.day);
}

/**
 * The day a trip in this month starts, when she named the month and no dates.
 *
 * Mid-month rather than the 1st, so a nine-day trip stays inside the month she
 * said, and the next occurrence of it — someone saying "March" in September
 * means the coming March, not one seven months gone.
 */
export function startOfStatedMonth(month: string, today = new Date(), days?: number): string | undefined {
  const m = MONTHS[month.toLowerCase()];
  if (!m) return undefined;
  const y = today.getUTCFullYear();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  /*
   * The 10th, unless that has passed and the rest of the month has not.
   *
   * A flat "the 10th, or next year" meant that saying "September" on the 11th
   * of September moved the trip eleven months out — further away than saying
   * nothing at all, which defaults to six weeks. If there is still room in the
   * month she named, she meant this one.
   */
  /*
   * The 10th, or the first plannable day after it if the 10th has gone.
   *
   * A flat "the 10th, or next year" meant that saying "September" on the 11th
   * of September moved the trip eleven months out — further than saying
   * nothing, which defaults to six weeks. Going the other way and starting
   * from today is no better: a departure the day after tomorrow is not what
   * she meant either. A week's notice is the floor; past that, the month she
   * named is next year's.
   */
  const LEAD_DAYS = 7;
  const earliest = new Date(todayUtc);
  earliest.setUTCDate(earliest.getUTCDate() + LEAD_DAYS);
  const tenth = new Date(Date.UTC(y, m - 1, 10));
  if (tenth >= earliest) return iso(y, m, 10);
  /*
   * And only if the trip still fits inside the month she named. Starting on
   * the 27th of September puts most of a nine-day trip in October, while the
   * card says "You said September" — which is the same wrong-season problem
   * this function exists to fix, one week later.
   */
  if (earliest.getUTCMonth() === m - 1 && earliest.getUTCFullYear() === y) {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (earliest.getUTCDate() + Math.max(0, (days ?? 1) - 1) <= lastDay) {
      return iso(y, m, earliest.getUTCDate());
    }
  }
  return iso(y + 1, m, 10);
}
