// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  FIXED_TIME_MS,
  withFrozenRuntime,
} from "../../../../tests/fixtures/documents/lib/determinism";
import { buildOoxmlFixtures } from "../../../../tests/fixtures/documents/lib/ooxml-fixtures";

// document-import T13 (T1 review R3-001/R3-004): the committed OOXML
// fixtures must be exactly what the generator produces today, so a library
// bump or a generator edit that changes the bytes fails here instead of
// silently testing stale files. The Chromium PDFs are left out on purpose:
// their bytes depend on the local Chromium build and fonts (README "Known
// limits").
const FILES = join(process.cwd(), "tests/fixtures/documents/files");
const DRIFT =
  "fixtures drifted from the generator; run pnpm fixtures:documents";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("document fixtures determinism", () => {
  const outDir = mkdtempSync(join(tmpdir(), "cogni-fixtures-"));
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it("regenerates every OOXML fixture byte for byte", async () => {
    const fixtures = await buildOoxmlFixtures();
    const names = Object.keys(fixtures).sort();
    expect(names).toEqual([
      "all-constructs.docx",
      "all-constructs.pptx",
      "corrupt.docx",
      "garbage.bin",
      "large-30p.docx",
      "large-40s.pptx",
      "legacy.doc",
    ]);

    const drifted: string[] = [];
    for (const name of names) {
      const regenerated = join(outDir, name);
      writeFileSync(regenerated, fixtures[name]);
      const fresh = sha256(readFileSync(regenerated));
      const committed = sha256(readFileSync(join(FILES, name)));
      if (fresh !== committed) drifted.push(name);
    }
    expect(drifted, `${DRIFT} (drifted: ${drifted.join(", ")})`).toEqual([]);
  }, 30_000);
});

describe("withFrozenRuntime", () => {
  it("freezes Date called without new, as a string of the fixed time", async () => {
    const value = await withFrozenRuntime(1, async () =>
      (Date as unknown as () => string)(),
    );
    expect(value).toBe(new Date(FIXED_TIME_MS).toString());
  });

  it("keeps new Date(), Date.now() and instanceof on the fixed time", async () => {
    const seen = await withFrozenRuntime(1, async () => {
      const now = new Date();
      return {
        iso: now.toISOString(),
        now: Date.now(),
        isDate: now instanceof Date,
        explicit: new Date(0).getTime(),
        utc: Date.UTC(2020, 0, 1),
      };
    });
    expect(seen).toEqual({
      iso: "2026-01-01T00:00:00.000Z",
      now: FIXED_TIME_MS,
      isDate: true,
      explicit: 0,
      utc: Date.UTC(2020, 0, 1),
    });
    expect(Date.now()).not.toBe(FIXED_TIME_MS);
  });
});
