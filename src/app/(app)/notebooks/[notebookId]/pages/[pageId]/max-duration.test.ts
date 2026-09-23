import { describe, expect, it, vi } from "vitest";
import { MAX_DURATION_S } from "@/modules/ingestion";

// design.md, "Decision: Procesamiento síncrono en la Server Action con
// maxDuration": Next applies a Server Action's `maxDuration` from the page
// segment it is invoked from, and `processPdfImport` (T8's
// ingestion/actions.ts) is only ever invoked from this route
// (`PageImportView`, T11). `page.tsx` must therefore export the literal
// (route segment config must be statically analyzable at build time, so it
// cannot be a computed reference) equal to MAX_DURATION_S — this test pins
// that equality so the two can never silently drift apart.
//
// Heavy imports (@/modules/editor, @/modules/notebooks' Server Actions) are
// mocked: this test only needs the module's top-level `maxDuration` export,
// never renders the page, and must not require a database or Supabase
// client to import it. `server-only` is stubbed for the same reason
// supabase-pdf-storage-gateway.test.ts stubs it: vitest runs in jsdom, not
// Next's "react-server" condition, so the real package throws on import
// outside a Server Component build — `@/modules/ingestion`'s public barrel
// re-exports `./actions` ("use server"), which reaches `serverEnv()`
// (`server-only`) at module-eval time even though this test never calls a
// Server Action.
vi.mock("server-only", () => ({}));
vi.mock("@/modules/editor", () => ({ Editor: () => null }));
vi.mock("@/modules/notebooks", () => ({
  getAssetReadUrl: vi.fn(),
  getCurrentContent: vi.fn(),
  getPageForRoute: vi.fn(),
  registerPageAsset: vi.fn(),
  requestImageUpload: vi.fn(),
  saveContent: vi.fn(),
}));

describe("page route maxDuration", () => {
  it("equals ingestion's MAX_DURATION_S, the internal budget processPdfImport is bounded by", async () => {
    const page = await import("./page");

    expect(page.maxDuration).toBe(MAX_DURATION_S);
    expect(page.maxDuration).toBe(120);
  });
});
