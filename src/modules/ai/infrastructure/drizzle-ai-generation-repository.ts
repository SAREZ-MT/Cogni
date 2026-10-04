import { and, eq } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { type AiGenerationRow, aiGenerations } from "@/shared/db/schema";
import type { AiGenerationRepository } from "../application/ports";
import type { AiGeneration } from "../domain";

function toGeneration(row: AiGenerationRow): AiGeneration {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    purpose: row.purpose,
    provider: row.provider,
    model: row.model,
    promptVersion: row.promptVersion,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    latencyMs: row.latencyMs,
    status: row.status,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Drizzle implementation of AiGenerationRepository. Every statement filters
// by owner_id (documento-maestro §6.1), so another owner's row is never read
// or written.
export class DrizzleAiGenerationRepository implements AiGenerationRepository {
  constructor(private readonly db: Db) {}

  async create(generation: AiGeneration): Promise<void> {
    await this.db.insert(aiGenerations).values({
      id: generation.id,
      ownerId: generation.ownerId,
      pageId: generation.pageId,
      purpose: generation.purpose,
      provider: generation.provider,
      model: generation.model,
      promptVersion: generation.promptVersion,
      inputTokens: generation.inputTokens,
      outputTokens: generation.outputTokens,
      latencyMs: generation.latencyMs,
      status: generation.status,
      error: generation.error,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt,
    });
  }

  async update(generation: AiGeneration): Promise<void> {
    await this.db
      .update(aiGenerations)
      .set({
        provider: generation.provider,
        model: generation.model,
        inputTokens: generation.inputTokens,
        outputTokens: generation.outputTokens,
        latencyMs: generation.latencyMs,
        status: generation.status,
        error: generation.error,
        updatedAt: generation.updatedAt,
      })
      .where(
        and(
          eq(aiGenerations.id, generation.id),
          eq(aiGenerations.ownerId, generation.ownerId),
        ),
      );
  }

  async findById(id: string, ownerId: string): Promise<AiGeneration | null> {
    const row = await this.db.query.aiGenerations.findFirst({
      where: and(eq(aiGenerations.id, id), eq(aiGenerations.ownerId, ownerId)),
    });
    return row ? toGeneration(row) : null;
  }
}
