"use client";

import { listTrips, saveTrip, type SavedTrip } from "@/lib/trips";
import { loadProfile, saveProfile } from "@/lib/client";
import type { TravelerProfile } from "@/lib/types";

/**
 * A copy of everything, in a file you own.
 *
 * Every persistence trick below the browser's own storage is a policy, not a
 * guarantee: Safari sweeps script-writable storage after about a week of not
 * visiting, installing to the Home Screen exempts you from that, and the exact
 * rules have moved with every iOS release. Clearing site data, a new phone or
 * a different browser end the trips regardless.
 *
 * So the honest answer to "will my trips still be here" is a file. This is the
 * whole store as JSON, restorable anywhere, and it is the only part of this
 * that no vendor can revise.
 */

export const BACKUP_VERSION = 1;

export interface Backup {
  kind: "trip-agent-backup";
  version: number;
  exportedAt: string;
  trips: SavedTrip[];
  profile: TravelerProfile;
}

export function buildBackup(): Backup {
  return {
    kind: "trip-agent-backup",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    trips: listTrips(),
    profile: loadProfile(),
  };
}

export function backupFilename(now = new Date()): string {
  return `vamos-${now.toISOString().slice(0, 10)}.json`;
}

/** Download it. No server involved; the file never leaves the machine. */
export function downloadBackup(): number {
  const backup = buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return backup.trips.length;
}

export interface RestoreResult {
  ok: boolean;
  added: number;
  updated: number;
  problem?: string;
}

/**
 * Merge rather than replace. Restoring onto a phone that already has two live
 * trips should not throw them away, and a trip that exists in both places
 * should end up at whichever version was touched last.
 */
export function restoreBackup(raw: string): RestoreResult {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    return { ok: false, added: 0, updated: 0, problem: "That file isn't a backup I can read." };
  }
  const b = parsed as Partial<Backup>;
  if (!b || b.kind !== "trip-agent-backup" || !Array.isArray(b.trips)) {
    return { ok: false, added: 0, updated: 0, problem: "That's a JSON file, but not a Vamos backup." };
  }
  if (typeof b.version === "number" && b.version > BACKUP_VERSION) {
    return {
      ok: false, added: 0, updated: 0,
      problem: "That backup came from a newer version of this app than the one you're running.",
    };
  }

  const existing = new Map(listTrips().map((t) => [t.id, t]));
  let added = 0, updated = 0;

  for (const t of b.trips) {
    if (!t || typeof t.id !== "string" || !Array.isArray(t.msgs)) continue;
    const here = existing.get(t.id);
    if (!here) { saveTrip(t); added++; continue; }
    if ((t.updatedAt ?? 0) > (here.updatedAt ?? 0)) { saveTrip(t); updated++; }
  }

  if (b.profile && typeof b.profile === "object") {
    const now = loadProfile();
    saveProfile({
      ...now,
      ...b.profile,
      preferences: [...new Set([...(now.preferences ?? []), ...(b.profile.preferences ?? [])])],
      seenDestinationIds: [
        ...new Set([...(now.seenDestinationIds ?? []), ...(b.profile.seenDestinationIds ?? [])]),
      ],
    });
  }

  return { ok: true, added, updated };
}

/**
 * Ask the browser not to evict us. Chrome and Firefox grant this to sites the
 * person actually uses; Safari doesn't implement it and returns false, which
 * is exactly why the Home Screen prompt and the backup button both exist.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** True on an iPhone or iPad in Safari, not yet installed to the Home Screen. */
export function shouldSuggestInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone;
}
