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
    const before = text.slice(Math.max(0, at - 30), at);
    const after = text.slice(at + m[0].length);
    // "march 9" and "the 9th of march" are parseDateRange's job, not this one.
    if (/\d\s*(st|nd|rd|th)?\s*(of\s*)?$/i.test(before)) continue;
    /*
     * A month she ruled out is not the month she is going.
     *
     * "portugal for 9 days, not august, too hot" planned the whole trip inside
     * August and then told her "You said August" — the fidelity rule broken
     * twice in one sentence. Same for "we can't go in july" and "anywhere but
     * december".
     */
    if (/\b(not|no|avoid|skip|never|except|hate|can'?t|cannot|won'?t|rather not|other than|apart from|(?:any|every)(?:thing|where) but)\b[^.;,]{0,15}$/i.test(before)) continue;
    // "last time we went in june" is a memory, not a plan.
    if (/\b(last|previous|already|been|went|before|used to)\b[^.;,]{0,20}$/i.test(before)) continue;
    /*
     * The three months that are also ordinary English have to earn it.
     *
     * "we want to march up to the top of the hill", "a trip to Mar del Plata",
     * "travelling with jan and her brother", "may i ask about portugal" — all
     * became a month. A date word in front, or the end of the clause behind,
     * is what tells them apart.
     */
    if (/^(may|march|mar|jan|aug|sept?)$/i.test(m[1])) {
      const lead = /\b(in|during|around|about|for|early|mid|late|by|until|till|through|come|next|this|sometime|go|going|travel|travelling|traveling|visit|leave|leaving|fly|flying)\s+$/i.test(before);
      const tail = /^\s*($|[,.;!?]|\d{4}\b)/.test(after);
      if (!lead && !tail) continue;
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
export function startOfStatedMonth(month: string, today = new Date()): string | undefined {
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
  const tenth = new Date(Date.UTC(y, m - 1, 10));
  if (tenth >= todayUtc) return iso(y, m, 10);
  const lastUsable = new Date(Date.UTC(y, m - 1, 22));
  if (todayUtc <= lastUsable) {
    const d = new Date(todayUtc);
    d.setUTCDate(d.getUTCDate() + 3);
    if (d.getUTCMonth() === m - 1) return iso(d.getUTCFullYear(), m, d.getUTCDate());
  }
  return iso(y + 1, m, 10);
}
