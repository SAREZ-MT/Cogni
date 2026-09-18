import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./supabase-env";

// Server Components, Server Actions and Route Handlers share this client.
// setAll throws inside a Server Component render; that is expected, the
// proxy already refreshed the session cookies for that request.
export async function createSupabaseServerClient() {
  // cookies() first: it opts the route into dynamic rendering, so a build
  // without Supabase env never reaches the env check.
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component render: cookies are read-only here.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;
