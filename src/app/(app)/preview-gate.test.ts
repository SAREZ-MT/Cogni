import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

// Every route under /flashcards is a sample-data preview. A page added later
// without the guard would leak sample decks into production, so the guard is
// enforced structurally here instead of by review.
describe("flashcards preview gate", () => {
  const pages = pageFiles(import.meta.dirname);

  it("finds the flashcards routes", () => {
    expect(pages.length).toBeGreaterThanOrEqual(3);
  });

  it.each(
    pages.map((file) => [path.relative(import.meta.dirname, file), file]),
  )("%s calls requireDesignPreviews() before reading any data", (_name, file) => {
    const source = readFileSync(file as string, "utf8");

    const guard = source.indexOf("requireDesignPreviews();");
    expect(guard).toBeGreaterThan(-1);
    for (const dataAccess of ["await params", "getSample"]) {
      const first = source.indexOf(
        dataAccess,
        source.indexOf("export default"),
      );
      if (first !== -1) expect(guard).toBeLessThan(first);
    }
  });
});
