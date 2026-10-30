import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import postgres from "postgres";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedExamQuestions } from "./helpers/exam-questions";
import { seedFlashcards } from "./helpers/flashcards";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";
import { seedRecallQuestions } from "./helpers/recall-questions";

// Phase 8 H19 (user 2026-10-29): "Eliminar" on a notebook, a page or a
// technique hub card is a real delete, confirmed in an app dialog with the
// server's cascade counts. No AI: the items are seeded straight into the
// database, and the database is checked after each delete.

async function rowsOf(pageId: string) {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    const [row] = await sql<
      {
        pages: number;
        flashcards: number;
        recall: number;
        exam: number;
        items: number;
      }[]
    >`
      select
        (select count(*)::int from pages where id = ${pageId}) as pages,
        (select count(*)::int from flashcards where page_id = ${pageId})
          as flashcards,
        (select count(*)::int from recall_questions where page_id = ${pageId})
          as recall,
        (select count(*)::int from exam_questions where page_id = ${pageId})
          as exam,
        (select count(*)::int from study_items where page_id = ${pageId})
          as items
    `;
    return row;
  } finally {
    await sql.end();
  }
}

async function seedEverything(pageId: string) {
  await seedFlashcards(pageId, [
    { front: "Pregunta A", back: "Respuesta A" },
    { front: "Pregunta B", back: "Respuesta B" },
  ]);
  await seedRecallQuestions(pageId, ["Pregunta uno", "Pregunta dos", "Tres"]);
  await seedExamQuestions(pageId, [
    {
      stem: "¿Cuál es la opción correcta?",
      options: ["Opción A", "Opción B", "Opción C", "Opción D"],
      correctIndex: 0,
      concept: "Concepto",
    },
  ]);
}

async function deleteFromHubCard(
  page: Page,
  hub: string,
  notebookTitle: string,
  item: string,
  summary: string,
) {
  await page.goto(hub);
  const card = page.getByRole("article").filter({ hasText: notebookTitle });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: /^Acciones de/ }).click();
  await page.getByRole("menuitem", { name: item }).click();
  const confirm = page.getByRole("dialog", { name: /^¿Eliminar/ });
  await expect(confirm.getByText(summary)).toBeVisible();
  await expect(
    confirm.getByText("Esta acción no se puede deshacer."),
  ).toBeVisible();
  await clickAndWaitForAction(
    page,
    confirm.getByRole("button", { name: item }),
    '"pageId"',
  );
  await expect(confirm).toHaveCount(0);
  await expect(card).toHaveCount(0);
  await expect(page).toHaveURL(hub);
}

test.describe("hard deletes", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");
  test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL (cogni-dev)");

  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("each hub card deletes its page's whole set and only that one", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno borrar ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const pageId = new URL(page.url()).pathname.split("/")[4] as string;
    await seedEverything(pageId);

    await deleteFromHubCard(
      page,
      "/flashcards",
      notebookTitle,
      "Eliminar mazo",
      "Se eliminarán 2 tarjetas.",
    );
    expect(await rowsOf(pageId)).toMatchObject({
      pages: 1,
      flashcards: 0,
      recall: 3,
      exam: 1,
      items: 4,
    });

    await deleteFromHubCard(
      page,
      "/active-recall",
      notebookTitle,
      "Eliminar repaso",
      "Se eliminarán 3 preguntas.",
    );
    await deleteFromHubCard(
      page,
      "/exams",
      notebookTitle,
      "Eliminar examen",
      "Se eliminará 1 pregunta.",
    );
    expect(await rowsOf(pageId)).toMatchObject({
      pages: 1,
      flashcards: 0,
      recall: 0,
      exam: 0,
      items: 0,
    });
  });

  test("a page card on the notebook route deletes the page with all its study material", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno página ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await seedEverything(pageId as string);
    await page.goto(`/notebooks/${notebookId}`);

    await page
      .getByRole("button", { name: "Eliminar página Sin título" })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "¿Eliminar la página «Sin título»?",
    });
    await expect(
      confirm.getByText(
        "Se eliminarán sus apuntes, 2 tarjetas, 3 preguntas de repaso activo y 1 pregunta de examen.",
      ),
    ).toBeVisible();
    await clickAndWaitForAction(
      page,
      confirm.getByRole("button", { name: "Eliminar página" }),
      '"pageId"',
    );

    await expect(page).toHaveURL(`/notebooks/${notebookId}`);
    await expect(page.getByRole("link", { name: /^Sin título/ })).toHaveCount(
      0,
    );
    expect(await rowsOf(pageId as string)).toMatchObject({
      pages: 0,
      items: 0,
    });
  });

  test("deleting a notebook from Cuadernos counts its pages and sets", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno entero ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await seedEverything(pageId as string);

    await page.goto("/notebooks");
    await page
      .getByRole("button", { name: `Acciones de ${notebookTitle}` })
      .click();
    await page.getByRole("menuitem", { name: "Eliminar" }).click();
    const confirm = page.getByRole("dialog", {
      name: `¿Eliminar el cuaderno «${notebookTitle}»?`,
    });
    await expect(
      confirm.getByText(
        "Se eliminarán 1 página, 1 mazo, 1 repaso activo y 1 examen.",
      ),
    ).toBeVisible();
    await clickAndWaitForAction(
      page,
      confirm.getByRole("button", { name: "Eliminar cuaderno" }),
      '"notebookId"',
    );

    await expect(page).toHaveURL("/notebooks");
    await expect(
      page.getByRole("article").filter({ hasText: notebookTitle }),
    ).toHaveCount(0);
    expect(await rowsOf(pageId as string)).toMatchObject({ pages: 0 });
    const gone = await page.goto(`/notebooks/${notebookId}`);
    expect(gone?.status()).toBe(404);
  });
});
