# all-constructs.docx: expected blocks

Source: `lib/docx-fixture.ts` (`allConstructsBody`). Engine per the T0 spike:
mammoth for block structure (with a styleMap for `Code`, `Quote` and page
breaks) plus officeparser for what mammoth drops (colour, highlight/shading,
ordered `start`, OMML). T6 turns this list into golden assertions.

Blocks appear in this order.

| # | Construct in the file | Expected block | Notes |
|---|---|---|---|
| 1 | Paragraph style `Title` "Fixture Title" | `heading` level 1 | Title maps to level 1, like Heading 1 (mammoth emits `h1.title`). |
| 2 | Heading 1 … Heading 6 "Heading level N" | `heading` levels 1–6 | Six blocks. |
| 3 | Paragraph "Plain, bold, italic, …" | `paragraph` with marks | `bold`, `italic`, `underline`, `strike`, `subscript` ("2" in H2O), `superscript` ("2" in x2), `textStyle.color` #FF0000 ("red"), `highlight` yellow ("highlight"), `textStyle.backgroundColor` #C6EFCE or `highlight` ("shading"), `code` ("inlineMono", Courier New run). Colour and shading come from officeparser; mammoth drops them. |
| 4 | Paragraph with two hyperlinks | `paragraph` with `link` | "safe link" keeps `link.href = https://example.com/docs`. "evil link" (`javascript:alert(1)`) stays as plain text: the link mark is dropped. |
| 5 | Bullets: A, A.1 (level 1), A.1.a (level 2), B | `bulletList` nested 3 levels | A > A.1 > A.1.a, then B as the second top-level item. |
| 6 | Numbered: three (start 3), sub a, sub i, four | `orderedList` with `start: 3`, nested 3 levels | Inner lists are `orderedList` with default start. `start` comes from officeparser `itemIndex` / numbering, not mammoth. |
| 7 | SDT checkbox checked " Done task (sdt)" | `taskList` > `taskItem checked: true` | Checkbox glyph/control removed from the text. |
| 8 | SDT checkbox unchecked " Open task (sdt)" | `taskItem checked: false` | Same `taskList` as 7 (consecutive items group). |
| 9 | "☐ Open task (glyph)" | `taskItem checked: false` | `☐` prefix stripped. |
| 10 | "☑ Done task (glyph)" | `taskItem checked: true` | `☑` prefix stripped. |
| 11 | Table, 4 rows x 3 columns | `table` | Row 1: three `tableHeader` (H1, H2, H3, bold). Row 2: `tableCell colspan: 2` "Colspan 2", "C3". Row 3: `tableCell rowspan: 2` "Rowspan 2", "B2", "B3". Row 4: "C2", "C3b" (the vMerge continuation cell is not emitted). |
| 12 | Three consecutive `Code` style paragraphs | one `codeBlock` | Text `function add(a, b) {\n  return a + b;\n}` (indentation kept). |
| 13 | `Quote` style paragraph | `blockquote` > `paragraph` | "A quoted sentence from someone wise." |
| 14 | "Equation: " + OMath a/b + x^2 + sqrt(y) | `paragraph` "Equation: " + `inlineMath` | Single-character arguments: officeparser LaTeX loses braces; if the LaTeX does not validate, fall back to plain text. Expected LaTeX when convertible: `\frac{a}{b} + x^{2} + \sqrt{y}`. |
| 15 | OMath (a+1)/(2b) alone in a paragraph | `blockMath` | `\frac{a+1}{2b}`. |
| 16 | OMath sqrt(x+y) = sum_{i=1}^{n} i | `blockMath` | `\sqrt{x+y}=\sum_{i=1}^{n} i`. |
| 17 | OMath e^{2x} | `blockMath` | `e^{2x}`. |
| 18 | PNG image 64x48, alt "Blue stripe" / description "A blue PNG" | `image` with `assetId`, `alt` | mammoth reads the description ("A blue PNG") as alt. |
| 19 | SVG image with PNG fallback, alt "Red circle" | `image` from the PNG fallback, or skipped | SVG itself is an unsupported image format: skipped and counted. If the adapter can reach the PNG fallback it may emit an `image` instead; T6 records which. |
| 20 | Page break | `horizontalRule` | |
| 21 | "After page break." | `paragraph` | |

Attachments reported by officeparser: 3 (PNG, SVG, PNG fallback). The SVG
reports `application/octet-stream`; sniff by magic bytes.
