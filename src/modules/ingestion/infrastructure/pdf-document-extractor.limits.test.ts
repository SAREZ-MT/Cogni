import { OfficeParser } from "officeparser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { textToBlocks } from "../domain/text-to-blocks";
import type { PdfNode } from "./pdf-ast-mapper";
import {
  PDF_IN_PROCESS_LIMITS,
  PdfDocumentExtractor,
  type PdfInProcessParseReporter,
} from "./pdf-document-extractor";

// document-import T8b: PdfDocumentExtractor against a stubbed officeparser,
// for what a real PDF cannot trigger deterministically — officeparser's
// limit errors and warnings, a pdf.js process that cannot start, a missing
// page count. The real parses are in pdf-document-extractor.test.ts and
// pdf-document-extractor.golden.test.ts.
vi.mock("officeparser", () => ({ OfficeParser: { parseOffice: vi.fn() } }));

type ParseConfig = {
  abortSignal?: AbortSignal;
  onWarning?: (issue: { code: string }) => void;
  pdfParserConfig: Record<string, unknown>;
};

const parseOffice = vi.mocked(
  OfficeParser.parseOffice as unknown as (
    bytes: Buffer,
    config: ParseConfig,
  ) => Promise<unknown>,
);

const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

function run(text: string, y = 100): PdfNode {
  return {
    type: "text",
    text,
    formatting: { font: "Helvetica", size: "12pt" },
    bounds: { x: 0, y, width: text.length * 6, height: 12 },
  };
}

function page(pageNumber: number, ...children: PdfNode[]): PdfNode {
  return { type: "page", metadata: { pageNumber }, children };
}

const paragraph = (text: string): PdfNode => ({
  type: "paragraph",
  children: [run(text)],
});

// `null`: officeparser reported no page count.
function ast(pages: PdfNode[], declaredPages: number | null = pages.length) {
  return {
    metadata: declaredPages === null ? {} : { pages: declaredPages },
    content: pages,
    attachments: [],
  };
}

function officeError(code: string): Error {
  return Object.assign(new Error(code), { officeIssue: { code } });
}

function abortError(): Error {
  return Object.assign(new Error("aborted"), { name: "AbortError" });
}

// A first parse that cannot start its pdf.js process: officeparser warns
// before reading anything, then honours the signal it was given.
function separateProcessUnavailable(fallback: unknown = ast([])) {
  return async (_bytes: Buffer, config: ParseConfig) => {
    config.onWarning?.({ code: "PDF_SEPARATE_PROCESS_UNAVAILABLE" });
    if (config.abortSignal?.aborted) throw abortError();
    return fallback;
  };
}

function extractor(
  reporter: PdfInProcessParseReporter = vi.fn(),
  limits: ConstructorParameters<typeof PdfDocumentExtractor>[0] = {},
) {
  return new PdfDocumentExtractor(limits, undefined, reporter);
}

beforeEach(() => parseOffice.mockReset());

describe("PdfDocumentExtractor: officeparser limits", () => {
  it("maps PDF_PROCESS_FAILED (the pdf.js process ran out of memory) to LIMIT_EXCEEDED", async () => {
    parseOffice.mockRejectedValueOnce(officeError("PDF_PROCESS_FAILED"));

    const result = await extractor().extract(BYTES, "pdf");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
      expect(result.error.message).toBe("PDF_PROCESS_FAILED");
    }
  });

  it("maps an officeparser limit error to LIMIT_EXCEEDED", async () => {
    parseOffice.mockRejectedValueOnce(officeError("OUTPUT_TOO_LARGE"));

    const result = await extractor().extract(BYTES, "pdf");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
      expect(result.error.message).toBe("OUTPUT_TOO_LARGE");
    }
  });

  it("maps a PDF_CONTENT_LIMIT_EXCEEDED warning (a partly read document) to LIMIT_EXCEEDED", async () => {
    parseOffice.mockImplementationOnce(async (_bytes, config) => {
      config.onWarning?.({ code: "PDF_CONTENT_LIMIT_EXCEEDED" });
      return ast([page(1, paragraph("partial"))]);
    });

    const result = await extractor().extract(BYTES, "pdf");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
      expect(result.error.message).toBe("PDF_CONTENT_LIMIT_EXCEEDED");
    }
  });

  it("maps any other officeparser error to UNREADABLE", async () => {
    parseOffice.mockRejectedValueOnce(officeError("PDF_PARSE_FAILED"));

    const result = await extractor().extract(BYTES, "pdf");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
  });
});

describe("PdfDocumentExtractor: unknown page count", () => {
  it("treats a document as over the cap when its page count is unknown and the cap was reached", async () => {
    parseOffice.mockResolvedValueOnce(
      ast(
        [
          page(1, paragraph("a")),
          page(2, paragraph("b")),
          page(3, paragraph("c")),
        ],
        null,
      ),
    );

    const result = await extractor(vi.fn(), { maxPages: 3 }).extract(
      BYTES,
      "pdf",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
  });

  it("accepts a document below the cap whose page count is unknown", async () => {
    parseOffice.mockResolvedValueOnce(
      ast([page(1, paragraph("a")), page(2, paragraph("b"))], null),
    );

    const result = await extractor(vi.fn(), { maxPages: 3 }).extract(
      BYTES,
      "pdf",
    );

    expect(result.ok && result.value.totalPages).toBe(2);
  });

  it("accepts a document exactly at the cap when officeparser reports its page count", async () => {
    parseOffice.mockResolvedValueOnce(
      ast([
        page(1, paragraph("a")),
        page(2, paragraph("b")),
        page(3, paragraph("c")),
      ]),
    );

    const result = await extractor(vi.fn(), { maxPages: 3 }).extract(
      BYTES,
      "pdf",
    );

    expect(result.ok && result.value.totalPages).toBe(3);
  });
});

describe("PdfDocumentExtractor: pdf.js process unavailable (in-process parse)", () => {
  it("never keeps the parse that ran without its process, re-parses in-process under the stricter caps and reports it", async () => {
    const reporter = vi.fn();
    const discarded = ast([page(1, paragraph("from the unbounded parse"))]);
    parseOffice
      .mockImplementationOnce(separateProcessUnavailable(discarded))
      .mockResolvedValueOnce(ast([page(1, paragraph("in-process"))]));

    const result = await extractor(reporter).extract(BYTES, "pdf");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content).toEqual(textToBlocks(["in-process"]).doc);
    expect(parseOffice).toHaveBeenCalledTimes(2);
    const first = parseOffice.mock.calls[0][1];
    expect(first.abortSignal?.aborted).toBe(true);
    const second = parseOffice.mock.calls[1][1];
    expect(second.pdfParserConfig).toMatchObject({
      separateProcess: false,
      pageRange: `1-${PDF_IN_PROCESS_LIMITS.maxPages}`,
      maxTextItems: PDF_IN_PROCESS_LIMITS.maxTextItems,
      maxOperators: PDF_IN_PROCESS_LIMITS.maxOperators,
      maxAnnotations: PDF_IN_PROCESS_LIMITS.maxAnnotations,
    });
    // Codes and caps only: never the document's text or name.
    expect(reporter).toHaveBeenCalledExactlyOnceWith({
      reason: "PDF_SEPARATE_PROCESS_UNAVAILABLE",
      maxPages: PDF_IN_PROCESS_LIMITS.maxPages,
      maxPageChars: PDF_IN_PROCESS_LIMITS.maxPageChars,
      maxTotalChars: PDF_IN_PROCESS_LIMITS.maxTotalChars,
    });
  });

  it("reports every in-process parse, not only the first", async () => {
    const reporter = vi.fn();
    parseOffice
      .mockImplementationOnce(separateProcessUnavailable())
      .mockResolvedValueOnce(ast([page(1, paragraph("one"))]))
      .mockImplementationOnce(separateProcessUnavailable())
      .mockResolvedValueOnce(ast([page(1, paragraph("two"))]));

    const pdf = extractor(reporter);
    await pdf.extract(BYTES, "pdf");
    await pdf.extract(BYTES, "pdf");

    expect(reporter).toHaveBeenCalledTimes(2);
  });

  it("refuses a document over the in-process page cap with the limit error", async () => {
    const pages = PDF_IN_PROCESS_LIMITS.maxPages + 1;
    parseOffice
      .mockImplementationOnce(separateProcessUnavailable())
      .mockResolvedValueOnce(ast([page(1, paragraph("first"))], pages));

    const result = await extractor().extract(BYTES, "pdf");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
      expect(result.error.message).toBe(`${pages} pages`);
    }
  });

  it("refuses a page over the in-process text cap that the separate process accepts", async () => {
    const dense = "x".repeat(PDF_IN_PROCESS_LIMITS.maxPageChars + 1);
    parseOffice.mockResolvedValueOnce(ast([page(1, paragraph(dense))]));
    const separate = await extractor().extract(BYTES, "pdf");
    expect(separate.ok).toBe(true);

    parseOffice
      .mockImplementationOnce(separateProcessUnavailable())
      .mockResolvedValueOnce(ast([page(1, paragraph(dense))]));
    const inProcess = await extractor().extract(BYTES, "pdf");

    expect(inProcess.ok).toBe(false);
    if (!inProcess.ok) {
      expect(inProcess.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
    }
  });

  it("refuses a document over the in-process total text cap", async () => {
    const perPage = Math.floor(PDF_IN_PROCESS_LIMITS.maxPageChars / 2);
    const count = Math.ceil(PDF_IN_PROCESS_LIMITS.maxTotalChars / perPage) + 1;
    const pages = Array.from({ length: count }, (_, index) =>
      page(index + 1, paragraph("y".repeat(perPage))),
    );
    parseOffice
      .mockImplementationOnce(separateProcessUnavailable())
      .mockResolvedValueOnce(ast(pages, count));

    const result = await extractor(vi.fn(), { maxPages: 300 }).extract(
      BYTES,
      "pdf",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
  });

  it("returns the abort error, not a re-parse, when the caller's signal fired", async () => {
    const controller = new AbortController();
    parseOffice.mockImplementationOnce(async (_bytes, config) => {
      config.onWarning?.({ code: "PDF_SEPARATE_PROCESS_UNAVAILABLE" });
      controller.abort();
      throw abortError();
    });

    const result = await extractor().extract(BYTES, "pdf", {
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("aborted");
    expect(parseOffice).toHaveBeenCalledTimes(1);
  });
});

describe("PdfDocumentExtractor: textToBlocks fallback with images", () => {
  const image = (name: string): PdfNode => ({
    type: "image",
    metadata: { attachmentName: name },
  });

  it("converts the same text whether or not the document holds images, each page's images after its text", async () => {
    const texts = ["ONE HEADING\n\nfirst page", "second page\n\n2"];
    const pages = [
      page(
        1,
        paragraph("ONE HEADING"),
        paragraph("first page"),
        image("a.png"),
      ),
      page(2, paragraph("second page"), paragraph("2")),
    ];
    parseOffice.mockResolvedValueOnce({
      ...ast(pages),
      attachments: [
        { name: "a.png", data: Buffer.from(PNG).toString("base64") },
      ],
    });

    const result = await extractor().extract(BYTES, "pdf");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const imageBlock = {
      type: "image",
      attrs: { assetId: null, pendingId: "image-1", alt: null },
    };
    expect(result.value.content).toEqual({
      type: "doc",
      content: [
        ...textToBlocks([texts[0]]).doc.content,
        imageBlock,
        ...textToBlocks([texts[1]]).doc.content,
      ],
    });
    // Without the image the blocks are textToBlocks over the whole
    // document: textToBlocks reads each page on its own.
    const withoutImage = result.value.content.content.filter(
      (block) => block.type !== "image",
    );
    expect(withoutImage).toEqual(textToBlocks(texts).doc.content);
    expect(result.value.images).toHaveLength(1);
    expect(result.value.totalPages).toBe(2);
    expect(result.value.pagesWithoutText).toBe(0);
  });
});
