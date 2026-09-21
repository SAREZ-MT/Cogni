import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// specs/editor/spec.md, "Apariencia y copy del editor", Scenario
// "Ausencia de valores literales": no component under `editor/ui` may
// contain an inline hex color code (a Tailwind class, `style` prop, or
// hand-written CSS value) — every color MUST come from a design-system
// token (docs/design-system/, "no hex values ever appear in a
// component"). Source files only, never test files (which legitimately
// assert against absent hex codes as strings).
const EDITOR_UI_ROOT = path.join(process.cwd(), "src/modules/editor/ui");
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) return [];
    return SOURCE_EXTENSIONS.has(path.extname(entry)) ? [full] : [];
  });
}

describe("editor/ui has no inline hex colors", () => {
  it("contains no hex color literal in any non-test source file", () => {
    const files = listSourceFiles(EDITOR_UI_ROOT);

    expect(files.length).toBeGreaterThan(0);

    const offenders = files
      .map((file) => ({
        file: path.relative(process.cwd(), file),
        content: readFileSync(file, "utf8"),
      }))
      .filter(({ content }) => HEX_PATTERN.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });
});
