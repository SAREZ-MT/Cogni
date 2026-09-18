import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "./supabase-env";

export interface SessionUser {
  id: string;
  email: string | null;
}

// Runs in src/proxy.ts before every matched request: refreshes an expired
// access token with the refresh token and writes the new cookies onto the
// response. getUser() validates against Supabase, never trusts the cookie.
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: SessionUser | null }> {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    user: user ? { id: user.id, email: user.email ?? null } : null,
  };
}
