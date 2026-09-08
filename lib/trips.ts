import { unknownHead } from "@/lib/types";
"use client";

import type { Brief, Trip } from "@/lib/types";
import type { DestinationPack } from "@/lib/research";
import type { Turn } from "@/lib/agent/types";
import { destinationById } from "@/data/destinations";
import { prettyDate } from "@/lib/dates";

/**
 * Trips as projects.
 *
 * Every conversation was disposable: close the tab and the Thailand you spent
 * ten minutes on is gone. Planning a trip is not one sitting. You think about
 * it on the train, come back to it three days later, and you often have two
 * or three possible trips alive at once.
 *
 * Kept in localStorage, per browser, alongside the traveller profile. No
 * account, nothing leaves the machine.
 */
export interface SavedTrip {
  id: string;
  /** Derived from the trip, not typed by anyone. */
  name: string;
  createdAt: number;
  updatedAt: number;
  stage: "chat" | "proposal" | "itinerary";
  brief: Brief;
  msgs: { id: string; from: "agent" | "user"; text: string }[];
  history: Turn[];
  trip: Trip | null;
  /*
   * The researched catalogue this trip depends on.
   *
   * Researched destinations were deliberately kept in memory only, on the
   * reasoning that live data ages and planning next month off last month's
   * opening hours is the failure the feature exists to avoid. True, but it
   * made a saved trip to a researched place a landmine: reload the tab and it
   * points at an id nothing holds, which took down every trip in the browser
   * with "This page couldn't load".
   *
   * A trip is a project you come back to over days. It has to be able to open.
   * The itinerary was being persisted in full anyway, so this stores nothing
   * newly perishable, and the destination carries its own caveat telling the
   * traveller to confirm anything they're pinning the trip on.
   */
  pack?: DestinationPack;
}

const KEY = "trip-agent.trips.v1";
/** Enough to keep every live idea, few enough to stay well inside the quota. */
const LIMIT = 20;

export function listTrips(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as SavedTrip[];
    return Array.isArray(all) ? all.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

/**
 * Save, and keep saving even when the box is full.
 *
 * This used to swallow the error, which meant that once the quota filled the
 * trip you were actively planning stopped being written and nothing said so.
 * A full store is not a reason to lose the live conversation; it is a reason
 * to drop the oldest thing in it. Trips carry full itineraries, so five of
 * them is a real fraction of a five megabyte quota.
 */
export function saveTrip(t: SavedTrip): boolean {
  let keep = LIMIT;
  const all = listTrips().filter((x) => x.id !== t.id);

  while (keep >= 1) {
    try {
      localStorage.setItem(KEY, JSON.stringify([t, ...all].slice(0, keep)));
      return true;
    } catch (e) {
      // Private mode and disabled storage throw on the first write and will
      // throw on every subsequent one, so don't spin.
      if (!isQuotaError(e)) return false;
      keep = keep === 1 ? 0 : Math.max(1, Math.floor(keep / 2));
    }
  }
  return false;
}

/** Browsers disagree on the name and the code; all of them mean "full". */
function isQuotaError(e: unknown): boolean {
  const err = e as { name?: string; code?: number };
  return err?.name === "QuotaExceededError"
    || err?.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || err?.code === 22 || err?.code === 1014;
}

export function deleteTrip(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listTrips().filter((x) => x.id !== id)));
  } catch { /* see above */ }
}

/**
 * Which trip this tab is in the middle of.
 *
 * Without it, a reload starts a brand new conversation with a brand new id and
 * quietly leaves the old one behind. That is how one session ended up as two
 * entries in the list, "The Middle East, in conversation" and "Jordan,
 * shortlisted", from what felt like a single unbroken chat. Refreshing a page
 * should not fork your trip.
 */
const CURRENT = "trip-agent.current.v1";

export function rememberCurrent(id: string): void {
  try { localStorage.setItem(CURRENT, id); } catch { /* best effort */ }
}

export function forgetCurrent(): void {
  try { localStorage.removeItem(CURRENT); } catch { /* best effort */ }
}

/** The trip to pick back up on load, if it still exists and isn't finished. */
export function resumable(): SavedTrip | null {
  try {
    const id = localStorage.getItem(CURRENT);
    if (!id) return null;
    const t = listTrips().find((x) => x.id === id);
    return t && t.msgs.length > 0 ? t : null;
  } catch {
    return null;
  }
}

export const newTripId = () =>
  `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * What to call it. A destination once there is one, otherwise the thing they
 * typed, because "Untitled trip" tells you nothing about which of three
 * half-finished ideas this was.
 */
export function tripName(brief: Brief, trip: Trip | null, firstMessage?: string): string {
  const dest = trip?.concept.destinationId ?? brief.namedDestination;
  const place = dest ? safeName(dest) : brief.regionLabel ?? unknownHead(brief);

  const when = brief.dates?.start
    ? prettyDate(brief.dates.start).replace(/\s*\(.*\)$/, "")
    : brief.month;
  const long = brief.days ? `${brief.days} days` : undefined;

  if (place) {
    return [title(place), [long, when].filter(Boolean).join(", ")]
      .filter(Boolean)
      .join(" · ");
  }
  const opener = (firstMessage ?? brief.opening ?? "").trim();
  return opener ? title(opener.slice(0, 46)) : "New trip";
}

/** A researched destination may not be registered yet in a fresh tab. */
function safeName(id: string): string {
  try { return destinationById(id).name; } catch { return id; }
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Planned", "Shortlisted", "Talking it through" — where this one got to. */
export function tripStatus(t: SavedTrip): string {
  if (t.stage === "itinerary") return "Planned";
  if (t.stage === "proposal") return "Shortlisted";
  return "In conversation";
}

export function whenLabel(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
