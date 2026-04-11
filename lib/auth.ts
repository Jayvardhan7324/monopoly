import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase admin client.
 * Uses the service role key — bypasses RLS. Never expose to the browser.
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
