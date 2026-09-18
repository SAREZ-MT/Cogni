import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./supabase-env";

// Browser client for future client-side needs (realtime, storage uploads).
// Phase 0 auth flows run entirely through Server Actions.
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
