"use client";

import { addUsage, emptyUsage, type Usage } from "@/lib/cost";

/**
 * What each trip has cost so far, kept where the trip is.
 *
 * The point is not accounting, it is knowing the unit economics before
 * deciding anything about money. Every conversation in this project about
 * "cents per trip" was an estimate; this is the measurement, per planned
 * trip, from the API's own token counts.
 */

const KEY = "vamos.spend.v1";

export interface Ledger { [tripId: string]: Usage; }

function read(): Ledger {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Ledger) : {};
  } catch { return {}; }
}

function write(l: Ledger): void {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* best effort */ }
}

/** Add one response's usage to a trip's running total. */
export function chargeTrip(tripId: string, u: Partial<Usage> | undefined): void {
  if (!u || !tripId) return;
  const l = read();
  l[tripId] = addUsage(l[tripId] ?? emptyUsage(), u);
  write(l);
}

export function tripUsage(tripId: string): Usage {
  return read()[tripId] ?? emptyUsage();
}

/** Everything this browser has spent, and across how many trips. */
export function totalUsage(): { usage: Usage; trips: number } {
  const l = read();
  const ids = Object.keys(l);
  return {
    usage: ids.reduce((a, id) => addUsage(a, l[id]), emptyUsage()),
    trips: ids.length,
  };
}

export function forgetSpend(tripId: string): void {
  const l = read();
  delete l[tripId];
  write(l);
}
