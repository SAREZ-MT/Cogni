import type { ImportRateLimiter } from "../../domain/import-rate-limiter";

// Test double for ImportRateLimiter (document-import T9b): allows every
// attempt until `refuse()`, and records the keys it was asked to consume.
export class FakeImportRateLimiter implements ImportRateLimiter {
  readonly consumed: string[] = [];
  private refusing = false;

  refuse(): void {
    this.refusing = true;
  }

  async consume(ownerId: string): Promise<{ allowed: boolean }> {
    this.consumed.push(ownerId);
    return { allowed: !this.refusing };
  }
}
