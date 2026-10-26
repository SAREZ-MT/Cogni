# all-constructs.pptx: expected blocks

Source: `lib/pptx-fixture.ts` (`makeDeck(5)`). Engine: officeparser 8 (T0
spike). Table spans are read from the slide XML (`gridSpan`, `rowSpan`,
`hMerge`, `vMerge`) because officeparser reports a plain grid. T7 turns this
list into golden assertions.

Every slide starts with its title placeholder and ends with its speaker notes.

| Slide | Construct | Expected blocks |
|---|---|---|
| all | Title placeholder "Slide N title" | `heading` level 1 (one per slide, first block of the slide) |
| all | Speaker notes "Speaker notes for slide N." | `details` > `detailsSummary` "Notas del orador" + `detailsContent` > `paragraph` with the notes text; the slide-number paragraph officeparser adds to notes is dropped |
| 1 | Bullets at indent levels 0, 1, 2 | `bulletList` nested 3 levels: "Level 1 bullet" > "Level 2 bullet" > "Level 3 bullet" (rebuilt from the flat `indentation` metadata) |
| 1 | Two numbered paragraphs | `orderedList` (start 1) with "Numbered one", "Numbered two" |
| 2 | Table 4x3 | `table`: row 1 `tableHeader` H1, H2, H3 (first row is the header); row 2 `tableCell colspan: 2` "Colspan 2", "C3"; row 3 `tableCell rowspan: 2` "Rowspan 2", "B2", "B3"; row 4 "C2", "C3b". Merged placeholder cells are not emitted. |
| 3 | PNG picture with alt "Blue stripe" | `image` with `assetId`, `alt: "Blue stripe"` |
| 4 | Text box with runs | `paragraph`: "Bold part" `bold`; ", italic" `italic`; ", underline" `underline`; ", red" `textStyle.color` #FF0000; ", link" `link` https://example.com/slides; ", evil" plain text (the `javascript:` link is dropped). Black (#000000) colour runs carry no colour mark. |
| 5 | Text box with a line break | two `paragraph` blocks: "Body paragraph one.", "Body paragraph two on a new line." |

Attachments reported by officeparser: 2, `image-3-1.png` (image/png, the
slide-3 picture) and a bogus `image` entry with `application/octet-stream`
that the mapper must filter out; only the referenced picture becomes an
image block.
