import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Route trees that are design previews backed by route-local sample data.
// Add a tree here when a new preview ships (dashboard).
const PREVIEW_TREES = ["flashcards", "active-recall", "exams"];

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
describe.each(PREVIEW_TREES)("%s preview gate", (tree) => {
  const pages = pageFiles(path.join(import.meta.dirname, tree));

  it("finds the routes of the tree", () => {
    expect(pages.length).toBeGreaterThanOrEqual(3);
  });

  it.each(
    pages.map((file) => [path.relative(import.meta.dirname, file), file]),
  )("%s calls requireDesignPreviews() as its first statement", (_name, file) => {
    const source = readFileSync(file as string, "utf8");

    expect(source).toContain("requireDesignPreviews");
    expect(firstStatement(source)).toBe("requireDesignPreviews();");
  });
});
