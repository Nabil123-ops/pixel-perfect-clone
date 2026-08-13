/**
 * Public (non-secret) Supabase configuration.
 *
 * The project URL and the publishable/anon key are public values by design:
 * they ship in every browser bundle and are protected by Row Level Security.
 * They live here because Lovable reserves the `SUPABASE_*` / `VITE_SUPABASE_*`
 * secret names for its managed Cloud, so an own-project setup cannot store them
 * under those names.
 *
 * Secret values (service role, credential encryption key) are NEVER here —
 * they come from `process.env` on the server only.
 */
export const PUBLIC_SUPABASE_URL = "https://ersfbxnrouwgnpzyvqed.supabase.co";

export const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyc2ZieG5yb3V3Z25wenl2cWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMDY5ODYsImV4cCI6MjEwMTc4Mjk4Nn0.KxzOmnMEsBiQClWvaGQDNjwbpwC9OgqM1_RuHaC6CRU";

export const PUBLIC_SUPABASE_PROJECT_ID = "ersfbxnrouwgnpzyvqed";

/** Server-side resolver: explicit env wins, committed public config is the fallback. */
export function serverSupabaseUrl(): string {
  return (
    process.env["APP_SUPABASE_URL"] || process.env["SUPABASE_URL"] || PUBLIC_SUPABASE_URL
  );
}

export function serverSupabasePublishableKey(): string {
  return (
    process.env["APP_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function serverSupabaseServiceRoleKey(): string {
  const key =
    process.env["APP_SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) {
    throw new Error(
      "Missing APP_SUPABASE_SERVICE_ROLE_KEY. Add it in Lovable secrets and via `wrangler secret put APP_SUPABASE_SERVICE_ROLE_KEY`.",
    );
  }
  return key;
}
