import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Route trees that are design previews backed by route-local sample data.
// Add a tree here when a new preview ships. `routes` is the number of pages
// the tree must keep, so a deleted or renamed page cannot silently shrink
// the guarded surface. `flashcards` is not listed: its list routes run on real
// data since Phase 3, and its deck route serves the sample player only behind
// `designPreviewsEnabled()` (covered by that route's own test).
const PREVIEW_TREES: [tree: string, routes: number][] = [
  ["active-recall", 3],
  ["exams", 2],
  ["dashboard", 1],
];

// Real-data routes leave the gate (Phase 5 T4: an exam page's questions;
// T6: its exam player and results). The exams hub and notebook view stay
// previews until T9.
const REAL_DATA_PAGES = new Set([
  "exams/[notebookId]/[pageId]/page.tsx",
  "exams/[notebookId]/[pageId]/preguntas/page.tsx",
  "exams/[notebookId]/[pageId]/resultados/page.tsx",
]);

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

// The first statement of the default export's body (the one after the
// signature's closing `) {`).
function firstStatement(source: string): string {
  const body = source.slice(source.indexOf("export default"));
  const open = body.indexOf(") {\n");
  return (
    body
      .slice(open + 4)
      .split("\n")
      .find((line) => line.trim() !== "")
      ?.trim() ?? ""
  );
}

// Every route under a preview tree serves sample data. A page added later
// without the guard would leak it into production, so the guard is enforced
// structurally here instead of by review.
describe.each(PREVIEW_TREES)("%s preview gate", (tree, routes) => {
  const pages = pageFiles(path.join(import.meta.dirname, tree)).filter(
    (file) =>
      !REAL_DATA_PAGES.has(
        // REAL_DATA_PAGES uses "/"; path.relative uses "\\" on Windows.
        path
          .relative(import.meta.dirname, file)
          .split(path.sep)
          .join("/"),
      ),
  );

  it("finds the routes of the tree", () => {
    expect(pages.length).toBeGreaterThanOrEqual(routes);
  });

  it.each(
    pages.map((file) => [path.relative(import.meta.dirname, file), file]),
  )("%s calls requireDesignPreviews() as its first statement", (_name, file) => {
    const source = readFileSync(file as string, "utf8");

    expect(source).toContain("requireDesignPreviews");
    expect(firstStatement(source)).toBe("requireDesignPreviews();");
  });
});
