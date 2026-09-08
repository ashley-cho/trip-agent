"use client";

/**
 * Bring your own key.
 *
 * The deployment runs on one Anthropic key, which is Ashley's, so the shared
 * allowance has to stop somewhere. When it does, the honest options are to get
 * quietly worse, or to say so and offer a way through. This is the way
 * through: your key, your spend, no account, no payment page.
 *
 * Be straight about the trade. The key lives in this browser's storage, which
 * means any script that runs on this page could read it. That is a real risk
 * and the UI says so rather than burying it. It is sent to this app's own
 * server with each request, used for that one call, and never written down
 * there. Removing it here removes it everywhere.
 */

const KEY = "vamos.byok.v1";

/** Anthropic's format. Checked so a pasted mistake fails here, not mid-trip. */
export const looksLikeKey = (k: string) => /^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(k.trim());

export function ownKey(): string | null {
  try {
    const k = localStorage.getItem(KEY);
    return k && looksLikeKey(k) ? k : null;
  } catch {
    return null;
  }
}

export function setOwnKey(k: string): boolean {
  if (!looksLikeKey(k)) return false;
  try { localStorage.setItem(KEY, k.trim()); return true; } catch { return false; }
}

export function clearOwnKey(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}

/** For the UI: never show the whole thing back to anyone. */
export function maskKey(k: string): string {
  return `${k.slice(0, 11)}…${k.slice(-4)}`;
}

// --- what the app knows about the shared allowance --------------------------

type Listener = (state: LimitState) => void;

export interface LimitState {
  /** True once the server has told us the shared allowance is spent. */
  limited: boolean;
  /** "visitor" is you going too fast; "daily" is the whole deployment. */
  reason?: "visitor" | "daily";
  retryAfter?: number;
}

let state: LimitState = { limited: false };
const listeners = new Set<Listener>();

export function limitState(): LimitState { return state; }

export function onLimit(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function noteLimit(next: LimitState): void {
  // Once a key is in play the banner is wrong, so clearing is as important as
  // setting: a person who pastes a key should see the app recover, not a
  // stale warning telling them they are out of credit.
  if (state.limited === next.limited && state.reason === next.reason) return;
  state = next;
  for (const fn of listeners) fn(state);
}
