import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasConfig = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Real client when env vars are present; stub when not configured yet.
const _stub = {
  auth: {
    getSession:        async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_: any, __: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: null, error: { message: "Supabase not configured" } }),
    signUp:             async () => ({ data: null, error: { message: "Supabase not configured" } }),
    signInWithOAuth:    async () => ({ data: null, error: { message: "Supabase not configured" } }),
    signOut:            async () => ({ error: null }),
    getUser:            async () => ({ data: { user: null }, error: null }),
  },
} as any;

export const supabase = hasConfig
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : _stub;

/** Fetch helper that automatically injects the current user's Bearer token. */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
}
