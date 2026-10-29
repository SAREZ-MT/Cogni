import type { Locator, Page } from "@playwright/test";
import { expect } from "../fixtures/auth";

// Shared entry points of the notebook flows. Since design pass 2 the sidebar
// is navigation only, so notebooks are created, opened and managed from the
// /notebooks library and from the notebook's own route:
// - the /notebooks grid tile "Nuevo cuaderno" (or, with no notebooks yet,
//   the empty state's "Crear mi primer cuaderno") opens the "Crear
//   cuaderno" dialog;
// - each notebook is a card ("article") with an "Acciones de {título}" kebab
//   (Renombrar, Cambiar apariencia, Archivar);
// - pages are created ("Nueva página") and archived ("Archivar página
//   {título}") on /notebooks/[notebookId], and open from its page cards.

// Server Actions POST to the current pathname; `page.waitForLoadState
// ("networkidle")` is unreliable here (background beacons/tunnels keep the
// network "non-idle" or resolve the wait before the action's own response
// arrives). Waiting for the exact POST response guarantees the mutation
// actually settled — with its real, server-assigned id — before the next
// step reads DOM state that depends on it (specs/notebooks/spec.md,
// "Guardado de contenido con comparar-e-intercambiar" applies the same
// atomic-write discipline the UI must not race ahead of).
// Hardened per PR3b review: an unscoped "any POST" predicate can match an
// unrelated in-flight request (analytics, a previous action's retry) and
// resolve before this click's own Server Action response arrives. Scoping
// to a successful (2xx) response still waiting on the exact click keeps the
// timing guarantee while catching a failed action instead of silently
// racing past it.
//
// Pass `bodyIncludes` whenever other Server Actions can fire around the click:
// the shell polls actions of its own right after a refresh (an argument-less
// POST to the same pathname), and matching that one instead of the click's
// action lets the next step (e.g. a reload) abort the real mutation in
// flight. The action's serialized arguments carry its input, so matching a
// fragment of it (`"color":"purple"`) pins the exact request.
export async function clickAndWaitForAction(
  page: Page,
  locator: Locator,
  bodyIncludes?: string,
) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        candidate.ok() &&
        (bodyIncludes === undefined ||
          (candidate.request().postData() ?? "").includes(bodyIncludes)),
    ),
    locator.click(),
  ]);
  return response;
}

// The notebook's card on /notebooks (grid view). Scoped by title: the
// worker-scoped verifiedUser accumulates notebooks across the spec files
// that share the single worker.
export function notebookCard(page: Page, title: string): Locator {
  return page.getByRole("article").filter({ hasText: title });
}

// Creates a notebook from the /notebooks library and waits until its card is
// rendered. Since Phase 8 H4-T4 the hub has no header create button: an
// owner without notebooks gets the empty state's "Crear mi primer cuaderno"
// CTA, anyone else the grid's dashed "Nuevo cuaderno" tile — exactly one of
// the two is on the page.
export async function createNotebook(page: Page, title: string) {
  await page.goto("/notebooks");
  await page
    .getByRole("button", {
      name: /^(Nuevo cuaderno|Crear mi primer cuaderno)$/,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill(title);
  await clickAndWaitForAction(
    page,
    dialog.getByRole("button", { name: "Crear cuaderno" }),
  );
  await expect(notebookCard(page, title)).toBeVisible();
}

// Opens a notebook's own route from its card and returns its id.
export async function openNotebook(page: Page, title: string) {
  await page.goto("/notebooks");
  await notebookCard(page, title)
    .getByRole("link", { name: title, exact: true })
    .click();
  await expect(page).toHaveURL(/\/notebooks\/[^/?]+$/);
  return new URL(page.url()).pathname.split("/")[2] ?? "";
}

// Adds a blank page from "Nueva página" on the notebook's route (the
// notebook must be the current page). Since Phase 8 H5-T2 that control is
// the grid's first item (or the empty state's button while the notebook
// has no pages); since H5-T3 it opens the "Nueva página" dialog, whose
// "Página en blanco" creates the page and lands in its editor right away.
// A freshly created page is titled "Sin título".
export async function createPageAndOpen(page: Page) {
  await page.getByRole("button", { name: "Nueva página" }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva página" });
  await dialog.getByRole("button", { name: /Página en blanco/ }).click();
  await expect(page).toHaveURL(/\/notebooks\/[^/]+\/pages\/[^/?]+$/);
  await expect(page.getByTestId("editor-mount")).toBeVisible();
}

// Convenience for specs that only need a notebook with one open page.
export async function createNotebookWithOpenPage(page: Page, title: string) {
  await createNotebook(page, title);
  await openNotebook(page, title);
  await createPageAndOpen(page);
}
