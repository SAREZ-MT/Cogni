import type { AiPurpose } from "./purpose";

// One configured model endpoint (documento-maestro §8.2). `priority` is
// ascending: 1 is tried first. `rpm`/`rpd` are the provider's free-tier
// request limits per minute and per day.
export interface ProviderEntry {
  readonly id: string;
  readonly model: string;
  readonly capabilities: readonly AiPurpose[];
  readonly rpm: number;
  readonly rpd: number;
  readonly priority: number;
}

export interface ProviderUsage {
  readonly day: number;
  readonly minute: number;
}

export interface SelectionContext {
  readonly purpose: AiPurpose;
  readonly unhealthyIds: ReadonlySet<string>;
  readonly usage: Readonly<Record<string, ProviderUsage>>;
  readonly exclude?: readonly string[];
}

function isEligible(entry: ProviderEntry, ctx: SelectionContext): boolean {
  if (!entry.capabilities.includes(ctx.purpose)) return false;
  if (ctx.unhealthyIds.has(entry.id)) return false;
  if (ctx.exclude?.includes(entry.id)) return false;
  const used = ctx.usage[entry.id] ?? { day: 0, minute: 0 };
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
