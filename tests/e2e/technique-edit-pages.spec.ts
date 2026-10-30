import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedExamQuestions } from "./helpers/exam-questions";
import { seedFlashcards } from "./helpers/flashcards";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";
import { seedRecallQuestions } from "./helpers/recall-questions";

// Phase 8 H18 (user 2026-10-29): each technique's edit page keeps edits,
// additions and real deletions as a local draft until "Guardar", which
// saves them together; leaving with unsaved changes asks in an app dialog.
// No AI: the items are seeded straight into the database.

function entries(page: Page): Locator {
  return page.getByTestId("item-editor-entry");
}

async function save(page: Page, bodyIncludes: string) {
  await clickAndWaitForAction(
    page,
    page.getByRole("button", { name: "Guardar", exact: true }),
    bodyIncludes,
  );
  await expect(page.getByText("Cambios guardados")).toBeVisible();
}

test.describe("technique edit pages", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");
  test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL (cogni-dev)");

  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("flashcards: edits, adds and deletes cards from the hub menu and saves them together", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno edición ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await seedFlashcards(pageId as string, [
      { front: "Pregunta A", back: "Respuesta A" },
      { front: "Pregunta B", back: "Respuesta B" },
    ]);

    // The hub card's menu opens the edit page; "Ver tarjetas" is gone.
    await page.goto("/flashcards");
    const deckCard = page
      .getByRole("article")
      .filter({ hasText: notebookTitle });
    await deckCard.getByRole("button", { name: /^Acciones de/ }).click();
    await expect(
      page.getByRole("menuitem", { name: /Ver tarjetas/ }),
    ).toHaveCount(0);
    await page.getByRole("menuitem", { name: /Editar tarjetas/ }).click();
    await expect(page).toHaveURL(
      `/flashcards/${notebookId}/${pageId}/editar?desde=hub`,
    );
    await expect(entries(page)).toHaveCount(2);
    await expect(page.getByText("Sin cambios")).toBeVisible();

    await entries(page).nth(0).getByLabel("Frente").fill("Pregunta A editada");
    await page.getByRole("button", { name: "Eliminar tarjeta 2" }).click();
    await page.getByRole("button", { name: "Añadir tarjeta" }).click();
    await entries(page).nth(2).getByLabel("Frente").fill("Pregunta C");
    await entries(page).nth(2).getByLabel("Reverso").fill("Respuesta C");
    await expect(page.getByText("3 cambios sin guardar")).toBeVisible();
    await expect(page.getByText("Se eliminará al guardar")).toBeVisible();

    // Leaving through an in-app link asks first; "Seguir editando" stays.
    await page
      .getByRole("link", { name: "Flashcards", exact: true })
      .first()
      .click();
    const leave = page.getByRole("dialog", { name: "¿Salir sin guardar?" });
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Seguir editando" }).click();
    await expect(leave).toBeHidden();
    await expect(page).toHaveURL(/\/editar\?desde=hub$/);

    await save(page, "Pregunta C");
    await expect(page.getByText("Sin cambios")).toBeVisible();
    await page.reload();
    await expect(entries(page)).toHaveCount(2);
    await expect(entries(page).nth(0).getByLabel("Frente")).toHaveValue(
      "Pregunta A editada",
    );
    await expect(entries(page).nth(1).getByLabel("Frente")).toHaveValue(
      "Pregunta C",
    );

    // A deck is never empty: deleting every card is refused before saving.
    await page.getByRole("button", { name: "Eliminar tarjeta 1" }).click();
    await page.getByRole("button", { name: "Eliminar tarjeta 2" }).click();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.locator('[data-slot="form-message"]')).toContainText(
      "El mazo necesita al menos una tarjeta",
    );

    // "Salir sin guardar" leaves to the hub and nothing was deleted.
    await page
      .getByRole("link", { name: "Flashcards", exact: true })
      .first()
      .click();
    await page
      .getByRole("dialog", { name: "¿Salir sin guardar?" })
      .getByRole("button", { name: "Salir sin guardar" })
      .click();
    await expect(page).toHaveURL(/\/flashcards$/);
    await expect(deckCard).toContainText(/(^|\D)2\s*tarjetas/);
  });

  test("recall: edits a question and its key concepts, adds one and deletes one", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await createNotebookWithOpenPage(
      page,
      `Cuaderno recall edición ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await seedRecallQuestions(pageId as string, [
      "Pregunta uno",
      "Pregunta dos",
    ]);

    await page.goto(`/active-recall/${notebookId}/${pageId}/editar?desde=hub`);
    await expect(entries(page)).toHaveCount(2);
    const first = entries(page).nth(0);
    await first
      .getByLabel("Pregunta", { exact: true })
      .fill("Pregunta uno editada");
    await first.getByLabel("Conceptos clave").fill("Concepto A\nConcepto B");
    await page.getByRole("button", { name: "Eliminar pregunta 2" }).click();
    await page.getByRole("button", { name: "Añadir pregunta" }).click();
    const added = entries(page).nth(2);
    await added.getByLabel("Pregunta", { exact: true }).fill("Pregunta tres");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      added.getByText("Escribe al menos un concepto clave."),
    ).toBeVisible();
    await added.getByLabel("Conceptos clave").fill("Concepto C");
    await added.getByLabel("Respuesta esperada").fill("Lo esperado");

    await save(page, "Pregunta tres");
    await page.reload();
    await expect(entries(page)).toHaveCount(2);
    await expect(
      entries(page).nth(0).getByLabel("Conceptos clave"),
    ).toHaveValue("Concepto A\nConcepto B");
    await expect(
      entries(page).nth(1).getByLabel("Pregunta", { exact: true }),
    ).toHaveValue("Pregunta tres");
    await page
      .getByRole("link", { name: "Recordación activa", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/active-recall$/);
  });

  test("exams: the old questions route opens the edit page, which edits, adds and deletes questions", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await createNotebookWithOpenPage(
      page,
      `Cuaderno examen edición ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await seedExamQuestions(pageId as string, [
      {
        stem: "¿Cuál es la opción correcta?",
        options: ["Opción A", "Opción B", "Opción C", "Opción D"],
        correctIndex: 0,
        concept: "Concepto uno",
      },
      {
        stem: "¿Cuál sobra?",
        options: ["Uno", "Dos", "Tres", "Cuatro"],
        correctIndex: 1,
        concept: "Concepto dos",
      },
    ]);

    await page.goto(`/exams/${notebookId}/${pageId}/preguntas?desde=hub`);
    await expect(page).toHaveURL(
      `/exams/${notebookId}/${pageId}/editar?desde=hub`,
    );
    await expect(entries(page)).toHaveCount(2);
    const first = entries(page).nth(0);
    await first.getByLabel("Opción D es la correcta").check();
    await page.getByRole("button", { name: "Eliminar pregunta 2" }).click();
    await page.getByRole("button", { name: "Añadir pregunta" }).click();
    const added = entries(page).nth(2);
    await added.getByLabel("Enunciado").fill("¿Pregunta nueva?");
    for (const [letter, text] of [
      ["A", "Primera"],
      ["B", "Segunda"],
      ["C", "Primera"],
      ["D", "Cuarta"],
    ] as const) {
      await added.getByLabel(`Opción ${letter}`, { exact: true }).fill(text);
    }
    await added.getByLabel("Concepto que evalúa").fill("Concepto tres");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      added.getByText("Las 4 opciones deben ser distintas."),
    ).toBeVisible();
    await added.getByLabel("Opción C", { exact: true }).fill("Tercera");

    await save(page, "¿Pregunta nueva?");
    await page.reload();
    await expect(entries(page)).toHaveCount(2);
    await expect(
      entries(page).nth(0).getByLabel("Opción D es la correcta"),
    ).toBeChecked();
    await expect(entries(page).nth(1).getByLabel("Enunciado")).toHaveValue(
      "¿Pregunta nueva?",
    );
    await page
      .getByRole("link", { name: "Exámenes", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/exams$/);
  });
});
