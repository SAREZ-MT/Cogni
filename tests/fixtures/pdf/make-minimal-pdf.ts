// Hand-built, valid PDF 1.4 documents for unit tests that need real bytes a
// PDF parser (unpdf/pdf.js) can open, without checking in a binary fixture
// or depending on a PDF-writing library. Every object offset is computed
// from the actual bytes written so far, so the xref table is exact.
//
// Reusable wherever a small real PDF is needed (ingestion/infrastructure's
// unpdf-text-extractor.test.ts; T12's e2e fixtures can build on the same
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
// distinct from "not a PDF" (looksLikePdf) and from a parser failure
// (PDF_FILE_ERROR.UNREADABLE).
export function makeNoTextPdf(): Uint8Array {
  return buildPdf(pageObjects(""));
}

// Bytes that start with the PDF magic number but are otherwise garbage:
// looksLikePdf() (domain/pdf-file.ts) passes this, but no real parser can
// open it — the shape unpdf-text-extractor.test.ts uses to prove
// PDF_FILE_ERROR.UNREADABLE.
export function makeCorruptPdfBytes(): Uint8Array {
  return encoder.encode("%PDF-1.4\nthis is not a real PDF body at all");
}
