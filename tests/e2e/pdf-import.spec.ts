import type { Locator, Page } from "@playwright/test";
import { makeNoTextPdf, makeTextPdf } from "../fixtures/pdf/make-minimal-pdf";
import {
  expect,
  formAlert,
  hasSupabaseEnv,
  signIn,
  test,
} from "./fixtures/auth";
import { createNotebook } from "./helpers/notebooks";

// specs/ingestion (design.md §11, proposal.md Success Criteria): the two
// end-to-end scenarios not already covered by Vitest unit/component tests —
// a full happy-path import against the real pipeline (download, extract,
// convert, persist, all inside one Server Action call — ADR 0003, no
// worker) and the "no text layer" failure, which must still leave a usable
// empty page. Both PDFs are built in-test with
// tests/fixtures/pdf/make-minimal-pdf.ts's byte-exact writer (T12 extends
// it with makeTextPdf) instead of checking in binary fixtures.
//
// Every test here creates its own notebook under its own freshUser (test-
// scoped, deleted afterwards) instead of sharing the worker-scoped
// verifiedUser other specs use: nothing here depends on, or should leak
// into, another spec's accumulated notebooks.

// import-progress.tsx's data-testid; page-import-view.tsx puts the phase
// (including the terminal ImportJob status) on `data-state`. A small local
// wait helper — not shared with notebooks-acceptance.spec.ts, which has no
// notion of import state.
async function waitForImportState(
  page: Page,
  state: "done" | "failed",
  timeoutMs: number,
) {
  await expect(page.getByTestId("page-import-view")).toHaveAttribute(
    "data-state",
    state,
    { timeout: timeoutMs },
  );
}

function chapterPages(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    // All-uppercase first line (text-to-blocks.ts's R5/R6 heading rule) so
    // each page opens with its own <h1>; two more lines that join into one
    // paragraph (R7). Plain ASCII only — this fixture writer never sets a
    // font /Encoding, so it relies on Helvetica's built-in
    // StandardEncoding (make-minimal-pdf.ts's own documented limit).
    return [
      `CAPITULO ${n}`,
      `Primera oracion de prueba en la pagina ${n} del documento importado.`,
      `Segunda oracion con mas contenido para verificar la extraccion del capitulo ${n}.`,
    ].join("\n");
  });
}

// Opens the PDF import from the notebook's card on /notebooks: the "Importar
// documento" item of its "Acciones de {título}" kebab (injected by ingestion through
// the notebook actions slot, src/app/(app)/_components/notebook-actions.tsx).
async function openPdfImport(page: Page, title: string) {
  await page.getByRole("button", { name: `Acciones de ${title}` }).click();
  await page.getByRole("menuitem", { name: "Importar documento" }).click();
}

test.describe("pdf import acceptance", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test("imports a 30-page text PDF end to end and the content survives a reload", async ({
    page,
    freshUser,
  }) => {
    // This flow drives the real download -> extract -> convert -> persist
    // pipeline (processImportJob) inside its 120s route budget
    // (domain/import-budget.ts's MAX_DURATION_S) against cogni-dev; the
    // default 60s Playwright test timeout is too tight for it.
    test.setTimeout(180_000);

    await signIn(page, freshUser);

    const title = "Cuaderno de importación e2e";
    await createNotebook(page, title);
    await openPdfImport(page, title);

    const pdfBytes = makeTextPdf(chapterPages(30));
    await page.getByTestId("document-import-input").setInputFiles({
      name: "text-30-pages.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdfBytes),
    });

    // requestPdfUpload -> upload to the signed URL -> startPdfImport, then
    // router.push to the new page's own route.
    await expect(page).toHaveURL(/\/notebooks\/[^/]+\/pages\/[^/]+$/, {
      timeout: 30_000,
    });

    const importView = page.getByTestId("page-import-view");
    await expect(importView).toBeVisible();
    // "The editor only swaps in once the job is terminal" is pinned by
    // page-import-view.test.tsx. Asserting it here raced the pipeline: a
    // fast CI runner finished the import before a short no-editor check
    // ran, failing a correct build.

    await waitForImportState(page, "done", 120_000);

    const editorMount = page.getByTestId("editor-mount");
    const editable = editorMount.locator('[contenteditable="true"]');
    await expect(
      editable.getByText("CAPITULO 1", { exact: true }),
    ).toBeVisible();
    await expect(
      editable.getByText("CAPITULO 30", { exact: true }),
    ).toBeVisible();

    // The imported page is listed on its notebook's route (the sidebar no
    // longer carries the page tree), titled after the file.
    const pagePath = new URL(page.url()).pathname;
    const notebookRoute = pagePath.split("/pages/")[0];
    await page.goto(notebookRoute);
    await expect(
      page.getByRole("link", { name: /^text-30-pages/ }),
    ).toBeVisible();

    // A fresh full load of the page proves the content survived; going
    // back and reloading immediately aborted the in-flight history
    // navigation (net::ERR_ABORTED) on CI.
    await page.goto(pagePath);
    const reloadedEditable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await expect(
      reloadedEditable.getByText("CAPITULO 1", { exact: true }),
    ).toBeVisible();
    await expect(
      reloadedEditable.getByText("CAPITULO 30", { exact: true }),
    ).toBeVisible();
  });

  test("a PDF with no text layer fails cleanly and leaves a usable empty page", async ({
    page,
    freshUser,
  }) => {
    await signIn(page, freshUser);

    const title = "Cuaderno sin texto e2e";
    await createNotebook(page, title);
    await openPdfImport(page, title);

    const pdfBytes = makeNoTextPdf();
    await page.getByTestId("document-import-input").setInputFiles({
      name: "no-text.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdfBytes),
    });

    await expect(page).toHaveURL(/\/notebooks\/[^/]+\/pages\/[^/]+$/, {
      timeout: 30_000,
    });

    await waitForImportState(page, "failed", 60_000);

    // failureMessage("no_text_layer") (domain/import-failure.ts), quoted
    // verbatim — this is the exact UI-safe message processImportJob stores
    // on the failed job and page-import-view.tsx renders as-is.
    await expect(formAlert(page)).toHaveText(
      "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto.",
    );

    // The editor still renders on a failed job (page-import-view.tsx's
    // `(phase === "no-job" || phase === "terminal") && editor`) — empty,
    // but usable.
    const editable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await expect(editable).toBeVisible();
    await expect(editable).toHaveText("");

    await editable.click();
    await page.keyboard.type("una pagina vacia pero usable");
    await expect(editable).toContainText("una pagina vacia pero usable");
  });

  // document-import T8: a tagged PDF (tests/fixtures/documents/files/
  // tagged.pdf, expected blocks in expected/tagged.pdf.md) goes through
  // officeparser's structure tree and must render every mapped block in
  // the real editor, before and after a reload.
  test("imports a tagged PDF with its structure and keeps it after a reload", async ({
    page,
    freshUser,
  }) => {
    test.setTimeout(180_000);
    await signIn(page, freshUser);

    const title = "Cuaderno PDF etiquetado e2e";
    await createNotebook(page, title);
    await openPdfImport(page, title);
    await page
      .getByTestId("document-import-input")
      .setInputFiles(`${DOCUMENT_FIXTURES}/tagged.pdf`);

    await expect(page).toHaveURL(/\/notebooks\/[^/]+\/pages\/[^/]+$/, {
      timeout: 30_000,
    });
    await waitForImportState(page, "done", 120_000);

    await expectTaggedStructure(editableOf(page));

    await page.goto(new URL(page.url()).pathname);
    await expectTaggedStructure(editableOf(page));
  });

  test("a corrupt PDF fails as an invalid document and leaves a usable empty page", async ({
    page,
    freshUser,
  }) => {
    test.setTimeout(120_000);
    await signIn(page, freshUser);

    const title = "Cuaderno PDF dañado e2e";
    await createNotebook(page, title);
    await openPdfImport(page, title);
    // The first 600 bytes of tagged.pdf + garbage: starts with %PDF- but
    // is unreadable (T1 review follow-up: invalid, not "no text").
    await page
      .getByTestId("document-import-input")
      .setInputFiles(`${DOCUMENT_FIXTURES}/corrupt.pdf`);

    await expect(page).toHaveURL(/\/notebooks\/[^/]+\/pages\/[^/]+$/, {
      timeout: 30_000,
    });
    await waitForImportState(page, "failed", 60_000);
    await expect(formAlert(page)).toHaveText(INVALID_DOCUMENT_MESSAGE);

    const editable = editableOf(page);
    await expect(editable).toBeVisible();
    await expect(editable).toHaveText("");
    await editable.click();
    // ≥50 ms between a click and typing (Playwright click-then-type race).
    await page.waitForTimeout(50);
    await page.keyboard.type("una pagina vacia pero usable");
    await expect(editable).toContainText("una pagina vacia pero usable");
  });
});

const DOCUMENT_FIXTURES = "tests/fixtures/documents/files";

// processImportJob's failure message for a file the extractor cannot read
// (domain/import-failure.ts, `invalid_document`), quoted verbatim.
const INVALID_DOCUMENT_MESSAGE =
  "Este archivo no es un documento válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo.";

function editableOf(page: Page): Locator {
  return page.getByTestId("editor-mount").locator('[contenteditable="true"]');
}

async function expectTaggedStructure(editable: Locator) {
  // Headings 1–3 from the structure tree.
  await expect(editable.locator("h1")).toHaveText(["Fixture Heading One"]);
  await expect(editable.locator("h2")).toHaveText(["Heading Two"]);
  await expect(editable.locator("h3")).toHaveText(["Heading Three"]);

  // Inline marks and links; the javascript: link keeps only its text.
  const marks = editable.locator("p", { hasText: "Plain, " });
  await expect(marks.locator("strong")).toHaveText("bold");
  await expect(marks.locator("em")).toHaveText("italic");
  await expect(marks.locator("code")).toHaveText("inlineMono");
  await expect(
    editable.locator('a[href="https://example.com/docs"]'),
  ).toHaveText("safe link");
  await expect(editable.locator('a[href^="javascript:" i]')).toHaveCount(0);
  await expect(marks).toContainText("evil link");

  // Bullets three levels deep and the ordered list starting at 3.
  await expect(
    editable.locator("ul ul ul > li", { hasText: "Bullet A.1.a" }),
  ).toBeVisible();
  const ordered = editable.locator('ol[start="3"]');
  await expect(ordered).toHaveCount(1);
  await expect(ordered.locator(":scope > li").first()).toContainText(
    "Number three",
  );
  await expect(ordered.locator("ol > li")).toHaveText(["Number sub a"]);

  // Table: header row as th; spans are lost, so short rows are padded.
  const table = editable.locator("table");
  await expect(table.locator("th")).toHaveText(["H1", "H2", "H3"]);
  await expect(table.locator("td")).toHaveCount(9);
  await expect(table.locator("td", { hasText: "Colspan 2" })).toHaveCount(1);

  // The Courier lines as one code block.
  await expect(editable.locator("pre code")).toHaveText(
    "function add(a, b) {\nreturn a + b;\n}",
  );

  // The PNG, stored in page-assets.
  const images = editable.getByTestId("image-node-img");
  await expect(images).toHaveCount(1, { timeout: 30_000 });
  await expect(images).toHaveAttribute("src", /^https:\/\//);
  await expect
    .poll(() =>
      images.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);

  // The two columns read left then right, then the closing paragraph.
  const paragraphs = editable.locator("p");
  const texts = await paragraphs.allTextContents();
  const index = (prefix: string) =>
    texts.findIndex((text) => text.startsWith(prefix));
  expect(index("LEFTCOL first")).toBeGreaterThan(-1);
  expect(index("LEFTCOL first")).toBeLessThan(index("RIGHTCOL first"));
  expect(index("RIGHTCOL second")).toBeLessThan(
    index("After horizontal rule."),
  );
}
