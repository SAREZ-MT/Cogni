import type { AiGeneration } from "../../domain";
import type { AiGenerationRepository } from "../ports";

export class InMemoryAiGenerationRepository implements AiGenerationRepository {
  private readonly rows = new Map<string, AiGeneration>();

  async create(generation: AiGeneration): Promise<void> {
    this.rows.set(generation.id, generation);
  }

  // Owner-scoped like the Drizzle adapter: a row owned by someone else is
  // never touched.
  async update(generation: AiGeneration): Promise<void> {
    const existing = this.rows.get(generation.id);
    if (!existing || existing.ownerId !== generation.ownerId) return;
    this.rows.set(generation.id, generation);
  }

  async findById(id: string, ownerId: string): Promise<AiGeneration | null> {
    const row = this.rows.get(id);
    return row && row.ownerId === ownerId ? row : null;
  }

  // Insertion order, for assertions.
  all(): AiGeneration[] {
    return [...this.rows.values()];
  }
}
