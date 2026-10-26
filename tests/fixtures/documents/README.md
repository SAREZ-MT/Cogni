# Document import fixtures

Golden inputs for the `document-import` feature (`odd/tasks/document-import.md`):
the DOCX, PPTX and PDF adapters (T6–T8), the budget tests and the e2e specs
(T13) all read from `files/`.

Regenerate everything with:

```sh
pnpm fixtures:documents
```

The generator (`generate.ts` + `lib/`) is deterministic: two runs produce
byte-identical files, so a regeneration that changes a binary is a real
change worth reviewing. `lib/determinism.ts` freezes the clock, `Math.random`
and `crypto.getRandomValues` while `docx`/`pptxgenjs` run, and rewrites the
`/CreationDate` and `/ModDate` that Chromium stamps into each PDF. Every file
carries the fixed date 2026-01-01T00:00:00Z.

## Files

| File | Produced by | What it is |
|---|---|---|
| `all-constructs.docx` | `docx` (`lib/docx-fixture.ts`) | Every DOCX construct in the source-mapping table: Title, Heading 1–6, bold/italic/underline/strike/sub/sup/colour/highlight/shading/inline monospace, an https link and a `javascript:` link, nested bullet and numbered lists (3 levels, numbered list starting at 3), SDT and ☐/☑ checkbox items, a table with header row, colspan and rowspan, a multi-line `Code`-style block, a `Quote`-style paragraph, OMML equations (single- and multi-character arguments), a PNG with alt text, an SVG with PNG fallback, a page break. |
| `all-constructs.pptx` | `pptxgenjs` (`lib/pptx-fixture.ts`) | 5 slides, each with a title placeholder and speaker notes: bullets at levels 0–2 plus a numbered list; a table with header row and merged cells; a picture with alt text; a text box with bold, italic, underline, colour, an https link and a `javascript:` link; a text box with two paragraphs. |
| `tagged.pdf` | Playwright Chromium `page.pdf({ tagged: true })` (`lib/pdf-fixture.ts`) | One A4 page from HTML: h1–h3, inline formatting and links, nested ul and `ol start=3`, table with thead, colspan and rowspan, pre/code, blockquote, img with alt, a two-column section, hr. Carries a structure tree. |
| `untagged.pdf` | same HTML, `tagged: false` | The same page with no structure tree: exercises the `textToBlocks` fallback. |
| `scanned.pdf` | Chromium screenshot (JPEG) printed into a PDF | A Spanish page ("Capítulo 3: Fotosíntesis") as an image only: no text layer. |
| `large-30p.pdf` | same HTML x 30, tagged | 30 pages for the 120 s budget test. |
| `large-40s.pptx` | `makeDeck(40)` | 40 slides for the budget test. |
| `large-30p.docx` | `largeDocx(30)` | 30 chapters of filler plus the full construct set (about 30 pages) for the budget test. |
| `corrupt.pdf` | first 600 bytes of `tagged.pdf` + garbage | Starts with `%PDF-` but is unreadable: must fail as `invalid_document`. |
| `corrupt.docx` | first half of `all-constructs.docx` | Truncated ZIP: must fail as `invalid_document`. |
| `garbage.bin` | repeated ASCII text | Not a document at all: must be rejected by format detection. |
| `legacy.doc` | OLE2 signature + 4 KiB of zeros | Legacy binary Office header: must fail as `unsupported_format`. |

`expected/*.md` lists, per all-constructs fixture, each construct and the
block it must become, including the losses the T0 spike measured (for
example PDF tables lose their spans). Later tasks turn those lists into
golden assertions; when the mapper behaviour changes, update both.

## Sizes

Every all-constructs file is under 200 KB and every large file under 2 MB,
so all of them are committed (largest: `large-30p.pdf`, about 570 KB).

## Known limits

- No Word- or PowerPoint-exported files: LibreOffice and Microsoft Office
  are not available in this environment, so every OOXML file comes from a
  JavaScript writer and every PDF from Chromium. Real Office output (other
  style ids, `w:sdt` variants, PDF/UA tagging from Word) is not covered;
  add such files here by hand when available, and document their origin.
- `docx` writes OMML; it is not proof that Word renders the equations the
  same way.
- The scanned page is a clean render, not a photographed page: OCR accuracy
  on it is an upper bound.
- `pptxgenjs` 4.0.1 depends on `image-size`, which has a high-severity
  advisory. Both generator libraries are dev dependencies used only here;
  they never ship in the app bundle.
- PDF bytes depend on the local Chromium build and system fonts. They are
  stable run to run on one machine, but `large-30p.pdf` once came out
  different (same size) across two otherwise identical sessions, so a
  regenerated PDF diff on another machine is expected; re-check the parser
  output rather than the bytes.
- Regenerating the PDFs needs the Playwright Chromium browser
  (`pnpm exec playwright install chromium`).
