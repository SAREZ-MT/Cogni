import { randomUUID } from "node:crypto";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedFlashcards } from "./helpers/flashcards";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// A page's deck (Phase 4, documento-maestro §3.3). Cards are created by AI
// (Phase 8 H13), so they are seeded straight into the database. Since
// Phase 8 H18 (user 2026-10-29) opening a deck practises it at once and
// the cards are listed on the edit page instead (technique-edit-pages).

test.describe("flashcard deck", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("a page without cards links to its techniques panel; a deck plays at once", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno mazo ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");

    // A page without cards has no deck yet, here and on the edit page.
    for (const path of ["", "/editar"]) {
      await page.goto(`/flashcards/${notebookId}/${pageId}${path}`);
      await expect(
        page.getByText("Esta página aún no tiene tarjetas"),
      ).toBeVisible();
      await expect(page.getByText("Nueva tarjeta")).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Generar desde la página" }),
      ).toHaveAttribute("href", `/notebooks/${notebookId}/pages/${pageId}`);
    }

    await seedFlashcards(pageId, [
      { front: "Pregunta A", back: "Respuesta A" },
    ]);
    await page.goto(`/flashcards/${notebookId}/${pageId}`);
    await expect(page.getByTestId("flashcard-player")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Pregunta A")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Archivar tarjeta" }),
    ).toHaveCount(0);
  });
});
