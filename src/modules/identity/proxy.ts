// Light public entry for src/proxy.ts (Next.js 16's per-request proxy).
// identity's index.ts cannot be used there: it imports "server-only" and
// pulls in the database client and Sentry through its Server Actions, none
// of which may load in the proxy. This entry exposes only the session
// refresh the proxy needs, so src/proxy.ts still goes through a public
// module entry (`proxy-via-public-entry` in .dependency-cruiser.cjs)
// instead of reaching into identity/infrastructure directly.
export { updateSession } from "./infrastructure/supabase-proxy-client";
