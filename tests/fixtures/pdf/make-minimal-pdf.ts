// Hand-built, valid PDF 1.4 documents for unit tests that need real bytes a
// PDF parser (officeparser/pdf.js) can open, without checking in a binary fixture
// or depending on a PDF-writing library. Every object offset is computed
// from the actual bytes written so far, so the xref table is exact.
//
// Reusable wherever a small real PDF is needed (ingestion/infrastructure's
// pdf-document-extractor.test.ts; the e2e fixtures can build on the same
// approach for a larger sample).

const encoder = new TextEncoder();

function buildPdf(objects: string[]): Uint8Array {
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = encoder.encode(pdf).length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += xref;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return encoder.encode(pdf);
}

function pageObjects(contentStreamBody: string): string[] {
  const lengthBytes = encoder.encode(contentStreamBody).length;
  return [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${lengthBytes} >>\nstream\n${contentStreamBody}\nendstream`,
  ];
}

// A single-page, valid PDF whose page renders one line of text via a
// standard Type1 font. Escapes the PDF string-literal special characters
// so any plain-ASCII text is safe to embed.
export function makeMinimalPdf(text = "Hello World"): Uint8Array {
  const escaped = text.replace(/([()\\])/g, "\\$1");
  const contentStream = `BT /F1 24 Tf 72 700 Td (${escaped}) Tj ET`;
  return buildPdf(pageObjects(contentStream));
}

// A structurally valid single-page PDF whose content stream draws nothing
// (no text operators at all) — a real PDF a parser opens successfully,
// distinct from "not a PDF" (detectDocumentFormat, domain/document-format.ts)
// and from a parser failure (DOCUMENT_FILE_ERROR.UNREADABLE).
export function makeNoTextPdf(): Uint8Array {
  return buildPdf(pageObjects(""));
}

// Bytes that start with the PDF magic number but are otherwise garbage:
// detectDocumentFormat() (domain/document-format.ts) reads this as a PDF,
// but no real parser can open it — the shape pdf-document-extractor.test.ts
// uses to prove DOCUMENT_FILE_ERROR.UNREADABLE.
export function makeCorruptPdfBytes(): Uint8Array {
  return encoder.encode("%PDF-1.4\nthis is not a real PDF body at all");
}

// One page's content stream: each entry in `lines` becomes its own text
// line, positioned with `TL`/`T*` (leading + "move to next line") so a real
// parser reports them in the same top-to-bottom order they were given, not
// a caller-computed Y coordinate. Same escaping as makeMinimalPdf, so plain
// ASCII text is safe to embed (this hand-rolled writer never sets a font
// /Encoding, so it relies on the Type1 Helvetica font's built-in
// StandardEncoding — accented/non-ASCII characters are out of scope here,
// same limitation makeMinimalPdf already documents).
function contentStreamForLines(lines: string[]): string {
  const body = ["BT", "/F1 16 Tf", "18 TL", "72 730 Td"];
  lines.forEach((line, index) => {
    const escaped = line.replace(/([()\\])/g, "\\$1");
    if (index === 0) {
      body.push(`(${escaped}) Tj`);
    } else {
      body.push("T*", `(${escaped}) Tj`);
    }
  });
  body.push("ET");
  return body.join("\n");
}

// A multi-page, valid PDF: one page per entry in `pages`, each rendered as
// its own set of text lines (split on "\n") through a shared Helvetica
// font resource. Built with the same manual offset/xref approach as
// buildPdf/pageObjects above (byte-exact, no PDF-writing library), just
// generalized from one page to N: object numbers are assigned positionally
// (1=Catalog, 2=Pages, 3=Font, then a [Page, Contents] pair per page), so
// the Pages object's /Kids array can be computed up front from
// `pages.length` alone. Reused by tests/e2e/pdf-import.spec.ts (T12) to
// build the 30-page happy-path fixture in-test instead of checking in a
// binary PDF.
export function makeTextPdf(pages: string[]): Uint8Array {
  if (pages.length === 0) {
    throw new Error("makeTextPdf requires at least one page");
  }

  const kids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  for (const pageText of pages) {
    // The page object is pushed next (object number = objects.length + 1);
    // its Contents object follows right after it (objects.length + 2).
    const contentObjNum = objects.length + 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 3 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R >>`,
    );
    const contentStreamBody = contentStreamForLines(pageText.split("\n"));
    const lengthBytes = encoder.encode(contentStreamBody).length;
    objects.push(
      `<< /Length ${lengthBytes} >>\nstream\n${contentStreamBody}\nendstream`,
    );
  }

  return buildPdf(objects);
}
