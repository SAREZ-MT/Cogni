import { z } from "zod";

// Pure schemas with no process.env access, so they can be unit tested.
// env.client.ts and env.server.ts apply them to the real environment.

const supabaseProjectUrl = z
  .string()
  .url()
  .refine((url) => new URL(url).pathname === "/", {
    message: "must be the project root, without /rest/v1 or a trailing path",
  });

export const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: supabaseProjectUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
});

export const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  // Long enough that a brute force against /api/keep-alive is pointless.
  CRON_SECRET: z.string().min(32),
  SENTRY_DSN: z.string().url().optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

type RawEnv = Record<string, string | undefined>;

// Zod's default message does not name the variable; boot errors must.
function parseOrThrow<T>(schema: z.ZodType<T>, raw: RawEnv, scope: string): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const problems = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid ${scope} environment: ${problems}`);
}

export function parseClientEnv(raw: RawEnv): ClientEnv {
  return parseOrThrow(clientSchema, raw, "client");
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  return parseOrThrow(serverSchema, raw, "server");
}
