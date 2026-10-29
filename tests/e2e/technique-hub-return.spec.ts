import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedExamQuestions } from "./helpers/exam-questions";
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

    // The in-app back link returns to the hub, which lists the page
    // (Phase 8 H17: one card per page, labelled with its notebook).
    await page.getByRole("link", { name: /Todas las sesiones/ }).click();
    await expect(page).toHaveURL(/\/active-recall$/);
    const pageCard = page
      .getByRole("article")
      .filter({ hasText: notebookTitle });
    await expect(pageCard).toBeVisible();
    await expect(pageCard).toContainText("Sin sesiones terminadas");
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
    await expect(pageCard).toBeVisible();

    // The old notebook view redirects to the hub filtered by it; the card's
    // Practicar opens the session and its back link keeps the filter.
    await page.goto(`/active-recall/${notebookId}`);
    await expect(page).toHaveURL(`/active-recall?cuaderno=${notebookId}`);
    await expect(
      page
        .getByRole("navigation", { name: "Filtrar por cuaderno" })
        .locator('[aria-current="page"]'),
    ).toContainText(notebookTitle);
    await pageCard.getByRole("link", { name: /^Practicar/ }).click();
    await expect(
      page.getByText(`Pregunta 1 de ${PROMPTS.length}`),
    ).toBeVisible();
    await page.getByRole("link", { name: /Todas las sesiones/ }).click();
    await expect(page).toHaveURL(`/active-recall?cuaderno=${notebookId}`);
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
    const deckCard = page
      .getByRole("article")
      .filter({ hasText: notebookTitle });
    await expect(deckCard).toBeVisible();

    // Phase 8 H17: from a filtered hub, the card's Repasar plays at once
    // and the return keeps the filter.
    await page.goto(`/flashcards?cuaderno=${notebookId}`);
    await deckCard.getByRole("link", { name: /^Repasar/ }).click();
    await expect(page.getByTestId("flashcard-player")).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("link", { name: /Todos los mazos/ }).click();
    await expect(page).toHaveURL(`/flashcards?cuaderno=${notebookId}`);
  });

  // Phase 8 H18: a deck with nothing due says so and offers a practice
  // pass that never touches the schedule; finishing it leads back.
  test("flashcards: an up-to-date deck offers Repasar igual, which changes no review", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno al día ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , , , pageId] = new URL(page.url()).pathname.split("/");
    await seedFlashcards(pageId as string, [
      { front: "Pregunta A", back: "Respuesta A" },
    ]);
    const sql = postgres(process.env.DATABASE_URL as string, {
      prepare: false,
      max: 1,
    });
    const scheduled = async () =>
      sql<{ due: string; reviews: number }[]>`
        select si.due_at::text as due,
               (select count(*)::int from review_logs rl
                 where rl.item_id = si.id) as reviews
        from study_items si where si.page_id = ${pageId as string}`;
    try {
      await sql`update study_items set due_at = now() + interval '3 days'
                where page_id = ${pageId as string}`;
      const before = await scheduled();

      await page.goto("/flashcards");
      const deckCard = page
        .getByRole("article")
        .filter({ hasText: notebookTitle });
      await deckCard.getByRole("link", { name: /^Repasar/ }).click();
      await expect(page.getByText("Estás al día con este mazo")).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByText(/Tu próximo repaso es en 3 días/),
      ).toBeVisible();

      await page.getByRole("button", { name: "Repasar igual" }).click();
      await expect(page.getByText("Modo práctica")).toBeVisible();
      await expect(page).toHaveURL(/modo=practica/);
      await page.getByRole("button", { name: /Mostrar respuesta/ }).click();
      await page.getByRole("button", { name: /Fácil/ }).click();
      await expect(page.getByText("¡Sesión completada!")).toBeVisible();
      expect(await scheduled()).toEqual(before);

      await page
        .getByRole("link", { name: /Todos los mazos/ })
        .last()
        .click();
      await expect(page).toHaveURL(/\/flashcards$/);
    } finally {
      await sql.end();
    }
  });

  // Phase 8 H18 (the H17 open issue): an exam opened from its hub card
  // returns to the hub.
  test("exams: the exam opened from the hub card leads back to the hub", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno examen retorno ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await seedExamQuestions(pageId as string, [
      {
        stem: "¿Cuál es la opción correcta?",
        options: ["Opción A", "Opción B", "Opción C", "Opción D"],
        correctIndex: 0,
        concept: "Concepto",
      },
    ]);

    await page.goto(`/exams?cuaderno=${notebookId}`);
    await page
      .getByRole("article")
      .filter({ hasText: notebookTitle })
      .getByRole("link", { name: /^Hacer examen/ })
      .click();
    await expect(page).toHaveURL(/desde=hub/);
    await expect(page.getByTestId("exam-start")).toBeVisible();
    await page
      .getByRole("link", { name: "Exámenes", exact: true })
      .last()
      .click();
    await expect(page).toHaveURL(`/exams?cuaderno=${notebookId}`);
  });
});
