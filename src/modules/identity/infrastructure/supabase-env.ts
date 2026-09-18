import { clientEnv } from "@/shared/config/env.client";

// Public Supabase settings. Both are safe for the browser bundle; the
// service role key lives in env.server only.
export function getSupabaseEnv(): { url: string; publishableKey: string } {
  const env = clientEnv();
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
