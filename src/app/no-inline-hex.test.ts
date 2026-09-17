import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec "design-tokens-and-shell": shell components must use tokens only.
// Hex literals belong in globals.css, never in a component.
function listTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listTsx(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

describe("no inline hex colors in app components", () => {
  it("finds no #rgb / #rrggbb literals under src/app", () => {
    const offenders = listTsx(import.meta.dirname)
      .filter((file) => !file.endsWith(".test.tsx"))
      .filter((file) => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(file, "utf8")));

    expect(offenders).toEqual([]);
  });
});
