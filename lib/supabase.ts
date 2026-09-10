"use client";

import { supabaseConfig } from "@/lib/supabase-config";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The account, when there is one.
 *
 * Sync is an addition, not a requirement. With no Supabase configured — a
 * local build, the standalone bundle, a fork — every one of these returns
 * null and the app behaves exactly as it did before: trips in this browser,
 * no sign-in, nothing to run. That is the fallback, not an error state.
 *
 * The key in the page is the publishable one, which is meant to be public.
 * What keeps one person's trips out of another's is row-level security in the
 * database, not the secrecy of this string.
 */

/*
 * The project's own values, as the fallback, on purpose.
 *
 * The comment above already says why that is safe: the key is designed to sit
 * in the page, and what keeps one person's trips out of another's is
 * row-level security, not the secrecy of this string.
 *
 * They are a fallback because relying on the environment alone has now failed
 * twice in production, silently both times. A `vercel --prod` from the
 * directory does not carry .env.local, so the deployment came up with no
 * database, the votes it collected went to localStorage and nowhere else, and
 * the screen said "Noted, and it becomes a test." to someone whose feedback
 * was reaching nothing. A configuration step that is invisible when you
 * forget it is a trap, not a configuration step.
 *
 * The environment still wins where it is set.
 */
const { url, key } = supabaseConfig();

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!url || !key) return null;
  if (typeof window === "undefined") return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export const syncAvailable = () => Boolean(url && key);
