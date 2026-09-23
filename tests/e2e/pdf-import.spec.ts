import type { Page } from "@playwright/test";
import { makeNoTextPdf, makeTextPdf } from "../fixtures/pdf/make-minimal-pdf";
import {
  expect,
  formAlert,
  hasSupabaseEnv,
  signIn,
  test,
} from "./fixtures/auth";

// specs/ingestion (design.md §11, proposal.md Success Criteria): the two
// end-to-end scenarios not already covered by Vitest unit/component tests —
// a full happy-path import against the real pipeline (download, extract,
// convert, persist, all inside one Server Action call — ADR 0002, no
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
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await page.goto("/");

    const title = "Cuaderno de importación e2e";
    await sidebar.getByRole("button", { name: "Crear cuaderno" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Título").fill(title);
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST" && response.ok(),
      ),
      dialog.getByRole("button", { name: "Crear cuaderno" }).click(),
    ]);
    await expect(sidebar.getByText(title)).toBeVisible();

    await sidebar.getByRole("button", { name: `Acciones de ${title}` }).click();
    await page.getByRole("menuitem", { name: "Importar PDF" }).click();

    const pdfBytes = makeTextPdf(chapterPages(30));
    await page.getByTestId("pdf-import-input").setInputFiles({
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
    // Best-effort, not a hard requirement: the editor only ever swaps in
    // once the job is terminal (page-import-view.tsx), so this should
    // still be true right after navigation. On a machine fast enough to
    // finish processing before this check runs, it would time out instead
    // of racing false — kept short on purpose so that case fails fast
    // rather than eating into the 120s budget below. Orchestrator: watch
    // this line first if the spec is flaky.
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0, {
      timeout: 2_000,
    });

    await waitForImportState(page, "done", 120_000);

    const editorMount = page.getByTestId("editor-mount");
    const editable = editorMount.locator('[contenteditable="true"]');
    await expect(
      editable.getByText("CAPITULO 1", { exact: true }),
    ).toBeVisible();
    await expect(
      editable.getByText("CAPITULO 30", { exact: true }),
    ).toBeVisible();

    const notebookItem = sidebar
      .getByRole("listitem")
      .filter({ hasText: title });
    await expect(
      notebookItem.getByRole("link", { name: "text-30-pages", exact: true }),
    ).toBeVisible();

    await page.reload();
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
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await page.goto("/");

    const title = "Cuaderno sin texto e2e";
    await sidebar.getByRole("button", { name: "Crear cuaderno" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Título").fill(title);
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST" && response.ok(),
      ),
      dialog.getByRole("button", { name: "Crear cuaderno" }).click(),
    ]);
    await expect(sidebar.getByText(title)).toBeVisible();

    await sidebar.getByRole("button", { name: `Acciones de ${title}` }).click();
    await page.getByRole("menuitem", { name: "Importar PDF" }).click();

    const pdfBytes = makeNoTextPdf();
    await page.getByTestId("pdf-import-input").setInputFiles({
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
});
