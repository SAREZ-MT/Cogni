import "server-only";
import { parseServerEnv, type ServerEnv } from "./env.schema";

// Server secrets. `server-only` makes any import from a Client Component
// fail at build time, so SUPABASE_SERVICE_ROLE_KEY never reaches a bundle.
let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
