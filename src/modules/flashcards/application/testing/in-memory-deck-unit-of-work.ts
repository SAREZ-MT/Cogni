import type { StudyItem, StudyItemKind } from "@/modules/study-engine";
import {
  InMemoryGenerationFingerprintStore,
  type InMemoryGenerationFingerprints,
} from "@/shared/kernel/testing/in-memory-generation-fingerprints";
import type {
  DeckRepositories,
  DeckStudyItems,
  DeckUnitOfWork,
} from "../deck-unit-of-work";
import { InMemoryFlashcardRepository } from "./in-memory-flashcard-repository";

// Minimal in-memory DeckStudyItems. The full fake lives in study-engine's
// testing.ts, which cross-module-via-index keeps out of reach of this
// module; this one covers only the methods a deck change uses, with
// the same unique (kind, sourceId) rule as the database.
export class InMemoryDeckStudyItems implements DeckStudyItems {
  private readonly rows = new Map<string, StudyItem>();

  async save(item: StudyItem): Promise<void> {
    const existing = this.rows.get(item.id);
    if (existing && existing.ownerId !== item.ownerId) return;
    for (const row of this.rows.values()) {
      if (
        row.id !== item.id &&
        row.kind === item.kind &&
        row.sourceId === item.sourceId
      ) {
        throw new Error("duplicate study item for (kind, sourceId)");
      }
    }
    this.rows.set(item.id, item);
  }

  async findBySource(
    kind: StudyItemKind,
    sourceId: string,
    ownerId: string,
  ): Promise<StudyItem | null> {
    for (const row of this.rows.values()) {
      if (
        row.kind === kind &&
        row.sourceId === sourceId &&
        row.ownerId === ownerId
      ) {
        return row;
      }
    }
    return null;
  }

  async suspend(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<StudyItem | null> {
    const item = this.rows.get(id);
    if (!item || item.ownerId !== ownerId) return null;
    if (item.suspendedAt !== null) return item;
    const suspended = { ...item, suspendedAt: now, updatedAt: now };
    this.rows.set(id, suspended);
    return suspended;
  }

  async deleteBySource(
    kind: StudyItemKind,
    sourceId: string,
    ownerId: string,
  ): Promise<void> {
    for (const [id, row] of this.rows) {
      if (
        row.kind === kind &&
        row.sourceId === sourceId &&
        row.ownerId === ownerId
      ) {
        this.rows.delete(id);
      }
    }
  }

  // Test helper: every stored item, in insertion order.
  all(): StudyItem[] {
    return [...this.rows.values()];
  }
}

// Runs `work` directly against the fakes. It cannot roll back; atomicity is
// proven against the database by the Drizzle unit of work's DB test.
export class InMemoryDeckUnitOfWork implements DeckUnitOfWork {
  runs = 0;

  constructor(
    readonly flashcards = new InMemoryFlashcardRepository(),
    readonly studyItems = new InMemoryDeckStudyItems(),
    readonly fingerprints: InMemoryGenerationFingerprints = new InMemoryGenerationFingerprintStore().forTechnique(
      "flashcards",
    ),
  ) {}

  async run<T>(work: (repositories: DeckRepositories) => Promise<T>) {
    this.runs += 1;
    return work({
      flashcards: this.flashcards,
      studyItems: this.studyItems,
      fingerprints: this.fingerprints,
    });
  }
}
