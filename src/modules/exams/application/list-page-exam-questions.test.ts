import { describe, expect, it } from "vitest";
import { listPageExamQuestions } from "./list-page-exam-questions";
import { NOW, OTHER, OWNER, PAGE, question } from "./testing/fixtures";
import { InMemoryExamQuestionRepository } from "./testing/in-memory-exam-repositories";

describe("listPageExamQuestions", () => {
  it("lists the page's active questions oldest first, with their concept", async () => {
    const questions = new InMemoryExamQuestionRepository();
    await questions.save(
      question("q-2", { createdAt: new Date("2026-10-05T11:00:00Z") }),
    );
    await questions.save(question("q-1", { concept: "Crestas" }));
    await questions.save(question("q-3", { retiredAt: NOW }));
    await questions.save(question("q-4", { pageId: "page-2" }));
    await questions.save(question("q-5", { ownerId: OTHER }));

    const result = await listPageExamQuestions(
      { pageId: PAGE },
      { questions },
      OWNER,
    );

    expect(result.ok && result.value.map((q) => q.id)).toEqual(["q-1", "q-2"]);
    expect(result.ok && result.value[0]?.concept).toBe("Crestas");
  });

  it("shows nothing of a page to another owner", async () => {
    const questions = new InMemoryExamQuestionRepository();
    await questions.save(question("q-1"));

    const result = await listPageExamQuestions(
      { pageId: PAGE },
      { questions },
      OTHER,
    );

    expect(result).toEqual({ ok: true, value: [] });
  });
});
