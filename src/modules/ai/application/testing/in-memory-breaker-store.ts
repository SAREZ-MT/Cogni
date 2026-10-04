import { type BreakerState, initialBreakerState } from "../../domain";
import type { BreakerStore } from "../ports";

export class InMemoryBreakerStore implements BreakerStore {
  private readonly states = new Map<string, BreakerState>();

  async read(providerId: string): Promise<BreakerState> {
    return this.states.get(providerId) ?? initialBreakerState;
  }

  async write(providerId: string, state: BreakerState): Promise<void> {
    this.states.set(providerId, state);
  }
}
