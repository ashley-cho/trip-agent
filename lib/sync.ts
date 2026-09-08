"use client";

import { supabase, syncAvailable } from "@/lib/supabase";
import { listTrips, saveTrip, type SavedTrip } from "@/lib/trips";
import { loadProfile, saveProfile } from "@/lib/client";
import type { TravelerProfile } from "@/lib/types";

/**
 * Trips on every device you use.
 *
 * Local-first, deliberately. Everything is written to this browser first and
 * pushed afterwards, so the app works on a plane, a failed request never
 * costs someone the conversation they are in the middle of, and signing out
 * leaves the trips on the machine rather than wiping them.
 *
 * Conflicts are resolved by `updatedAt`, which the client sets when the person
 * actually edited the trip. Two devices editing the same trip while both
 * offline is the one case that loses an edit, and losing the older of two
 * versions is the right answer often enough to be worth the simplicity here.
 */

const TOMBSTONES = "trip-agent.deleted.v1";
const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

interface Tombstone { id: string; at: number; }

function tombstones(): Tombstone[] {
  try {
    const raw = localStorage.getItem(TOMBSTONES);
    const all = raw ? (JSON.parse(raw) as Tombstone[]) : [];
    const now = Date.now();
    return Array.isArray(all) ? all.filter((t) => now - t.at < SIXTY_DAYS) : [];
  } catch { return []; }
}

/**
 * A trip deleted on the phone must not come back from the laptop's copy on the
 * next sync. Deleting locally records that it was deleted, and the sync sends
 * the deletion on rather than treating the remote row as news.
 */
export function tombstone(id: string): void {
  try {
    const next = [...tombstones().filter((t) => t.id !== id), { id, at: Date.now() }];
    localStorage.setItem(TOMBSTONES, JSON.stringify(next));
  } catch { /* storage is best-effort everywhere else too */ }
}

export interface Account { id: string; email: string | null; }

export async function currentAccount(): Promise<Account | null> {
  const db = supabase();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? null } : null;
}

export function onAccountChange(fn: (a: Account | null) => void): () => void {
  const db = supabase();
  if (!db) return () => {};
  const { data } = db.auth.onAuthStateChange((_e, session) => {
    const u = session?.user;
    fn(u ? { id: u.id, email: u.email ?? null } : null);
  });
  return () => data.subscription.unsubscribe();
}

/** Send the email. Works as a link or as a code, whichever arrives. */
export async function requestSignIn(email: string): Promise<{ ok: boolean; problem?: string }> {
  const db = supabase();
  if (!db) return { ok: false, problem: "Sync isn't set up on this build." };
  const { error } = await db.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  return error ? { ok: false, problem: error.message } : { ok: true };
}

export async function verifyCode(email: string, token: string): Promise<{ ok: boolean; problem?: string }> {
  const db = supabase();
  if (!db) return { ok: false, problem: "Sync isn't set up on this build." };
  const { error } = await db.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
  return error ? { ok: false, problem: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
}

interface Row {
  id: string; user_id: string; name: string; stage: SavedTrip["stage"];
  created_at: string; updated_at: string; data: Omit<SavedTrip, "id" | "name" | "stage" | "createdAt" | "updatedAt">;
}

const toRow = (t: SavedTrip, userId: string): Omit<Row, "user_id"> & { user_id: string } => ({
  id: t.id,
  user_id: userId,
  name: t.name,
  stage: t.stage,
  created_at: new Date(t.createdAt).toISOString(),
  updated_at: new Date(t.updatedAt).toISOString(),
  data: { brief: t.brief, msgs: t.msgs, history: t.history, trip: t.trip },
});

const fromRow = (r: Row): SavedTrip => ({
  id: r.id,
  name: r.name,
  stage: r.stage,
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
  brief: r.data.brief,
  msgs: r.data.msgs ?? [],
  history: r.data.history ?? [],
  trip: r.data.trip ?? null,
});

/**
 * Who wins, decided without a network in sight.
 *
 * Pulled out of the sync so it can be tested, because this is the function
 * that silently loses someone's trip if it's wrong. Three rules: a deletion
 * beats everything, otherwise the newer `updatedAt` wins, and equal
 * timestamps change nothing in either direction.
 */
export interface Plan {
  pull: SavedTrip[];
  push: SavedTrip[];
  remove: string[];
}

export function planSync(
  local: SavedTrip[], remote: SavedTrip[], deleted: { id: string; at: number }[],
): Plan {
  const gone = new Set(deleted.map((d) => d.id));
  const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const L = byId(local);
  const R = byId(remote);

  const remove = remote.filter((r) => gone.has(r.id)).map((r) => r.id);

  const pull = remote.filter((r) => {
    if (gone.has(r.id)) return false;
    const l = L.get(r.id);
    return !l || r.updatedAt > l.updatedAt;
  });

  const push = local.filter((l) => {
    if (gone.has(l.id)) return false;
    const r = R.get(l.id);
    return !r || l.updatedAt > r.updatedAt;
  });

  return { pull, push, remove };
}

export interface SyncResult {
  ok: boolean;
  pulled: number;
  pushed: number;
  problem?: string;
}

/**
 * One pass in both directions. Called on sign-in, on load when already signed
 * in, and after the tab has been away — not on every keystroke, because the
 * local copy is already the one the person is reading.
 */
export async function syncNow(): Promise<SyncResult> {
  const db = supabase();
  const me = await currentAccount();
  if (!db || !me) return { ok: false, pulled: 0, pushed: 0, problem: "not signed in" };

  const gone = tombstones();

  const { data, error } = await db.from("trips").select("*").eq("user_id", me.id);
  if (error) return { ok: false, pulled: 0, pushed: 0, problem: error.message };

  const plan = planSync(listTrips(), (data as Row[]).map(fromRow), gone);

  // Deletions travel first, so a trip removed here isn't pulled back below.
  if (plan.remove.length) {
    await db.from("trips").delete().eq("user_id", me.id).in("id", plan.remove);
  }

  for (const t of plan.pull) saveTrip(t);
  const pulled = plan.pull.length;

  if (plan.push.length) {
    const { error: upErr } = await db.from("trips").upsert(plan.push.map((t) => toRow(t, me.id)));
    if (upErr) return { ok: false, pulled, pushed: 0, problem: upErr.message };
  }

  await syncProfile(me.id);
  return { ok: true, pulled, pushed: plan.push.length };
}

/** The same rule for what the agent has learned: newest wins. */
async function syncProfile(userId: string): Promise<void> {
  const db = supabase();
  if (!db) return;
  const mine = loadProfile() as TravelerProfile & { updatedAt?: number };
  const at = mine.updatedAt ?? 0;

  const { data } = await db.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  const theirs = data as { updated_at: string; data: TravelerProfile } | null;
  const theirAt = theirs ? new Date(theirs.updated_at).getTime() : 0;

  if (theirs && theirAt > at) {
    saveProfile({ ...theirs.data, updatedAt: theirAt } as TravelerProfile);
    return;
  }
  await db.from("profiles").upsert({
    user_id: userId,
    updated_at: new Date(at || Date.now()).toISOString(),
    data: mine,
  });
}

/** Push one trip as it changes. Fire and forget: local already has it. */
export async function pushTrip(t: SavedTrip): Promise<void> {
  const db = supabase();
  if (!db) return;
  const me = await currentAccount();
  if (!me) return;
  await db.from("trips").upsert(toRow(t, me.id));
}

export async function deleteRemote(id: string): Promise<void> {
  const db = supabase();
  if (!db) return;
  const me = await currentAccount();
  if (!me) return;
  await db.from("trips").delete().eq("user_id", me.id).eq("id", id);
}

export { syncAvailable };
