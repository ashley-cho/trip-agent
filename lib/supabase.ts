"use client";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
