# tagged.pdf and untagged.pdf: expected blocks

Source: `lib/pdf-fixture.ts` (`constructsSection`), printed once with
`tagged: true` (tagged.pdf) and once with `tagged: false` (untagged.pdf).
Engine: officeparser 8.2 with page geometry on. T8 asserts every row in
`src/modules/ingestion/infrastructure/pdf-document-extractor.golden.test.ts`
(rows updated in T8 where the real output differs from the T0 spike notes).

## tagged.pdf (one A4 page)

| # | Construct in the HTML | Expected block | Known loss |
|---|---|---|---|
| 1 | `<h1>` "Fixture Heading One" | `heading` 1 | |
| 2 | Paragraph with inline formatting and links | `paragraph` starting "Plain, ": "bold" `bold`, "italic" `italic`, "inlineMono" `code` (Courier font run), "safe link" `link` https://example.com/docs, "evil link" plain text; no other mark | underline, strike, colour, highlight, sub and sup are lost (PDF text runs only carry font and size). The "2" of H2O is in reading order and stays as plain text ("H2O"); the "2" of x² is read before its line (officeparser sorts by baseline) and is dropped, leaving "x , red" |
| 3 | `<h2>` "Heading Two" | `heading` 2 | |
| 4 | Nested `<ul>` 3 levels | `bulletList` nested: Bullet A > Bullet A.1 > Bullet A.1.a, then Bullet B | rebuilt from flat `indentation` |
| 5 | `<ol start="3">` with a nested `<ol>` | `orderedList start: 3` (Number three > Number sub a, Number four) | |
| 6 | `<h3>` "Heading Three" | `heading` 3 | |
| 7 | Table with `<thead>`, colspan and rowspan | `table`: row 1 `tableHeader` H1, H2, H3; then `tableCell` rows "Colspan 2", "C3" / "Rowspan 2", "B2", "B3" / "C2", "C3b", each padded with empty cells to 3 | spans are lost: "Colspan 2" and "Rowspan 2" become ordinary single cells and the short rows get an empty last cell |
| 8 | `<pre><code>` three lines | `codeBlock` (`language: null`) "function add(a, b) {\nreturn a + b;\n}" | indentation of `return` is lost (PDF text has no leading spaces) |
| 9 | `<blockquote>` | `paragraph` | blockquote is not recoverable from the structure tree |
| 10 | `<img alt="Blue stripe">` 120x80 PNG | `image` (`pendingId` → `assetId`, `alt: null`) | alt is not exposed by officeparser for PDFs |
| 11 | Two-column section (LEFTCOL x2, RIGHTCOL x2) | four `paragraph` blocks in reading order: both LEFTCOL, then both RIGHTCOL | "two-column", broken across lines at its hyphen, becomes "twocolumn": officeparser's `mergeHyphenatedWords` drops a line-end hyphen before a lowercase continuation (kept on: it repairs the far more common syllable hyphenation) |
| 12 | `<hr>` | nothing | a drawn rule has no text or tag |
| 13 | "After horizontal rule." | `paragraph` | |

## untagged.pdf (same HTML, no structure tree)

officeparser rebuilds the structure from geometry and emits no warning.
Because that AST holds headings and a list, the adapter maps it like a
tagged one (the fallback rule in `pdf-document-extractor.ts`: textToBlocks
only when the AST has no heading, list or table at all). Observed and
asserted in T8: "Fixture Heading One" (h1) and "Heading Two" (h2) by font
size, "Heading Three" missed (a bold paragraph); the inline paragraph with
the same marks and links as tagged.pdf (the misplaced superscript, a
paragraph of its own here, is dropped); the bullet list lost (plain
paragraphs, "Bullet A.1.a Bullet B" merged); the ordered list kept
(`start: 3`, one nested level); the table lost (its cells become
paragraphs); the Courier lines as one `codeBlock`; the image extracted;
LEFTCOL before RIGHTCOL, but "After horizontal rule." read between the two
columns (officeparser's column detection). No `javascript:` link survives.
The pre-T8 text path (unpdf + textToBlocks) made this page almost one long
paragraph, with "3. Number three" as a heading and no image.

## scanned.pdf

A JPEG of a Spanish page ("Capítulo 3: Fotosíntesis") with no text layer.
Without OCR it fails with `no_text_layer` (asserted in T8; officeparser
warns `PDF_NO_TEXT_EXTRACTED`, its page image is not uploaded); with OCR
(T12, if accepted) it yields plain paragraphs of Spanish text.

## corrupt.pdf

The first 600 bytes of tagged.pdf plus garbage. officeparser rejects it
(`Invalid PDF structure`), so it fails as `invalid_document`, never as
`no_text_layer` (T1 review follow-up, asserted in T8).
