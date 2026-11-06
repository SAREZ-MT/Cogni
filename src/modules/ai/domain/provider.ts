import type { AiPurpose } from "./purpose";

// One configured model endpoint (documento-maestro §8.2). `priority` is
// ascending: 1 is tried first. `rpm`/`rpd` are the provider's free-tier
// request limits per minute and per day; for a provider limited by tokens
// they are the effective call counts its token budget allows.
export interface ProviderEntry {
  readonly id: string;
  readonly model: string;
  readonly capabilities: readonly AiPurpose[];
  readonly rpm: number;
  readonly rpd: number;
  readonly priority: number;
  // The quota counters the entry spends; entries sharing a key share one
  // `rpm`/`rpd` budget (an account-wide limit). Defaults to `id`.
  readonly quotaKey?: string;
  // Largest estimated prompt (system + prompt) the entry accepts; a bigger
  // one skips it. Unset means no ceiling.
  readonly maxPromptTokens?: number;
}

export function quotaKeyOf(entry: ProviderEntry): string {
  return entry.quotaKey ?? entry.id;
}

export interface ProviderUsage {
  readonly day: number;
  readonly minute: number;
}

export interface SelectionContext {
  readonly purpose: AiPurpose;
  readonly unhealthyIds: ReadonlySet<string>;
  // Keyed by quota key (`quotaKeyOf`), not by entry id.
  readonly usage: Readonly<Record<string, ProviderUsage>>;
  readonly exclude?: readonly string[];
  // Estimated tokens of the prompt about to be sent (estimateTokens).
  readonly promptTokens?: number;
}

function isEligible(entry: ProviderEntry, ctx: SelectionContext): boolean {
  if (!entry.capabilities.includes(ctx.purpose)) return false;
  if (ctx.unhealthyIds.has(entry.id)) return false;
  if (ctx.exclude?.includes(entry.id)) return false;
  if (
    entry.maxPromptTokens !== undefined &&
    (ctx.promptTokens ?? 0) > entry.maxPromptTokens
  ) {
    return false;
  }
  const used = ctx.usage[quotaKeyOf(entry)] ?? { day: 0, minute: 0 };
  return used.day < entry.rpd && used.minute < entry.rpm;
}

// Every eligible entry, best first: the order a retry walks.
export function nextProviders(
  entries: readonly ProviderEntry[],
  ctx: SelectionContext,
): ProviderEntry[] {
  return entries
    .filter((entry) => isEligible(entry, ctx))
    .sort((a, b) => a.priority - b.priority);
}

export function selectProvider(
  entries: readonly ProviderEntry[],
  ctx: SelectionContext,
): ProviderEntry | null {
  return nextProviders(entries, ctx)[0] ?? null;
}
