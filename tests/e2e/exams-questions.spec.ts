import { randomUUID } from "node:crypto";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedExamQuestions } from "./helpers/exam-questions";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// A page's exam questions (Phase 5 T4): questions are created by AI (Phase 8
// H13), so they are seeded straight into the database. Since Phase 8 H18
// (user 2026-10-29) they are managed on the edit page (technique-edit-pages
// edits, adds and deletes them); the old "Preguntas" route redirects there.

test.describe("exam questions", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("the edit page sends a page without questions to its panel and lists seeded ones", async ({
    page,
  }) => {
    const notebookTitle = `Cuaderno examen ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");

    await page.goto(`/exams/${notebookId}/${pageId}/preguntas`);
    await expect(page).toHaveURL(`/exams/${notebookId}/${pageId}/editar`);
    await expect(
      page.getByText("Esta página aún no tiene preguntas"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Generar desde la página" }),
    ).toHaveAttribute("href", `/notebooks/${notebookId}/pages/${pageId}`);

    await seedExamQuestions(pageId, [
      {
        stem: "¿Cuál es la opción correcta?",
        options: ["Opción A", "Opción B", "Opción C", "Opción D"],
        correctIndex: 1,
        concept: "Concepto",
      },
    ]);
    await page.reload();
    await expect(page.getByTestId("item-editor-entry")).toHaveCount(1);
    await expect(page.getByLabel("Opción B es la correcta")).toBeChecked();

    // The hub lists the page: "Crear examen" is the grid's first tile,
    // never a header button (Phase 8 H13).
    await page.goto("/exams");
    await expect(page.getByTestId("create-exam-tile")).toBeVisible();
    await expect(page.getByTestId("create-exam-button")).toHaveCount(0);
  });
});
