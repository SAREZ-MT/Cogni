import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import {
  createVerifiedUser,
  deleteUserByEmail,
  expect,
  hasSupabaseEnv,
  signIn,
  type TestUser,
  test,
} from "./fixtures/auth";

import {
  clickAndWaitForAction,
  createNotebook,
  createNotebookWithOpenPage,
  createPageAndOpen,
  notebookCard,
  openNotebook,
} from "./helpers/notebooks";

// Task 2.12 skeleton: create notebook -> create page -> rename -> icon/color
// -> archive -> disappears from the library -> route not found. Extended in
// PR4 (specs/notebooks/spec.md, §13 acceptance flow) once the editor is
// wired for real content. Since design pass 2 the sidebar is navigation only:
// notebooks live on /notebooks (cards with an "Acciones de {título}" kebab)
// and pages on /notebooks/[notebookId] (see helpers/notebooks.ts).

// specs/editor/spec.md, "Autosave con debounce...": waits for the exact
// terminal status the spec promises after a save settles. No retry: a real
// save failing here is a regression, not a transient condition to paper
// over (see domain-error.ts's toActionError()/isDomainErrorLike() and
// editor/ui/tiptap/to-plain-tiptap-doc.ts for the two root causes that used
// to make every autosave in this flow fail).
// S7 (odd/tasks/app-shell-restyle.md, drift #1): the status now portals
// into the page header's meta row instead of rendering inside
// `editor-mount` (editor/ui/tiptap/editor.tsx's `statusPortalId`), so this
// scopes to the page instead of the (now unrelated) editor mount element.
async function waitForSaved(page: Page) {
  await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
    timeout: 15000,
  });
}

async function waitForConflictBanner(editorMount: Locator) {
  await expect(editorMount.getByTestId("conflict-banner")).toBeVisible({
    timeout: 15000,
  });
}

test.describe("notebooks acceptance", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("create, rename, recolor, add a page and archive a notebook from the library", async ({
    page,
  }) => {
    // Crear cuaderno
    await createNotebook(page, "Cuaderno e2e");

    // Renombrar (Scenario "Renombrar y cambiar ícono desde el sidebar", now
    // the "Renombrar" item of the card's kebab menu).
    await page
      .getByRole("button", { name: "Acciones de Cuaderno e2e" })
      .click();
    await page.getByRole("menuitem", { name: "Renombrar" }).click();
    const renameDialog = page.getByRole("dialog");
    await renameDialog.getByLabel("Título").fill("Cuaderno renombrado");
    await clickAndWaitForAction(
      page,
      renameDialog.getByRole("button", { name: "Guardar" }),
      '"title":"Cuaderno renombrado"',
    );
    await expect(notebookCard(page, "Cuaderno renombrado")).toBeVisible();
    await expect(notebookCard(page, "Cuaderno e2e")).toHaveCount(0);
    await page.reload();
    await expect(notebookCard(page, "Cuaderno renombrado")).toBeVisible();

    // Cambiar color: the starting color is random, so pick a target that
    // differs from the current one (otherwise the check proves nothing). The
    // card's tile must switch without a reload, and the dialog must highlight
    // the new color after one (it was persisted, not just updated on screen).
    const tile = notebookCard(page, "Cuaderno renombrado")
      .locator("span")
      .first();
    const currentColor = (await tile.getAttribute("class"))?.match(
      /bg-pastel-(\w+)/,
    )?.[1];
    const targetColor = currentColor === "purple" ? "mint" : "purple";
    await page
      .getByRole("button", { name: "Acciones de Cuaderno renombrado" })
      .click();
    await page.getByRole("menuitem", { name: "Cambiar apariencia" }).click();
    await clickAndWaitForAction(
      page,
      page
        .getByRole("dialog")
        .getByRole("button", { name: `Color ${targetColor}` }),
      `"color":"${targetColor}"`,
    );
    await expect(tile).toHaveClass(new RegExp(`bg-pastel-${targetColor}`));
    await page.reload();
    await page
      .getByRole("button", { name: "Acciones de Cuaderno renombrado" })
      .click();
    await page.getByRole("menuitem", { name: "Cambiar apariencia" }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: `Color ${targetColor}` }),
    ).toHaveClass(/ring-2/);
    await page.keyboard.press("Escape");

    // Crear y abrir una página (Scenario "Crear y abrir una página"): the
    // notebook's own route replaces the sidebar's "Crear página en…" button.
    const notebookId = await openNotebook(page, "Cuaderno renombrado");
    await createPageAndOpen(page);

    // Archivar (Scenario "Archivar desde el sidebar", now the card's
    // "Archivar" item plus its confirmation dialog).
    await page.goto("/notebooks");
    await page
      .getByRole("button", { name: "Acciones de Cuaderno renombrado" })
      .click();
    await page.getByRole("menuitem", { name: "Archivar" }).click();
    await clickAndWaitForAction(
      page,
      page.getByRole("dialog").getByRole("button", {
        name: "Archivar",
        exact: true,
      }),
      '"notebookId"',
    );
    await expect(notebookCard(page, "Cuaderno renombrado")).toHaveCount(0);

    // Archiving is not just an optimistic client update: it must survive a
    // reload (Scenario "Archivado lógico sin restauración" reads from the
    // server on every request).
    await page.reload();
    await expect(notebookCard(page, "Cuaderno renombrado")).toHaveCount(0);

    // The archived notebook's own route is gone too (Scenario "Ruta de
    // página ajena" applies to archived ids as well).
    const archivedRoute = await page.goto(`/notebooks/${notebookId}`);
    expect(archivedRoute?.status()).toBe(404);
  });

  // New entry point (design pass 2): pages are archived from their card on
  // the notebook's route ("Archivar página {título}"), replacing the sidebar
  // tree row's trash button.
  test("archives a page from the notebook route and it stays gone after a reload", async ({
    page,
  }) => {
    const title = `Cuaderno de páginas ${randomUUID().slice(0, 8)}`;
    await createNotebook(page, title);
    await openNotebook(page, title);
    await createPageAndOpen(page);
    await openNotebook(page, title);
    await expect(page.getByRole("link", { name: /^Sin título/ })).toBeVisible();

    // The trash button only opens the confirmation dialog; the mutation
    // fires when it is confirmed.
    await page
      .getByRole("button", { name: "Archivar página Sin título" })
      .click();
    await clickAndWaitForAction(
      page,
      page.getByRole("dialog").getByRole("button", {
        name: "Archivar",
        exact: true,
      }),
      '"pageId"',
    );
    await expect(page.getByRole("link", { name: /^Sin título/ })).toHaveCount(
      0,
    );

    await page.reload();
    await expect(page.getByRole("link", { name: /^Sin título/ })).toHaveCount(
      0,
    );
  });

  test("a foreign page route renders not-found (Scenario 'Ruta de página ajena')", async ({
    page,
    browser,
    verifiedUser,
  }) => {
    // Owner A creates a notebook and a page.
    await createNotebookWithOpenPage(page, "Privado de A");
    const foreignUrl = page.url();

    // Owner B (a second verified user, own browser context) opens the same URL.
    let ownerB: TestUser | undefined;
    try {
      ownerB = await createVerifiedUser();
      const context = await browser.newContext();
      const otherPage = await context.newPage();
      await signIn(otherPage, ownerB);
      const response = await otherPage.goto(foreignUrl);
      expect(response?.status()).toBe(404);
      await expect(otherPage.getByTestId("editor-mount")).toHaveCount(0);
      await context.close();
    } finally {
      if (ownerB) await deleteUserByEmail(ownerB.email);
    }
    void verifiedUser;
  });

  // §13 acceptance flow (proposal.md Success Criteria; specs/editor/spec.md
  // Scenario "Persistencia al volver"): every block family available in
  // this slice, saved and reloaded.
  test("writes every available block family, saves and survives a reload", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(page, "Cuaderno de aceptación");

    const editorMount = page.getByTestId("editor-mount");
    await expect(editorMount).toBeVisible();
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();

    // Heading, via the "/" menu.
    await page.keyboard.type("/h1");
    await expect(page.getByTestId("command-menu")).toBeVisible();
    await page.keyboard.press("Enter");
    await page.keyboard.type("Notas de aceptación");
    await page.keyboard.press("Enter");

    // Paragraph: the default block after Enter from a heading.
    await page.keyboard.type("Un párrafo normal con las ideas del día.");
    await page.keyboard.press("Enter");

    // Bullet list.
    await page.keyboard.type("/bullets");
    await page.keyboard.press("Enter");
    await page.keyboard.type("primer punto");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter"); // exit the list

    // Task item.
    await page.keyboard.type("/checklist");
    await page.keyboard.press("Enter");
    await page.keyboard.type("repasar el tema");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter"); // exit the list

    // Quote.
    await page.keyboard.type("/cita");
    await page.keyboard.press("Enter");
    await page.keyboard.type("una cita memorable");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter"); // exit the blockquote

    // Code block.
    await page.keyboard.type("/code");
    await page.keyboard.press("Enter");
    await page.keyboard.type("const x = 1;");

    await expect(editable.locator("h1")).toHaveText("Notas de aceptación");
    await expect(editable).toContainText(
      "Un párrafo normal con las ideas del día.",
    );
    await expect(
      editable.locator('ul:not([data-type="taskList"]) li'),
    ).toContainText("primer punto");
    await expect(
      editable.locator('li:has(input[type="checkbox"])'),
    ).toContainText("repasar el tema");
    await expect(editable.locator("blockquote")).toContainText(
      "una cita memorable",
    );
    await expect(editable.locator("pre code")).toContainText("const x = 1;");

    await waitForSaved(page);

    await page.reload();

    const reloadedEditable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await expect(reloadedEditable.locator("h1")).toHaveText(
      "Notas de aceptación",
    );
    await expect(reloadedEditable).toContainText(
      "Un párrafo normal con las ideas del día.",
    );
    await expect(
      reloadedEditable.locator('ul:not([data-type="taskList"]) li'),
    ).toContainText("primer punto");
    await expect(
      reloadedEditable.locator('li:has(input[type="checkbox"])'),
    ).toContainText("repasar el tema");
    await expect(reloadedEditable.locator("blockquote")).toContainText(
      "una cita memorable",
    );
    await expect(reloadedEditable.locator("pre code")).toContainText(
      "const x = 1;",
    );
  });

  // Task 9.1 audit gap: the test above only covers H1, paragraph, bullet
  // list, task list, quote and code. This test covers the remaining §3.2
  // families reachable end to end today: H2/H3, ordered list, divider,
  // the "idea"/"nota" callouts (proposal.md Success Criteria; specs/
  // editor/spec.md, Scenario "Persistencia al volver"), the Cogni
  // highlight mark and the five inline marks (Scenario "Marca por
  // atajo"). A link is left out on purpose: the app has no dialog,
  // button or keyboard shortcut that calls `setLink()` (extensions/
  // index.ts, link.test.tsx), so a real user cannot reach it end to end
  // yet — see the delegated report's gap note.
  test("writes the remaining block families (H2/H3, ordered list, divider, callouts, highlight, inline marks), saves and survives a reload", async ({
    page,
  }) => {
    const title = `Cuaderno de bloques ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, title);

    const editorMount = page.getByTestId("editor-mount");
    await expect(editorMount).toBeVisible();
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();

    // H2 / H3, via the "/" menu.
    await page.keyboard.type("/h2");
    await expect(page.getByTestId("command-menu")).toBeVisible();
    await page.keyboard.press("Enter");
    await page.keyboard.type("Segundo nivel");
    await page.keyboard.press("Enter");

    await page.keyboard.type("/h3");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Tercer nivel");
    await page.keyboard.press("Enter");

    // Ordered (numbered) list.
    await page.keyboard.type("/numeros");
    await page.keyboard.press("Enter");
    await page.keyboard.type("paso uno");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter"); // exit the list

    // Divider: `setHorizontalRule` already leaves the cursor in the
    // paragraph it inserts right after the <hr>, so no extra Enter here.
    await page.keyboard.type("/divisor");
    await page.keyboard.press("Enter");

    // Callouts "idea" and "nota" ("advertencia" is already covered by
    // slash-command.spec.ts). Same "block+" node as blockquote, so the
    // same double-Enter lifts an empty trailing paragraph back out.
    await page.keyboard.type("/idea");
    await page.keyboard.press("Enter");
    await page.keyboard.type("una idea genial");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");

    await page.keyboard.type("/nota");
    await page.keyboard.press("Enter");
    await page.keyboard.type("nota importante");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");

    // Inline marks and the Cogni highlight: typed in one plain pass first
    // (each word/phrase its own paragraph, still unmarked — the same safe
    // pattern the block families above already use), then marked in a
    // second pass that never types or presses Enter again. Applying a
    // keyboard shortcut or the highlight button, then pressing Enter to
    // start a new paragraph right after, can corrupt the just-marked
    // paragraph; not typing anything after a mark also means there is no
    // stored mark left to leak into later text.
    await page.keyboard.type("negrita");
    await page.keyboard.press("Enter");
    await page.keyboard.type("cursiva");
    await page.keyboard.press("Enter");
    await page.keyboard.type("subrayado");
    await page.keyboard.press("Enter");
    await page.keyboard.type("tachado");
    await page.keyboard.press("Enter");
    await page.keyboard.type("codigoinline");
    await page.keyboard.press("Enter");
    await page.keyboard.type("texto resaltado");

    // A triple click (a real mouse selection) selects the whole (one-word)
    // line, and the standard Tiptap shortcut applies its mark (extensions/
    // marks.test.tsx).
    async function applyMarkTo(word: string, shortcut: string) {
      const wordLocator = editable.getByText(word, { exact: true });
      await wordLocator.click({ clickCount: 3 });
      await page.keyboard.press(shortcut);
    }

    await applyMarkTo("negrita", "ControlOrMeta+b");
    await applyMarkTo("cursiva", "ControlOrMeta+i");
    await applyMarkTo("subrayado", "ControlOrMeta+u");
    await applyMarkTo("tachado", "ControlOrMeta+Shift+s");
    await applyMarkTo("codigoinline", "ControlOrMeta+e");

    // Cogni highlight mark: S6a folded the standalone highlight-picker
    // BubbleMenu into the shared bubble toolbar (bubble-toolbar.tsx) — the
    // palette (highlight-picker-controls.tsx) now only appears after
    // opening the toolbar's color popover ("Color de texto", whose
    // "Fondo/Resaltado" row reuses it unchanged), instead of floating on its
    // own on selection. Same triple-click selection as the inline marks
    // above; a keyboard-only Home/Shift+End does not reliably make the
    // toolbar appear.
    await editable
      .getByText("texto resaltado", { exact: true })
      .click({ clickCount: 3 });
    const bubbleToolbar = page.getByTestId("bubble-toolbar");
    await expect(bubbleToolbar).toBeVisible();
    await bubbleToolbar.getByRole("button", { name: "Color de texto" }).click();
    await page
      .getByTestId("highlight-picker")
      .getByRole("button", { name: "Resaltar en verde" })
      .click();
    await expect(editable.locator('mark[data-color="green"]')).toContainText(
      "texto resaltado",
    );

    // Six rapid mark toggles above can each restart the 800-1500ms autosave
    // debounce (design.md, "Autosave con debounce de cliente"): an autosave
    // already in flight for an earlier mark does not pick up a later one,
    // it only schedules its own follow-up debounce. Waiting for "guardado"
    // right away can observe that earlier, incomplete save. Letting the
    // debounce fully settle first (no further edits for longer than its
    // window) guarantees the next "guardado" covers every mark above.
    await page.waitForTimeout(1800);
    await waitForSaved(page);

    await page.reload();

    const reloadedEditable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await expect(reloadedEditable.locator("h2")).toHaveText("Segundo nivel");
    await expect(reloadedEditable.locator("h3")).toHaveText("Tercer nivel");
    await expect(reloadedEditable.locator("ol li")).toContainText("paso uno");
    await expect(reloadedEditable.locator("hr")).toBeVisible();
    await expect(
      reloadedEditable.locator('[data-testid="callout"][data-kind="idea"]'),
    ).toContainText("una idea genial");
    await expect(
      reloadedEditable.locator('[data-testid="callout"][data-kind="note"]'),
    ).toContainText("nota importante");
    await expect(
      reloadedEditable.locator('mark[data-color="green"]'),
    ).toContainText("texto resaltado");
    await expect(reloadedEditable.locator("strong")).toContainText("negrita");
    await expect(reloadedEditable.locator("em")).toContainText("cursiva");
    await expect(reloadedEditable.locator("u")).toContainText("subrayado");
    await expect(reloadedEditable.locator("s")).toContainText("tachado");
    await expect(reloadedEditable.locator("p code")).toContainText(
      "codigoinline",
    );
  });

  // specs/editor/spec.md, "Reconciliación del conflicto de versión",
  // Scenario "Conflicto detectado" end to end: two tabs (two Playwright
  // BrowserContexts) editing the same page as the same user. The second
  // tab's autosave fires against a version the first tab already moved
  // past, so it must reconcile instead of overwriting.
  test("a stale save in a second tab reconciles instead of overwriting (two-tab conflict)", async ({
    page,
    browser,
    verifiedUser,
  }) => {
    await createNotebookWithOpenPage(page, "Cuaderno dos pestañas");
    const sharedUrl = page.url();

    // Tab B: same user, own BrowserContext, opens the page while it still
    // holds the original (version 1) content in memory.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signIn(pageB, verifiedUser);
    await pageB.goto(sharedUrl);
    const editorMountB = pageB.getByTestId("editor-mount");
    await expect(editorMountB).toBeVisible();
    await pageB.waitForLoadState("networkidle");
    const editableB = editorMountB.locator('[contenteditable="true"]');

    // Tab A: edits and saves first, moving the page to version 2.
    const editorMountA = page.getByTestId("editor-mount");
    const editableA = editorMountA.locator('[contenteditable="true"]');
    await editableA.click();
    await page.keyboard.type("editado desde la pestaña A");
    await waitForSaved(page);

    // Tab B: edits its own (now stale) copy. Its autosave still carries
    // expectedVersion 1, which the server rejects.
    await editableB.click();
    await pageB.keyboard.type("editado desde la pestaña B, sin saber de A");

    await waitForConflictBanner(editorMountB);
    // The server's (tab A's) content replaced tab B's document.
    await expect(editableB).toContainText("editado desde la pestaña A");
    await expect(editableB).not.toContainText("pestaña B");

    // The discarded local draft is still recoverable on demand.
    await pageB.getByRole("button", { name: "recuperar mi borrador" }).click();
    await expect(editableB).toContainText(
      "editado desde la pestaña B, sin saber de A",
    );
    await expect(editorMountB.getByTestId("conflict-banner")).toHaveCount(0);

    await contextB.close();
  });
});
