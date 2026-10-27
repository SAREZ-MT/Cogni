# all-constructs.pptx: expected blocks

Source: `lib/pptx-fixture.ts` (`makeDeck(5)`). Engine: officeparser 8 (T0
spike). Table spans are read from the slide XML (`gridSpan`, `rowSpan`,
`hMerge`, `vMerge`) because officeparser reports a plain grid. T7 turned
this list into golden assertions
(`src/modules/ingestion/infrastructure/pptx-document-extractor.test.ts`).

Every slide starts with its title placeholder and ends with its speaker notes.

| Slide | Construct | Expected blocks |
|---|---|---|
| all | Title placeholder "Slide N title" | `heading` level 2 (one per slide, first block of the slide). T7 decision: the page title already names the deck, so slide titles are level 2; only a title slide's centred title (`ctrTitle`) is level 1, and a slide without a title gets "Diapositiva N" |
| all | Speaker notes "Speaker notes for slide N." | `details` (`open: false`) > `detailsSummary` "Notas del orador" + `detailsContent` > `paragraph` with the notes text, last block of the slide; the notes page's slide-number placeholder is cut from the XML before officeparser reads it, so its paragraph never appears |
| 1 | Bullets at indent levels 0, 1, 2 | `bulletList` nested 3 levels: "Level 1 bullet" > "Level 2 bullet" > "Level 3 bullet" (rebuilt from the flat `indentation` metadata) |
| 1 | Two numbered paragraphs | `orderedList` (start 1) with "Numbered one", "Numbered two" |
| 2 | Table 4x3 | `table`: row 1 `tableHeader` H1, H2, H3 (first row is the header); row 2 `tableCell colspan: 2` "Colspan 2", "C3"; row 3 `tableCell rowspan: 2` "Rowspan 2", "B2", "B3"; row 4 "C2", "C3b". Merged placeholder cells are not emitted. |
| 3 | PNG picture with alt "Blue stripe" | `image` with `assetId`, `alt: "Blue stripe"` |
| 4 | Text box with runs | `paragraph`: "Bold part" `bold`; ", italic" `italic`; ", underline" `underline`; ", red" `textStyle.color` #ff0000; ", link" `link` https://example.com/slides only (the underline PowerPoint puts on hyperlink runs goes with the link); ", evil" plain text (the `javascript:` link and its underline are dropped). Black (#000000) colour runs carry no colour mark. |
| 5 | Text box with a line break | two `paragraph` blocks: "Body paragraph one.", "Body paragraph two on a new line." |

Attachments: with `extractAttachments` on, officeparser reports 2 —
`image-3-1.png` (the slide-3 picture) and a bogus `image` entry with
`application/octet-stream`. The T7 adapter runs officeparser without
attachments (it only parses the XML parts) and reads each picture's media
part itself through the slide's relationships, so the bogus entry never
exists: exactly one image (`image/png`, by magic bytes) is extracted.

No separator: slides follow one another without a `horizontalRule` (each
opens with its heading). Totals: `totalPages` 5, `pagesWithoutText` 0.
