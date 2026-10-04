import type { ProviderUsage } from "../../domain";
import type { QuotaStore } from "../ports";

export class InMemoryQuotaStore implements QuotaStore {
  readonly recorded: { providerId: string; now: Date }[] = [];
  private readonly usage = new Map<string, { day: number; minute: number }>();

  seed(providerId: string, usage: ProviderUsage): void {
    this.usage.set(providerId, { ...usage });
  }

  async readUsage(providerId: string, _now: Date): Promise<ProviderUsage> {
    return { ...(this.usage.get(providerId) ?? { day: 0, minute: 0 }) };
  }

  async recordCall(providerId: string, now: Date): Promise<void> {
    const current = this.usage.get(providerId) ?? { day: 0, minute: 0 };
    this.usage.set(providerId, {
      day: current.day + 1,
      minute: current.minute + 1,
    });
    this.recorded.push({ providerId, now });
  }
}
