import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import {
  clickAndWaitForAction,
  createNotebook,
  createPageAndOpen,
  openNotebook,
} from "./helpers/notebooks";
import { chooseOption } from "./helpers/select";

// Phase 8 H11 (user-approved flow, 2026-10-29): every technique hub creates
// its content from a "pick a page" dialog, opened by the empty state's CTA
// or, once the hub lists something, by the grid's first, fixed tile. No AI
// is called here (the reused dev server may run live AI): the AI paths are
// only opened. Phase 8 H12: the dialogs are AI only, so the first card is
// written on the page's deck ("Nueva tarjeta").

const HUBS = [
  {
    path: "/flashcards",
    cta: "Crear mis primeras flashcards",
    dialog: "Crear flashcards",
  },
  {
    path: "/active-recall",
    cta: "Generar mis primeras preguntas",
    dialog: "Generar preguntas",
  },
  { path: "/exams", cta: "Crear mi primer examen", dialog: "Crear examen" },
] as const;

async function openFromCta(page: Page, hub: (typeof HUBS)[number]) {
  await page.goto(hub.path);
  await page
    .getByTestId("content-area")
    .locator('[data-slot="illustrated-empty-state"]')
    .getByRole("button", { name: hub.cta })
    .click();
  const dialog = page.getByRole("dialog", { name: hub.dialog });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("technique hubs: create from the section", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("each empty hub's CTA opens its dialog, which is never a dead end", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // No notebooks yet: every dialog offers to create one.
    for (const hub of HUBS) {
      const dialog = await openFromCta(page, hub);
      await expect(
        dialog.getByRole("link", { name: "Crear un cuaderno" }),
      ).toHaveAttribute("href", "/notebooks");
      await expect(
        dialog.getByRole("button", { name: /^Generar$/ }),
      ).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }

    // A notebook without pages: the dialog links to that notebook.
    const title = `Cuaderno H11 ${randomUUID().slice(0, 8)}`;
    await createNotebook(page, title);
    const notebookId = await openNotebook(page, title);
    for (const hub of HUBS) {
      const dialog = await openFromCta(page, hub);
      await expect(
        dialog.getByRole("link", { name: "Crear una página" }),
      ).toHaveAttribute("href", `/notebooks/${notebookId}`);
      await page.keyboard.press("Escape");
    }

    // With a page: AI only in every technique (opened, never generated).
    await openNotebook(page, title);
    await createPageAndOpen(page);

    const flashcards = await openFromCta(page, HUBS[0]);
    await chooseOption(flashcards, "Página", "Sin título");
    await expect(flashcards.getByRole("radio")).toHaveCount(0);
    await expect(flashcards.getByText(/Crear a mano/)).toHaveCount(0);
    await expect(
      flashcards.getByTestId("create-flashcards-remaining"),
    ).toHaveText(/generaci|límite/);
    await expect(
      flashcards.getByTestId("create-flashcards-submit"),
    ).toBeEnabled();
    await page.keyboard.press("Escape");

    const recall = await openFromCta(page, HUBS[1]);
    await chooseOption(recall, "Página", "Sin título");
    await expect(recall.getByRole("radio")).toHaveCount(0);
    await expect(recall.getByTestId("create-recall-submit")).toHaveText(
      "Generar",
    );
    await page.keyboard.press("Escape");

    const exams = await openFromCta(page, HUBS[2]);
    await chooseOption(exams, "Página", "Sin título");
    await expect(exams.getByRole("radio")).toHaveCount(0);
    await expect(exams.getByText(/Crear mis preguntas/)).toHaveCount(0);
    await expect(
      exams.getByRole("group", { name: "Preguntas a generar" }),
    ).toBeVisible();
    await expect(exams.getByTestId("create-exam-submit")).toHaveText("Generar");
    await page.keyboard.press("Escape");
  });

  test("a first card written on the page's deck makes the hub offer the create tile first", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const title = `Cuaderno mazo ${randomUUID().slice(0, 8)}`;
    await createNotebook(page, title);
    const notebookId = await openNotebook(page, title);
    await createPageAndOpen(page);
    const pageId = new URL(page.url()).pathname.split("/")[4] ?? "";

    // The deck route renders for a page with no cards; its "Nueva tarjeta"
    // starts the deck.
    await page.goto(`/flashcards/${notebookId}/${pageId}`);
    await page.getByTestId("new-flashcard-button").first().click();
    const card = page.getByRole("dialog", { name: "Nueva tarjeta" });
    await expect(card).toBeVisible();
    await card.getByLabel("Anverso").fill("¿Qué idea resume el tema?");
    await card.getByLabel("Reverso").fill("La que conecta sus partes.");
    await clickAndWaitForAction(
      page,
      card.getByRole("button", { name: "Guardar tarjeta" }),
    );
    await expect(card).toBeHidden();
    await expect(page.getByText("¿Qué idea resume el tema?")).toBeVisible();

    await page.goto("/flashcards");
    const tile = page.getByTestId("create-flashcards-tile");
    await expect(tile).toBeVisible();
    // First and fixed: before the notebook's deck card.
    const firstInGrid = page
      .getByRole("heading", { name: "Mazos por cuaderno" })
      .locator("xpath=following-sibling::div[1]/*[1]");
    await expect(firstInGrid).toHaveAttribute(
      "data-testid",
      "create-flashcards-tile",
    );
    await expect(
      page.getByRole("link", { name: new RegExp(title) }),
    ).toBeVisible();
    await tile.click();
    await expect(
      page.getByRole("dialog", { name: "Crear flashcards" }),
    ).toBeVisible();
  });
});
