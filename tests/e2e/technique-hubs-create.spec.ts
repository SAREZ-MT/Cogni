import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import {
  clickAndWaitForAction,
  createNotebook,
  createPageAndOpen,
  openNotebook,
} from "./helpers/notebooks";

// Phase 8 H11 (user-approved flow, 2026-10-29): every technique hub creates
// its content from a "pick a page" dialog, opened by the empty state's CTA
// or, once the hub lists something, by the grid's first, fixed tile. No AI
// is called here (the reused dev server may run live AI): the AI paths are
// only opened, and flashcards' "Crear a mano" creates the first card.

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

    // With a page: the paths per technique (opened, never generated).
    await openNotebook(page, title);
    await createPageAndOpen(page);

    const flashcards = await openFromCta(page, HUBS[0]);
    await flashcards
      .getByRole("combobox", { name: "Página" })
      .selectOption({ label: "Sin título" });
    await expect(
      flashcards.getByRole("radio", { name: /Generar con IA/ }),
    ).toBeChecked();
    await expect(
      flashcards.getByRole("radio", { name: /Crear a mano/ }),
    ).toBeVisible();
    await expect(
      flashcards.getByTestId("create-flashcards-remaining"),
    ).toHaveText(/generaci|límite/);
    await expect(
      flashcards.getByTestId("create-flashcards-submit"),
    ).toBeEnabled();
    await page.keyboard.press("Escape");

    const recall = await openFromCta(page, HUBS[1]);
    await recall
      .getByRole("combobox", { name: "Página" })
      .selectOption({ label: "Sin título" });
    // AI only: there is no manual recall path.
    await expect(recall.getByRole("radiogroup")).toHaveCount(0);
    await expect(recall.getByTestId("create-recall-submit")).toHaveText(
      "Generar",
    );
    await page.keyboard.press("Escape");

    const exams = await openFromCta(page, HUBS[2]);
    await exams
      .getByRole("combobox", { name: "Página" })
      .selectOption({ label: "Sin título" });
    await expect(
      exams.getByRole("radio", { name: /Crear mis preguntas/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Crear a mano starts a page's deck with its first card, then the hub offers the create tile first", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const title = `Cuaderno mazo ${randomUUID().slice(0, 8)}`;
    await createNotebook(page, title);
    const notebookId = await openNotebook(page, title);
    await createPageAndOpen(page);
    const pageId = new URL(page.url()).pathname.split("/")[4] ?? "";

    const dialog = await openFromCta(page, HUBS[0]);
    await dialog
      .getByRole("combobox", { name: "Cuaderno" })
      .selectOption({ label: title });
    await dialog
      .getByRole("combobox", { name: "Página" })
      .selectOption({ label: "Sin título" });
    await dialog.getByRole("radio", { name: /Crear a mano/ }).click();
    await dialog.getByTestId("create-flashcards-submit").click();

    // The deck route opens "Nueva tarjeta" at once and drops ?nueva=1.
    await expect(page).toHaveURL(`/flashcards/${notebookId}/${pageId}`);
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
