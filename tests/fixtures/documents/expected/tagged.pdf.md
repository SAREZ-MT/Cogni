# tagged.pdf and untagged.pdf: expected blocks

Source: `lib/pdf-fixture.ts` (`constructsSection`), printed once with
`tagged: true` (tagged.pdf) and once with `tagged: false` (untagged.pdf).
Engine: officeparser 8 with page geometry on (T0 spike). T8 turns this list
into golden assertions.

## tagged.pdf (one A4 page)

| # | Construct in the HTML | Expected block | Known loss |
|---|---|---|---|
| 1 | `<h1>` "Fixture Heading One" | `heading` 1 | |
| 2 | Paragraph with inline formatting and links | `paragraph`: "bold" `bold`, "italic" `italic`, "inlineMono" `code` (Courier font run), "safe link" `link` https://example.com/docs, "evil link" plain text | underline, strike, colour, highlight, sub and sup are lost (PDF text runs only carry font and size); the "2" in H2O may surface as a smaller-size run with no mark |
| 3 | `<h2>` "Heading Two" | `heading` 2 | |
| 4 | Nested `<ul>` 3 levels | `bulletList` nested: Bullet A > Bullet A.1 > Bullet A.1.a, then Bullet B | rebuilt from flat `indentation` |
| 5 | `<ol start="3">` with a nested `<ol>` | `orderedList start: 3` (Number three > Number sub a, Number four) | |
| 6 | `<h3>` "Heading Three" | `heading` 3 | |
| 7 | Table with `<thead>`, colspan and rowspan | `table`: row 1 `tableHeader` H1, H2, H3; then plain cells | spans are lost: "Colspan 2" and "Rowspan 2" become ordinary single cells and the rows are ragged (2, 3 and 2 cells) |
| 8 | `<pre><code>` three lines | `codeBlock` with the three lines | indentation of `return` is lost (PDF text has no leading spaces) |
| 9 | `<blockquote>` | `paragraph` | blockquote is not recoverable from the structure tree |
| 10 | `<img alt="Blue stripe">` 120x80 PNG | `image` with `assetId` | alt is not exposed by officeparser for PDFs |
| 11 | Two-column section (LEFTCOL x2, RIGHTCOL x2) | four `paragraph` blocks in reading order: both LEFTCOL, then both RIGHTCOL | |
| 12 | `<hr>` | nothing | a drawn rule has no text or tag |
| 13 | "After horizontal rule." | `paragraph` | |

## untagged.pdf (same HTML, no structure tree)

Observed in the T0 spike: officeparser recovers the h1 and h2 by font size
(h3 is missed), keeps the ordered list (start 3 via `itemIndex`, one nested
level), loses the bullet list and the table (their cells become separate
paragraphs), and still extracts the image. It emits no warning, so the
mapper falls back to `textToBlocks` when the parser warns
`PDF_STRUCT_TREE_UNRELIABLE` or reports no structure tree. Golden
assertions must only check what survives: every text line of the page is
present in reading order, the two-column section reads LEFTCOL before
RIGHTCOL, "Fixture Heading One" is a heading, the image is extracted, and no
`javascript:` link survives.

## scanned.pdf

A JPEG of a Spanish page ("Capítulo 3: Fotosíntesis") with no text layer.
Without OCR it must fail with `no_text_layer`; with OCR (T12, if accepted)
it yields plain paragraphs of Spanish text.
