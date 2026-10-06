import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import {
  createNotebook,
  createPageAndOpen,
  openNotebook,
} from "./helpers/notebooks";

// Phase 3 acceptance flow (documento-maestro §3.3, §13): the student presses
// "Generar" on a page, the cards are persisted for that page and the page's
// deck shows up in /flashcards with the same count. Runs against the fake AI
// provider (AI_PROVIDER_MODE=fake, set by playwright.config.ts and CI): no
// provider keys, no Upstash, deterministic cards derived from the page text.

const SENTENCES = [
  "La mitocondria produce la mayor parte del ATP de la célula.",
  "La membrana interna forma pliegues llamados crestas mitocondriales.",
  "La matriz mitocondrial contiene enzimas del ciclo de Krebs.",
  "El ADN mitocondrial se hereda casi siempre por vía materna.",
].join(" ");

async function remainingToday(page: Page): Promise<number> {
  const text = await page.getByTestId("generation-remaining").innerText();
  const match = text.match(/(\d+)/);
  if (!match) throw new Error(`no counter in "${text}"`);
  return Number(match[1]);
}

test.describe("flashcards generation", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  // A test-scoped user: the fake AI daily limit (6 per owner, in server
  // memory) would otherwise be shared with every AI-spending spec in the
  // worker and run out depending on spec order.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("generates cards for a page, decrements the counter and lists the deck in /flashcards", async ({
    page,
  }) => {
    const title = `Cuaderno tarjetas ${randomUUID().slice(0, 8)}`;
    await createNotebook(page, title);
    await openNotebook(page, title);
    await createPageAndOpen(page);

    // Type into the editor and wait for the autosave to settle: generation
    // reads the persisted page text, not the editor's in-memory state.
    const editable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await editable.click();
    // Keys sent <15 ms after a click can precede Chrome's selectionchange.
    await page.waitForTimeout(100);
    await page.keyboard.type(SENTENCES);
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });

    const panel = page.getByTestId("techniques-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("flashcard-item")).toHaveCount(0);
    const before = await remainingToday(page);

    await page.getByTestId("generate-flashcards").click();

    await expect(page.getByTestId("flashcard-item").first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("generation-error")).toHaveCount(0);
    await expect.poll(() => remainingToday(page)).toBe(before - 1);

    // A second visit lists the persisted cards: open the deck from the panel.
    await page.reload();
    await expect(page.getByTestId("flashcard-item").first()).toBeVisible();
    await page.getByTestId("flashcard-item").first().click();
    await expect(page).toHaveURL(/\/flashcards\/[^/]+\/[^/#]+/);
    const cardCount = await page.getByTestId("flip-card").count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // The hub lists the notebook and its notebook page lists the page deck,
    // both with the same real count.
    await page.goto("/flashcards");
    const notebookDeck = page.getByRole("link", { name: new RegExp(title) });
    await expect(notebookDeck).toContainText(`${cardCount} tarjeta`);
    await notebookDeck.click();
    await expect(page).toHaveURL(/\/flashcards\/[^/]+$/);
    await expect(page.getByRole("link", { name: /Sin título/ })).toContainText(
      `${cardCount} tarjetas`,
    );
  });
});
