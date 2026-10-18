import type { PageTextReader } from "@/modules/notebooks";
import { newStudyItem, type StudyItem } from "@/modules/study-engine";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import {
  newRecallQuestion,
  type RecallQuestion,
} from "../../domain/recall-question";
import type { InMemoryRecallSessionUnitOfWork } from "./in-memory-recall-session-unit-of-work";

// Shared data of the recall session use case tests.
export const OWNER = "owner-1";
export const OTHER_OWNER = "owner-2";
export const PAGE = "page-1";
export const OTHER_PAGE = "page-2";
export const NOW = new Date("2026-10-06T12:00:00.000Z");
export const DAY = 86_400_000;
// The owner's local day (UTC here) ends at midnight: reviews are due per
// day, so a question due before it is due now.
export const TOMORROW = new Date("2026-10-07T00:00:00.000Z");
export const dueCutoff = (now: Date): Date => {
  if (now.getTime() !== NOW.getTime()) throw new Error("unexpected instant");
  return TOMORROW;
};

export function at(days: number): Date {
  return new Date(NOW.getTime() + days * DAY);
}

// The owner's pages: PAGE and OTHER_PAGE; anything else is PAGE_NOT_FOUND.
export const pages: PageTextReader = {
  async getPageText(pageId, ownerId) {
    if (ownerId !== OWNER || ![PAGE, OTHER_PAGE].includes(pageId)) {
      return err(new DomainError("PAGE_NOT_FOUND", `page ${pageId}`));
    }
    return ok({ title: "Mitocondria", plainText: "La mitocondria…" });
  },
};

export interface SeedQuestion {
  id: string;
  pageId?: string;
  ownerId?: string;
  // Days from NOW the question was created (default: -30 + its index).
  createdDay?: number;
  archived?: boolean;
  // SM-2 state of its study item; omitted → a new (never reviewed) item.
  reviewedDay?: number;
  dueDay?: number;
  suspended?: boolean;
  // No study item at all.
  noItem?: boolean;
}

// Stores questions and their study items in the fake unit of work.
export async function seedQuestions(
  uow: InMemoryRecallSessionUnitOfWork,
  seeds: readonly SeedQuestion[],
): Promise<RecallQuestion[]> {
  const questions: RecallQuestion[] = [];
  const items: StudyItem[] = [...uow.repos.studyItems.all()];
  seeds.forEach((seed, index) => {
    const createdAt = at(seed.createdDay ?? -30 + index);
    const created = newRecallQuestion(
      {
        id: seed.id,
        ownerId: seed.ownerId ?? OWNER,
        pageId: seed.pageId ?? PAGE,
        prompt: `¿Pregunta ${seed.id}?`,
        rubric: {
          keyConcepts: ["ATP"],
          acceptableAnswerSummary: "Resumen.",
        },
        origin: "manual",
        generationId: null,
      },
      createdAt,
    );
    if (!created.ok) throw created.error;
    const question = seed.archived
      ? { ...created.value, archivedAt: createdAt }
      : created.value;
    questions.push(question);
    if (seed.noItem) return;
    const item = newStudyItem({
      id: `item-${seed.id}`,
      ownerId: question.ownerId,
      pageId: question.pageId,
      kind: "recall_question",
      sourceId: question.id,
      now: createdAt,
    });
    items.push({
      ...item,
      lastReviewedAt:
        seed.reviewedDay === undefined ? null : at(seed.reviewedDay),
      dueAt: seed.dueDay === undefined ? item.dueAt : at(seed.dueDay),
      suspendedAt: seed.suspended ? createdAt : null,
    });
  });
  await uow.repos.questions.saveMany(questions);
  uow.repos.studyItems.restore(items);
  return questions;
}
