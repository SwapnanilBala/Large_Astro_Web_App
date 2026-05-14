/**
 * Build a per-request Supabase client that acts as the authenticated user.
 *
 * The project does not currently expose a service-role key in any helper,
 * so we authenticate with the anon key + the caller's bearer token. This
 * keeps row-level security policies in effect (auth.uid() resolves to the
 * caller), which is what the existing client_readings / saved_charts code
 * relies on as well.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getServerSupabaseForUser(
  accessToken: string,
): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
