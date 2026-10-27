// @vitest-environment node
// officeparser needs its Node path here (see the golden test's header).
import childProcess from "node:child_process";
import { readFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { OfficeParser, type OfficeParserConfig } from "officeparser";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { makeTextPdf } from "../../../../tests/fixtures/pdf/make-minimal-pdf";
import type { ExtractedDocument } from "../domain/document-extractor";
import {
  PDF_IN_PROCESS_LIMITS,
  PdfDocumentExtractor,
  type PdfInProcessParseEvent,
} from "./pdf-document-extractor";

vi.mock("server-only", () => ({}));

// document-import T8b follow-up (R3-unavailable-abort-assumption): the
// degraded mode with the REAL officeparser, not a stub of it. officeparser
// starts pdf.js's process with `spawn` from `await import("child_process")`
// (officeparser/dist/parsers/pdf/pdfProcess.js `start`) and, when that
// throws, warns PDF_SEPARATE_PROCESS_UNAVAILABLE and reads the PDF in this
// process. Patching the builtin's `spawn` (synced into its ESM namespace)
// makes every start fail. officeparser keeps idle processes in a pool, so
// these tests live in their own file, where no earlier parse can have left
// one to reuse; the spawn assertions prove the path was really taken.
const FILES = join(process.cwd(), "tests/fixtures/documents/files");
const tagged = new Uint8Array(readFileSync(join(FILES, "tagged.pdf")));
const PARSE_TIMEOUT_MS = 30_000;

const realSpawn = childProcess.spawn;
const failingSpawn = vi.fn(() => {
  throw new Error("spawn disabled by the test");
});

function disableSpawn() {
  childProcess.spawn = failingSpawn as unknown as typeof realSpawn;
  syncBuiltinESMExports();
}

function restoreSpawn() {
  childProcess.spawn = realSpawn;
  syncBuiltinESMExports();
}

function extractor(events: PdfInProcessParseEvent[]) {
  return new PdfDocumentExtractor({}, undefined, (event) => events.push(event));
}

describe("PdfDocumentExtractor degraded mode (real officeparser, no pdf.js process)", () => {
  let degraded: ExtractedDocument | undefined;

  beforeAll(disableSpawn);
  afterAll(restoreSpawn);

  it(
    "aborts the first parse, re-parses tagged.pdf in-process under the in-process caps and reports it",
    async () => {
      const parseOffice = vi.spyOn(OfficeParser, "parseOffice");
      const events: PdfInProcessParseEvent[] = [];
      try {
        const result = await extractor(events).extract(tagged, "pdf");

        expect(failingSpawn).toHaveBeenCalled();
        expect(parseOffice).toHaveBeenCalledTimes(2);
        const [first, second] = parseOffice.mock.calls.map(
          (call) => call[1] as OfficeParserConfig | undefined,
        );
        // The first parse asked for a separate process, was aborted from
        // the warning and its outcome discarded.
        expect(first?.pdfParserConfig?.separateProcess).toBe(true);
        expect(first?.abortSignal?.aborted).toBe(true);
        expect(parseOffice.mock.settledResults[0]?.type).toBe("rejected");
        // The second ran here, under the stricter caps.
        expect(second?.pdfParserConfig).toMatchObject({
          separateProcess: false,
          pageRange: `1-${PDF_IN_PROCESS_LIMITS.maxPages}`,
          maxTextItems: PDF_IN_PROCESS_LIMITS.maxTextItems,
          maxOperators: PDF_IN_PROCESS_LIMITS.maxOperators,
          maxAnnotations: PDF_IN_PROCESS_LIMITS.maxAnnotations,
        });
        expect(parseOffice.mock.settledResults[1]?.type).toBe("fulfilled");
        expect(events).toEqual([
          {
            reason: "PDF_SEPARATE_PROCESS_UNAVAILABLE",
            maxPages: PDF_IN_PROCESS_LIMITS.maxPages,
            maxPageChars: PDF_IN_PROCESS_LIMITS.maxPageChars,
            maxTotalChars: PDF_IN_PROCESS_LIMITS.maxTotalChars,
          },
        ]);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        degraded = result.value;
        expect(degraded.totalPages).toBe(1);
        expect(degraded.content.content[0]?.type).toBe("heading");
        expect(degraded.content.content.map((block) => block.type)).toEqual(
          expect.arrayContaining([
            "bulletList",
            "orderedList",
            "table",
            "codeBlock",
            "image",
          ]),
        );
      } finally {
        parseOffice.mockRestore();
      }
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "refuses a PDF over the in-process page cap (under the normal one) with LIMIT_EXCEEDED",
    async () => {
      const pages = Array.from(
        { length: PDF_IN_PROCESS_LIMITS.maxPages + 1 },
        (_, index) => `Page ${index + 1} text`,
      );
      const events: PdfInProcessParseEvent[] = [];
      failingSpawn.mockClear();

      const result = await extractor(events).extract(makeTextPdf(pages), "pdf");

      expect(failingSpawn).toHaveBeenCalled();
      expect(events).toHaveLength(1);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
      expect(result.error.message).toBe(
        `${PDF_IN_PROCESS_LIMITS.maxPages + 1} pages`,
      );
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "returns the same blocks in-process as with the pdf.js process",
    async () => {
      expect(degraded).toBeDefined();
      restoreSpawn();
      const events: PdfInProcessParseEvent[] = [];

      const normal = await extractor(events).extract(tagged, "pdf");

      expect(events).toEqual([]);
      expect(normal.ok && normal.value.content).toEqual(degraded?.content);
    },
    PARSE_TIMEOUT_MS,
  );
});
