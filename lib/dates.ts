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
