import type { PageTextReader } from "@/modules/notebooks";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { type ExamQuestion, newExamQuestion } from "../../domain/exam-question";

export const OWNER = "owner-1";
export const OTHER = "owner-2";
export const PAGE = "page-1";
export const NOW = new Date("2026-10-05T10:00:00.000Z");
export const LATER = new Date("2026-10-06T10:00:00.000Z");

// The page exists and is active only for OWNER; any other page or owner is
// PAGE_NOT_FOUND, like notebooks' getPageText.
export const pages: PageTextReader = {
  async getPageText(pageId, ownerId) {
    if (pageId !== PAGE || ownerId !== OWNER) {
      return err(new DomainError("PAGE_NOT_FOUND", pageId));
    }
    return ok({ title: "Mitocondria", plainText: "" });
  },
};

export const CONTENT = {
  stem: "¿Qué produce la mitocondria?",
  options: ["ATP", "ADN", "Lípidos", "Almidón"],
  correctIndex: 0,
  explanation: "La respiración celular produce ATP.",
  concept: "Función de la mitocondria",
};

// A stored-ready manual question; override any field.
export function question(
  id: string,
  overrides: Partial<ExamQuestion> = {},
): ExamQuestion {
  const created = newExamQuestion(
    {
      ...CONTENT,
      id,
      ownerId: OWNER,
      pageId: PAGE,
      origin: "manual",
      generationId: null,
    },
    NOW,
  );
  if (!created.ok) throw created.error;
  return { ...created.value, ...overrides };
}
