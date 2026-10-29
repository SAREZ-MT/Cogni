import { randomUUID } from "node:crypto";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedFlashcards } from "./helpers/flashcards";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";

// Phase 4 AI session feedback (documento-maestro §3.3, §8.4): finishing a
// graded review closes the session and shows the AI feedback in the
// summary. Runs against the deterministic fake provider
// (AI_PROVIDER_MODE=fake); the failure path (calm note, session still
// closed) is covered by the use case and DeckReview unit tests.

// Optional: a directory to drop the summary screenshot in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

test.describe("flashcard session feedback", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("shows the AI feedback once the review session ends", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno feedback ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await page.goto(`/flashcards/${notebookId}/${pageId}`);

    // Cards are created by AI only (Phase 8 H13): seed one straight in.
    await seedFlashcards(pageId, [
      { front: "¿Qué es la meiosis?", back: "División reductora" },
    ]);
    await page.reload();

    await clickAndWaitForAction(
      page,
      page.getByTestId("start-review-button"),
      "pageId",
    );
    const player = page.getByTestId("flashcard-player");
    await expect(player).toBeVisible();
    await player.getByRole("button", { name: "Mostrar respuesta" }).click();
    await clickAndWaitForAction(
      page,
      player.getByTestId("rate-hard"),
      '"hard"',
    );

    const summary = page.getByRole("dialog", { name: "¡Sesión completada!" });
    await expect(summary).toBeVisible();
    const feedback = summary.getByRole("region", {
      name: "Retroalimentación de la sesión",
    });
    // The fake provider's schema-valid session_feedback object.
    await expect(feedback).toContainText("Resumen de ejemplo");
    await expect(
      feedback.getByRole("list", { name: "Lo que recordaste bien" }),
    ).toContainText("Constancia");
    await expect(
      feedback.getByRole("list", { name: "Conviene reforzar" }),
    ).toContainText("Repaso");
    await expect(feedback).toContainText("Repasa mañana");
    await expect(feedback).toHaveAttribute("aria-busy", "false");
    if (SCREENSHOT_DIR) {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/review-session-feedback.png`,
      });
    }

    // The session is closed: back on the deck, nothing is left to review.
    await summary.getByRole("button", { name: "Volver al mazo" }).click();
    await expect(page.getByTestId("flashcard-player")).toHaveCount(0);
    await clickAndWaitForAction(
      page,
      page.getByTestId("start-review-button"),
      "pageId",
    );
    await expect(page.getByText("Estás al día")).toBeVisible();
  });
});
