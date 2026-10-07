import type {
  GenerationFingerprintRepository,
  GenerationTechnique,
} from "../generation-fingerprints";

interface FingerprintRow {
  readonly ownerId: string;
  readonly pageId: string;
  readonly technique: GenerationTechnique;
  readonly fingerprint: string;
  readonly createdAt: Date;
}

// In-memory generation_fingerprints: one store, one repository per
// technique (forTechnique), with the table's unique (owner, page,
// technique, fingerprint) rule.
export class InMemoryGenerationFingerprintStore {
  readonly rows = new Map<string, FingerprintRow>();

  forTechnique(technique: GenerationTechnique): InMemoryGenerationFingerprints {
    return new InMemoryGenerationFingerprints(this, technique);
  }

  // Test helpers for transactional fakes.
  snapshot(): FingerprintRow[] {
    return [...this.rows.values()];
  }

  restore(rows: readonly FingerprintRow[]): void {
    this.rows.clear();
    for (const row of rows) this.rows.set(keyOf(row), row);
  }
}

function keyOf(row: Omit<FingerprintRow, "createdAt">): string {
  return [row.ownerId, row.pageId, row.technique, row.fingerprint].join("|");
}

export class InMemoryGenerationFingerprints
  implements GenerationFingerprintRepository
{
  constructor(
    readonly store: InMemoryGenerationFingerprintStore,
    readonly technique: GenerationTechnique,
  ) {}

  async listByPage(pageId: string, ownerId: string): Promise<string[]> {
    return [...this.store.rows.values()]
      .filter(
        (row) =>
          row.pageId === pageId &&
          row.ownerId === ownerId &&
          row.technique === this.technique,
      )
      .map((row) => row.fingerprint);
  }

  async addMany(input: {
    ownerId: string;
    pageId: string;
    fingerprints: readonly string[];
    now: Date;
  }): Promise<void> {
    for (const fingerprint of input.fingerprints) {
      const row = {
        ownerId: input.ownerId,
        pageId: input.pageId,
        technique: this.technique,
        fingerprint,
        createdAt: input.now,
      };
      const key = keyOf(row);
      if (!this.store.rows.has(key)) this.store.rows.set(key, row);
    }
  }
}
