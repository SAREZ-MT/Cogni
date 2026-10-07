import { and, eq } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { generationFingerprints } from "@/shared/db/schema";
import type { GenerationFingerprintRepository } from "@/shared/kernel/generation-fingerprints";

// The "flashcards" rows of generation_fingerprints (Phase 6 T5c). Built on
// the deck transaction, the fingerprints of a generation commit with its
// cards. Exams and active recall keep their own adapter bound to their
// technique: modules only meet through their index.
export class DrizzleFlashcardFingerprints
  implements GenerationFingerprintRepository
{
  constructor(private readonly db: DbExecutor) {}

  async listByPage(pageId: string, ownerId: string): Promise<string[]> {
    const rows = await this.db
      .select({ fingerprint: generationFingerprints.fingerprint })
      .from(generationFingerprints)
      .where(
        and(
          eq(generationFingerprints.pageId, pageId),
          eq(generationFingerprints.ownerId, ownerId),
          eq(generationFingerprints.technique, "flashcards"),
        ),
      );
    return rows.map((row) => row.fingerprint);
  }

  async addMany(input: {
    ownerId: string;
    pageId: string;
    fingerprints: readonly string[];
    now: Date;
  }): Promise<void> {
    if (input.fingerprints.length === 0) return;
    await this.db
      .insert(generationFingerprints)
      .values(
        input.fingerprints.map((fingerprint) => ({
          ownerId: input.ownerId,
          pageId: input.pageId,
          technique: "flashcards" as const,
          fingerprint,
          createdAt: input.now,
        })),
      )
      .onConflictDoNothing();
  }
}
