/**
 * Where the database is, for both sides of the app.
 *
 * The client (lib/supabase.ts) and the feedback route both need this, and
 * lib/supabase.ts is a "use client" module, so the values live here where
 * server code can read them too rather than being written down twice.
 *
 * These are the PUBLISHABLE pair, which is designed to sit in the page; row
 * level security is what protects the rows, not the secrecy of this string.
 * The service-role key is the secret one, is not in this repo, and is read
 * from the environment by server code only.
 */
export function supabaseConfig(): { url: string; key: string } {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL
      ?? "https://bzhlpvcoldcqcyctkpsw.supabase.co",
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ?? "sb_publishable_u2g_ZYsKQlBVscxcHrAYeA_Es2k07gv",
  };
}
