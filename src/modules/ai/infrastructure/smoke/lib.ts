import type { ProviderEntry } from "../../domain";
import { QUOTA_DAY_TTL_SECONDS, quotaKeys } from "../upstash-quota-store";

// Pure helpers of the manual provider smoke script (scripts/ai-smoke.mts).
// No network and no env access here: the script owns the thin I/O part.

export const DEFAULT_EXHAUST_PROVIDER = "gemini-flash-lite";

export interface SmokeOptions {
  mode: "run" | "restore";
  exhaust: string;
  dryRun: boolean;
}

export type ParsedArgs =
  | { ok: true; options: SmokeOptions }
  | { ok: false; error: string };

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const options: SmokeOptions = {
    mode: "run",
    exhaust: DEFAULT_EXHAUST_PROVIDER,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--restore") options.mode = "restore";
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--exhaust") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        return { ok: false, error: "--exhaust needs a provider id" };
      }
      options.exhaust = value;
      i++;
    } else if (arg.startsWith("--exhaust=")) {
      const value = arg.slice("--exhaust=".length);
      if (!value) return { ok: false, error: "--exhaust needs a provider id" };
      options.exhaust = value;
    } else {
      return { ok: false, error: `Unknown argument: ${arg}` };
    }
  }
  return { ok: true, options };
}

export interface ExhaustionPlan {
  providerId: string;
  // The provider's day quota key, the only quota key the script overwrites.
  dayKey: string;
  // Holds the previous day counter so --restore can put it back.
  backupKey: string;
  value: number;
  ttlSeconds: number;
}

export function smokeBackupKey(prefix: string, providerId: string): string {
  return `${prefix}:ai:smoke:backup:${providerId}`;
}

export function planExhaustion(input: {
  prefix: string;
  providerId: string;
  entries: readonly ProviderEntry[];
  now: Date;
}): { ok: true; plan: ExhaustionPlan } | { ok: false; error: string } {
  const entry = input.entries.find((e) => e.id === input.providerId);
  if (!entry) {
    const known = input.entries.map((e) => e.id).join(", ");
    return {
      ok: false,
      error: `Unknown provider "${input.providerId}". Known: ${known}`,
    };
  }
  return {
    ok: true,
    plan: {
      providerId: entry.id,
      dayKey: quotaKeys(input.prefix, entry.id, input.now).day,
      backupKey: smokeBackupKey(input.prefix, entry.id),
      value: entry.rpd,
      ttlSeconds: QUOTA_DAY_TTL_SECONDS,
    },
  };
}

export interface SmokeRow {
  step: string;
  provider: string;
  model: string;
  status: string;
  tokens: number;
  latencyMs: number;
}

// Done criterion of documento-maestro §13: with one provider exhausted, the
// next one serves.
export function evaluateOutcome(
  exhaustedId: string,
  baseline: SmokeRow,
  afterExhaustion: SmokeRow,
): { pass: true } | { pass: false; reason: string } {
  if (baseline.status !== "done") {
    return { pass: false, reason: "step 1 did not complete" };
  }
  if (afterExhaustion.status !== "done") {
    return { pass: false, reason: "step 2 did not complete" };
  }
  if (afterExhaustion.provider === exhaustedId) {
    return {
      pass: false,
      reason: `${exhaustedId} still served after its quota was exhausted`,
    };
  }
  return { pass: true };
}

function pad(value: string, width: number): string {
  return value.padEnd(width, " ");
}

export function formatSummary(rows: readonly SmokeRow[]): string {
  const header = ["step", "provider", "model", "status", "tokens", "latency"];
  const body = rows.map((r) => [
    r.step,
    r.provider,
    r.model,
    r.status,
    String(r.tokens),
    `${r.latencyMs} ms`,
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...body.map((row) => (row[i] as string).length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((c, i) => pad(c, widths[i] as number))
      .join("  ")
      .trimEnd();
  return [
    line(header),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...body.map(line),
  ].join("\n");
}
