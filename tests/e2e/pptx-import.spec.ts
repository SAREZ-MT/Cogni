import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import {
  expect,
  formAlert,
  hasSupabaseEnv,
  signIn,
  test,
} from "./fixtures/auth";
import { createNotebook } from "./helpers/notebooks";

// document-import T7 (PPTX): a PowerPoint deck imported from the notebook
// menu through the real pipeline (upload, officeparser + slide XML, image
// upload to page-assets, persist) must render every mapped block in the
// real editor and keep it after a reload. The fixture and its expected
// blocks are documented in tests/fixtures/documents/README.md and
// expected/all-constructs.pptx.md.
//
// Every test signs in its own freshUser (test-scoped, deleted afterwards),
// like docx-import.spec.ts, so nothing leaks into other specs' notebooks.

const FIXTURES = "tests/fixtures/documents/files";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

// processImportJob's failure message for a file the extractor cannot read
// (domain/import-failure.ts, `invalid_document`), quoted verbatim.
const INVALID_DOCUMENT_MESSAGE =
  "Este archivo no es un documento válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo.";

async function openDocumentImport(page: Page, title: string) {
  await page.getByRole("button", { name: `Acciones de ${title}` }).click();
  await page.getByRole("menuitem", { name: "Importar documento" }).click();
}

async function waitForImportState(page: Page, state: "done" | "failed") {
  await expect(page.getByTestId("page-import-view")).toHaveAttribute(
    "data-state",
    state,
    { timeout: 120_000 },
  );
}

function editableOf(page: Page): Locator {
  return page.getByTestId("editor-mount").locator('[contenteditable="true"]');
}

// The checks that must hold both right after the import and after a fresh
// load of the page.
async function expectStructure(editable: Locator) {
  // One level-2 heading per slide, in deck order.
  await expect(editable.locator("h2")).toHaveText([
    "Slide 1 title",
    "Slide 2 title",
    "Slide 3 title",
    "Slide 4 title",
    "Slide 5 title",
  ]);
  await expect(editable.locator("h1")).toHaveCount(0);

  // Bullets three levels deep (rebuilt from flat levels) and the numbered
  // pair as an ordered list.
  await expect(
    editable.locator("ul ul ul > li", { hasText: "Level 3 bullet" }),
  ).toBeVisible();
  await expect(editable.locator("ol > li")).toHaveText([
    "Numbered one",
    "Numbered two",
  ]);

  // Table: the first row is the header; spans come from the slide XML and
  // the covered cells are not rendered.
  const table = editable.locator("table");
  await expect(table.locator("th")).toHaveText(["H1", "H2", "H3"]);
  await expect(table.locator('td[colspan="2"]')).toHaveText("Colspan 2");
  await expect(table.locator('td[rowspan="2"]')).toHaveText("Rowspan 2");
  await expect(table.locator("td")).toHaveCount(7);

  // The slide-3 picture, stored in page-assets, with its description.
  const images = editable.getByTestId("image-node-img");
  await expect(images).toHaveCount(1, { timeout: 30_000 });
  await expect(images).toHaveAttribute("alt", "Blue stripe");
  await expect(images).toHaveAttribute("src", /^https:\/\//);
  await expect
    .poll(() =>
      images.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);

  // Inline marks and links of slide 4.
  const marks = editable.locator("p", { hasText: "Bold part" });
  await expect(marks.locator("strong")).toHaveText("Bold part");
  await expect(marks.locator("em")).toHaveText(", italic");
  await expect(marks.locator("u")).toHaveText(", underline");
  await expect(marks.getByText(", red", { exact: true })).toHaveCSS(
    "color",
    "rgb(255, 0, 0)",
  );
  await expect(
    editable.locator('a[href="https://example.com/slides"]'),
  ).toHaveText(", link");
  await expect(editable.getByText(", evil", { exact: false })).toBeVisible();
  await expect(editable.locator('a[href^="javascript:" i]')).toHaveCount(0);

  // Speaker notes: one closed "Notas del orador" block per slide; the
  // slide number of the notes page is not imported.
  const notes = editable.locator('[data-type="details"]');
  await expect(notes).toHaveCount(5);
  await expect(notes.locator("summary")).toHaveText(
    Array.from({ length: 5 }, () => "Notas del orador"),
  );
  await expect(notes.first()).not.toHaveClass(/is-open/);
  await expect(
    notes.first().locator('[data-type="detailsContent"]'),
  ).toBeHidden();
}

test.describe("pptx import acceptance", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test("imports a PowerPoint deck with every mapped block and keeps it after a reload", async ({
    page,
    freshUser,
  }) => {
    // The real pipeline (download, extract, image upload, persist) inside
    // its 120 s route budget against cogni-dev.
    test.setTimeout(180_000);
    await signIn(page, freshUser);

    const title = "Cuaderno PowerPoint e2e";
    await createNotebook(page, title);
    await openDocumentImport(page, title);
    await page
      .getByTestId("document-import-input")
      .setInputFiles(`${FIXTURES}/all-constructs.pptx`);

    await expect(page).toHaveURL(/\/notebooks\/[^/]+\/pages\/[^/]+$/, {
      timeout: 30_000,
    });
    await waitForImportState(page, "done");

    const editable = editableOf(page);
    await expectStructure(editable);

    // Opening the first notes block shows its text.
    const firstNotes = editable.locator('[data-type="details"]').first();
    await firstNotes.locator(":scope > button").click();
    await expect(firstNotes).toHaveClass(/is-open/);
    const content = firstNotes.locator('[data-type="detailsContent"]');
    await expect(content).toBeVisible();
    await expect(content).toHaveText("Speaker notes for slide 1.");
    await expect(editable.getByText(/^1$/)).toHaveCount(0);

    // A fresh full load proves the content was persisted, not just shown.
    await page.goto(new URL(page.url()).pathname);
    await expectStructure(editableOf(page));
  });

  test("a corrupt PowerPoint deck fails cleanly and leaves a usable empty page", async ({
    page,
    freshUser,
  }) => {
    test.setTimeout(120_000);
    await signIn(page, freshUser);

    const title = "Cuaderno PowerPoint dañado e2e";
    await createNotebook(page, title);
    await openDocumentImport(page, title);
    // The fixture cut at 60 %: still recognised as a PowerPoint package by
    // its local headers, but unreadable.
    const deck = readFileSync(`${FIXTURES}/all-constructs.pptx`);
    await page.getByTestId("document-import-input").setInputFiles({
      name: "dañado.pptx",
      mimeType: PPTX_MIME,
      buffer: deck.subarray(0, Math.floor(deck.length * 0.6)),
    });

    await expect(page).toHaveURL(/\/notebooks\/[^/]+\/pages\/[^/]+$/, {
      timeout: 30_000,
    });
    await waitForImportState(page, "failed");
    await expect(formAlert(page)).toHaveText(INVALID_DOCUMENT_MESSAGE);

    const editable = editableOf(page);
    await expect(editable).toBeVisible();
    await expect(editable).toHaveText("");
    await editable.click();
    // Keys typed right after a click can land before Chrome's
    // selectionchange (≥50 ms rule, Playwright click-then-type race).
    await page.waitForTimeout(50);
    await page.keyboard.type("una pagina vacia pero usable");
    await expect(editable).toContainText("una pagina vacia pero usable");
  });
});
