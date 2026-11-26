import type { ZodType } from "zod";
import type {
  AiBudgetGroup,
  AiGeneration,
  BreakerState,
  ProviderUsage,
} from "../domain";

// Ports of the ai application layer. They live here, not in `domain/`,
// because `AiProvider` needs the Zod `ZodType` type and `domain-is-pure`
// forbids npm imports there; keeping all ports together keeps one place to
// read them.

export interface GenerateObjectRequest<T> {
  readonly schema: ZodType<T>;
  readonly system: string;
  readonly prompt: string;
  readonly temperature: number;
  readonly maxOutputTokens?: number;
  // Cancels the model call. Adapters forward it to the transport so an
  // aborted attempt stops instead of running on in the background.
  readonly signal?: AbortSignal;
}

export interface GenerateObjectResponse {
  // Deliberately `unknown`: the use case validates it against the schema and
  // never trusts the adapter (documento-maestro §8.1).
  readonly object: unknown;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly latencyMs: number;
}

// One callable model endpoint. Adapters throw on transport/provider errors.
export interface AiProvider {
  readonly id: string;
  readonly model: string;
  generateObject<T>(
    request: GenerateObjectRequest<T>,
  ): Promise<GenerateObjectResponse>;
}

// Providers by `ProviderEntry.id`.
export type AiProviderMap = ReadonlyMap<string, AiProvider>;

// Per-provider request counters (documento-maestro §8.2). The infrastructure
// adapter keeps two Redis counters per provider:
//   ai:quota:{provider}:{yyyy-mm-dd}        TTL 48 h   (day)
//   ai:quota:{provider}:{yyyy-mm-dd-hh-mm}  TTL 120 s  (minute)
// Both buckets are derived from `now` in UTC. `{provider}` is the entry's
// quota key (`quotaKeyOf`): entries sharing a key share the counters.
export interface QuotaStore {
  readUsage(providerId: string, now: Date): Promise<ProviderUsage>;
  recordCall(providerId: string, now: Date): Promise<void>;
}

// App-wide daily budget per group (AI_GLOBAL_DAILY_*), shared by every user
// and bucketed by UTC day like the provider quota. `consume` charges one
// provider attempt and answers whether it fits the budget. Callers fail
// closed: a refusal or a thrown error means no model call.
export interface BudgetStore {
  consume(group: AiBudgetGroup, now: Date): Promise<boolean>;
}

export interface BreakerStore {
  read(providerId: string): Promise<BreakerState>;
  write(providerId: string, state: BreakerState): Promise<void>;
}

export interface AiGenerationRepository {
  create(generation: AiGeneration): Promise<void>;
  update(generation: AiGeneration): Promise<void>;
  // Always owner-scoped (documento-maestro §6.1): another owner's row is null.
  findById(id: string, ownerId: string): Promise<AiGeneration | null>;
}

// The kernel exposes `createId()` only as a function; this is the injectable
// shape so tests get deterministic ids.
export interface IdGenerator {
  next(): string;
}

// Per-owner daily generation limit (AI_DAILY_GENERATIONS). `check` CONSUMES
// one unit when it allows the call, so callers invoke it exactly once per
// generation request, before calling the model.
export interface GenerationRateLimit {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
}

export interface GenerationRateLimiter {
  check(ownerId: string): Promise<GenerationRateLimit>;
  // Reads the same window WITHOUT consuming a unit (`allowed` is whether a
  // call would be accepted now).
  peek(ownerId: string): Promise<GenerationRateLimit>;
}
