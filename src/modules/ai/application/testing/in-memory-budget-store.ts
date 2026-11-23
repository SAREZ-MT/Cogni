import type { AiBudgetGroup } from "../../domain";
import type { BudgetStore } from "../ports";

// Unlimited by default; tests cap a group, exhaust it or make the store fail.
export class InMemoryBudgetStore implements BudgetStore {
  readonly consumed: AiBudgetGroup[] = [];
  private readonly limits = new Map<AiBudgetGroup, number>();
  private failure: Error | null = null;

  limit(group: AiBudgetGroup, calls: number): void {
    this.limits.set(group, calls);
  }

  exhaust(group: AiBudgetGroup): void {
    this.limits.set(group, 0);
  }

  failWith(error: Error): void {
    this.failure = error;
  }

  async consume(group: AiBudgetGroup, _now: Date): Promise<boolean> {
    if (this.failure) throw this.failure;
    const used = this.consumed.filter((g) => g === group).length;
    if (used >= (this.limits.get(group) ?? Number.POSITIVE_INFINITY)) {
      return false;
    }
    this.consumed.push(group);
    return true;
  }
}
