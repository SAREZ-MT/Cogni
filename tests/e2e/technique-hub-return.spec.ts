import { randomUUID } from "node:crypto";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedFlashcards } from "./helpers/flashcards";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { seedRecallQuestions } from "./helpers/recall-questions";

// Phase 8 H16 (documento-maestro §3.3): a hub's "create from a page" dialog
// opens the practice route with `?desde=hub`; leaving it returns to that
// hub, which now lists what was just created, even before a session is
// finished. No AI call: the generated rows are seeded straight into the
// database and the spec opens the URL the dialog pushes (its push is
// covered by create-from-page-dialog.test.tsx).

const PROMPTS = [
  "¿Qué produce la mitocondria?",
  "¿Dónde ocurre la glucólisis?",
  "¿Qué forma la membrana interna?",
];

test.describe("technique hub return flow", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");
  test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL (cogni-dev)");

  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("recall: back from a session opened from the hub returns to the hub, which lists the page", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno retorno ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await seedRecallQuestions(pageId as string, PROMPTS);

    await page.goto("/active-recall");
    await page.goto(`/active-recall/${notebookId}/${pageId}?desde=hub`);
    await expect(
      page.getByText(`Pregunta 1 de ${PROMPTS.length}`),
    ).toBeVisible();

    // The in-app back link returns to the hub, which shows the notebook.
    await page.getByRole("link", { name: /Todas las sesiones/ }).click();
    await expect(page).toHaveURL(/\/active-recall$/);
    const notebookCard = page.getByRole("link", {
      name: new RegExp(notebookTitle),
    });
    await expect(notebookCard).toBeVisible();
    await expect(
      page.getByText("Practica explicando con tus palabras"),
    ).toHaveCount(0);

    // "Terminar" without answers: its results lead back to the hub too.
    await page.goto(`/active-recall/${notebookId}/${pageId}?desde=hub`);
    await page.getByRole("button", { name: /Terminar/ }).click();
    await page.getByRole("link", { name: "Volver a las sesiones" }).click();
    await expect(page).toHaveURL(/\/active-recall$/);

    // The browser back from the session lands on a hub that lists it.
    await page.goto(`/active-recall/${notebookId}/${pageId}?desde=hub`);
    await expect(
      page.getByText(`Pregunta 1 de ${PROMPTS.length}`),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/active-recall$/);
    await expect(notebookCard).toBeVisible();

    // The notebook view lists the page with a card that opens its session,
    // whose back link keeps leading to the notebook view.
    await notebookCard.click();
    await expect(page).toHaveURL(new RegExp(`/active-recall/${notebookId}$`));
    await expect(page.getByText("Sin sesiones todavía")).toHaveCount(0);
    const pageCard = page.getByRole("link", { name: /Practicar →/ });
    await expect(pageCard).toBeVisible();
    await pageCard.click();
    await expect(
      page.getByText(`Pregunta 1 de ${PROMPTS.length}`),
    ).toBeVisible();
    await page.getByRole("link", { name: /Todas las sesiones/ }).click();
    await expect(page).toHaveURL(new RegExp(`/active-recall/${notebookId}$`));
  });

  test("flashcards: a deck opened from the hub plays at once and its back link returns to the hub", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno mazo retorno ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await seedFlashcards(pageId as string, [
      { front: "¿Qué produce la mitocondria?", back: "ATP." },
      { front: "¿Dónde ocurre la glucólisis?", back: "En el citosol." },
    ]);

    await page.goto("/flashcards");
    await page.goto(`/flashcards/${notebookId}/${pageId}?repasar=1&desde=hub`);
    await expect(page.getByTestId("flashcard-player")).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\?desde=hub$/);

    await page.getByRole("link", { name: /Todos los mazos/ }).click();
    await expect(page).toHaveURL(/\/flashcards$/);
    await expect(
      page.getByRole("link", { name: new RegExp(notebookTitle) }),
    ).toBeVisible();
  });
});
