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

const serverObject = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  // Long enough that a brute force against /api/keep-alive is pointless.
  CRON_SECRET: z.string().min(32),
  SENTRY_DSN: z.string().url().optional(),
  // Name of the private Supabase Storage bucket for page assets
  // (design.md, "Bucket privado `page-assets`, ruta canónica y RLS por
  // `owner_id`"). Server-only: never exposed to the client bundle.
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  // Name of the private bucket for imported PDFs (design.md, "Bucket privado
  // `page-pdfs` por migración"). Server-only, like SUPABASE_STORAGE_BUCKET.
  SUPABASE_PDF_BUCKET: z.string().min(1),
  // AI layer (documento-maestro §8). Provider keys are individually optional:
  // the refinement below requires at least one generation provider in live
  // mode. Server-only, never NEXT_PUBLIC_.
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
  CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Separates dev and prod keys inside the single free Upstash database.
  REDIS_KEY_PREFIX: z.string().min(1).default("cogni:dev"),
  // `fake` swaps real providers for a deterministic one (CI, e2e).
  AI_PROVIDER_MODE: z.enum(["live", "fake"]).default("live"),
  AI_DAILY_GENERATIONS: z.coerce.number().int().positive().default(6),
  AI_PAGE_TOKEN_CAP: z.coerce.number().int().positive().default(12000),
});

export const serverSchema = serverObject.superRefine((env, ctx) => {
  const missing = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  // A half-configured Cloudflare pair is always a mistake, in any mode.
  if (env.CLOUDFLARE_ACCOUNT_ID && !env.CLOUDFLARE_API_TOKEN) {
    missing(
      "CLOUDFLARE_API_TOKEN",
      "required when CLOUDFLARE_ACCOUNT_ID is set",
    );
  }
  if (env.CLOUDFLARE_API_TOKEN && !env.CLOUDFLARE_ACCOUNT_ID) {
    missing(
      "CLOUDFLARE_ACCOUNT_ID",
      "required when CLOUDFLARE_API_TOKEN is set",
    );
  }

  if (env.AI_PROVIDER_MODE !== "live") return;

  if (!env.UPSTASH_REDIS_REST_URL) {
    missing("UPSTASH_REDIS_REST_URL", "required when AI_PROVIDER_MODE=live");
  }
  if (!env.UPSTASH_REDIS_REST_TOKEN) {
    missing("UPSTASH_REDIS_REST_TOKEN", "required when AI_PROVIDER_MODE=live");
  }
  const hasProvider =
    env.GOOGLE_GENERATIVE_AI_API_KEY ||
    env.OPENROUTER_API_KEY ||
    (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN);
  if (!hasProvider) {
    missing(
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "at least one generation provider is required when AI_PROVIDER_MODE=live (GOOGLE_GENERATIVE_AI_API_KEY, OPENROUTER_API_KEY, or CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)",
    );
  }
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

// `.env.example` ships optional keys as `KEY=`; an empty value means unset.
function blankToUndefined(raw: RawEnv): RawEnv {
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
}

export function parseClientEnv(raw: RawEnv): ClientEnv {
  return parseOrThrow(clientSchema, blankToUndefined(raw), "client");
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  return parseOrThrow(serverSchema, blankToUndefined(raw), "server");
}
