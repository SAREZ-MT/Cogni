import type { Locator, Page } from "@playwright/test";
import {
  expect,
  formAlert,
  hasSupabaseEnv,
  signIn,
  test,
} from "./fixtures/auth";
import { createNotebook } from "./helpers/notebooks";

// document-import T11/T13 (DOCX): a Word document imported from the
// notebook menu through the real pipeline (upload, mammoth + officeparser,
// image upload to page-assets, persist) must render every mapped block in
// the real editor — not just exist in the stored JSON — and keep it after
// a reload. The fixture and its expected blocks are documented in
// tests/fixtures/documents/README.md and expected/all-constructs.docx.md.
//
// Every test signs in its own freshUser (test-scoped, deleted afterwards),
// like pdf-import.spec.ts, so nothing leaks into other specs' notebooks.

const FIXTURES = "tests/fixtures/documents/files";

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
  for (const level of [2, 3, 4, 5, 6]) {
    await expect(
      editable.locator(`h${level}`, { hasText: `Heading level ${level}` }),
    ).toBeVisible();
  }
  await expect(
    editable.locator("h1", { hasText: "Fixture Title" }),
  ).toBeVisible();
  // Levels 4–6 get their own heading style, not body text (T11b).
  for (const level of [4, 5, 6]) {
    await expect(editable.locator(`h${level}`).first()).toHaveCSS(
      "font-weight",
      "600",
    );
  }

  // Nested lists, three levels deep; the ordered one starts at 3.
  await expect(
    editable.locator("ul ul ul > li", { hasText: "Bullet A.1.a" }),
  ).toBeVisible();
  const ordered = editable.locator('ol[start="3"]');
  await expect(ordered).toHaveCount(1);
  await expect(
    ordered.locator("ol ol > li", { hasText: "Number sub i" }),
  ).toBeVisible();

  // Table: a header row, a colspan and a rowspan.
  const table = editable.locator("table");
  await expect(table.locator("th")).toHaveText(["H1", "H2", "H3"]);
  await expect(table.locator('td[colspan="2"]')).toHaveText("Colspan 2");
  await expect(table.locator('td[rowspan="2"]')).toHaveText("Rowspan 2");

  // Code block with its lines and indentation.
  await expect
    .poll(() => editable.locator("pre code").textContent())
    .toBe("function add(a, b) {\n  return a + b;\n}");
  // Word carries no code language, so the block is plain text: the picker
  // says "Texto sin formato" and nothing is syntax-coloured (T11b).
  await expect(editable.getByTestId("code-block-language")).toHaveValue("");
  await expect(editable.locator('pre code [class*="hljs-"]')).toHaveCount(0);

  await expect(editable.locator("blockquote")).toHaveText(
    "A quoted sentence from someone wise.",
  );
  await expect(editable.locator("hr")).toHaveCount(1);

  // KaTeX-rendered math: one inline equation and three block ones.
  const inlineMath = editable.locator('[data-type="inline-math"]');
  await expect(inlineMath).toHaveCount(1);
  await expect(inlineMath).toHaveAttribute(
    "data-latex",
    "\\frac{a}{b} + x^{2} + \\sqrt{y}",
  );
  await expect(inlineMath.locator(".katex")).toHaveCount(1);
  const blockMath = editable.locator('[data-type="block-math"]');
  await expect(blockMath).toHaveCount(3);
  await expect(blockMath.locator(".katex")).toHaveCount(3);
  // Block math is typeset in KaTeX display mode; inline math is not (T11b).
  await expect(blockMath.locator(".katex-display")).toHaveCount(3);
  await expect(inlineMath.locator(".katex-display")).toHaveCount(0);

  // Images: stored in page-assets and rendered through Cogni's image node.
  const images = editable.getByTestId("image-node-img");
  await expect(images).toHaveCount(2, { timeout: 30_000 });
  await expect(images.first()).toHaveAttribute("alt", "A blue PNG");
  await expect(images.nth(1)).toHaveAttribute(
    "alt",
    "An SVG with PNG fallback",
  );
  for (const image of await images.all()) {
    await expect(image).toHaveAttribute("src", /^https:\/\//);
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
}

test.describe("docx import acceptance", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test("imports a Word document with every mapped block and keeps it after a reload", async ({
    page,
    freshUser,
  }) => {
    // The real pipeline (download, extract, image uploads, persist) inside
    // its 120 s route budget against cogni-dev.
    test.setTimeout(180_000);
    await signIn(page, freshUser);

    const title = "Cuaderno Word e2e";
    await createNotebook(page, title);
    await openDocumentImport(page, title);
    await page
      .getByTestId("document-import-input")
      .setInputFiles(`${FIXTURES}/all-constructs.docx`);

    await expect(page).toHaveURL(/\/notebooks\/[^/]+\/pages\/[^/]+$/, {
      timeout: 30_000,
    });
    await waitForImportState(page, "done");

    const editable = editableOf(page);
    await expectStructure(editable);

    // Inline marks: colour, highlight and shading survive as rendered
    // styles, next to the basic ones.
    const marks = editable.locator("p", { hasText: "Plain, bold" });
    await expect(marks.locator("strong")).toHaveText("bold");
    await expect(marks.locator("em")).toHaveText("italic");
    await expect(marks.locator("u")).toHaveText("underline");
    await expect(marks.locator("s")).toHaveText("strike");
    await expect(marks.locator("sub")).toHaveText("2");
    await expect(marks.locator("sup")).toHaveText("2");
    await expect(marks.locator("code")).toHaveText("inlineMono");
    await expect(marks.locator("mark")).toHaveText("highlight");
    await expect(marks.getByText("red", { exact: true })).toHaveCSS(
      "color",
      "rgb(255, 0, 0)",
    );
    await expect(marks.getByText("shading", { exact: true })).toHaveCSS(
      "background-color",
      "rgb(198, 239, 206)",
    );

    // Links: the https one is kept; the javascript: one is plain text.
    await expect(
      editable.locator('a[href="https://example.com/docs"]'),
    ).toHaveText("safe link");
    await expect(
      editable.getByText("evil link", { exact: false }),
    ).toBeVisible();
    await expect(page.locator('a[href^="javascript:" i]')).toHaveCount(0);

    // Task items, checked and unchecked.
    const tasks = editable.locator('ul[data-type="taskList"] > li');
    await expect(tasks).toHaveCount(4);
    await expect(
      editable.locator(
        'ul[data-type="taskList"] > li[data-checked="true"] > div',
      ),
    ).toHaveText(["Done task (sdt)", "Done task (glyph)"]);
    await expect(
      page.getByRole("checkbox", {
        name: "Task item checkbox for Done task (sdt)",
      }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", {
        name: "Task item checkbox for Open task (sdt)",
      }),
    ).not.toBeChecked();

    // A fresh full load proves the content was persisted, not just shown.
    await page.goto(new URL(page.url()).pathname);
    await expectStructure(editableOf(page));
  });

  test("a corrupt Word document fails cleanly and leaves a usable empty page", async ({
    page,
    freshUser,
  }) => {
    test.setTimeout(120_000);
    await signIn(page, freshUser);

    const title = "Cuaderno Word dañado e2e";
    await createNotebook(page, title);
    await openDocumentImport(page, title);
    await page
      .getByTestId("document-import-input")
      .setInputFiles(`${FIXTURES}/corrupt.docx`);

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

  // The real behaviour for a legacy binary .doc: the picker refuses it in
  // the browser (its type, application/msword, is not one the picker
  // offers), before any upload or page exists.
  test("a legacy .doc is refused in the browser without creating a page", async ({
    page,
    freshUser,
  }) => {
    await signIn(page, freshUser);

    const title = "Cuaderno Word antiguo e2e";
    await createNotebook(page, title);
    await openDocumentImport(page, title);
    await page
      .getByTestId("document-import-input")
      .setInputFiles(`${FIXTURES}/legacy.doc`);

    const banner = page.getByTestId("import-progress");
    await expect(banner).toHaveAttribute("data-status", "failed");
    await expect(banner).toContainText(
      "Solo puedes importar archivos PDF, Word (.docx) o PowerPoint (.pptx).",
    );
    await expect(page).toHaveURL(/\/notebooks$/);
  });
});
