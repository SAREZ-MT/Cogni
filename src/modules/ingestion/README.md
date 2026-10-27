# Module `ingestion`

## Responsibility

Document import: a user picks a document from a notebook, it is uploaded
directly to a private Supabase Storage bucket, its content is extracted on
the server and converted into an editable page in the TipTap editor
(`docs/documento-maestro.md` §13, Phase 2). Since document-import T5 the
pipeline is format-aware (PDF, Word `.docx`, PowerPoint `.pptx`); every
format has its adapter (DOCX since T6, PPTX since T7) and the UI offers
PDF and Word since T11 (see "UI"). The Server Actions keep their
PDF-era names (`requestPdfUpload`, `startPdfImport`, `processPdfImport`):
renaming them changes nothing for the user and every caller, so they stay.

## Layers

Follows the same hexagonal shape as `notebooks`
(`domain/application/infrastructure/ui`), enforced by
`.dependency-cruiser.cjs` (`domain-is-pure`, `application-no-infra-or-ui`,
`ui-never-touches-infra`, `cross-module-via-index`, plus this module's own
`no-in-process-pdfjs`, `mammoth-only-in-ingestion-infra` and
`officeparser-only-in-ingestion-infra`).

- `domain/`: pure TypeScript — the `ImportJob` entity and its lifecycle
  transitions (`start`/`complete`/`fail`), the failure taxonomy and its
  UI-safe Spanish copy, the document file rules (`document-file.ts`:
  allowed mimes, 20 MiB limit for every format, the
  `{ownerId}/{uuid v7}.{pdf|docx|pptx}` storage path whose extension
  records the declared format, page title from the file name), format
  detection from the real bytes (`document-format.ts`: `%PDF-`; a ZIP whose
  entries include `[Content_Types].xml` plus `word/document.xml` or
  `ppt/presentation.xml`; OLE2 → `legacy`; read in pure TypeScript from
  the ZIP central directory, or the local headers of a truncated archive),
  the `textToBlocks` heuristic that turns plain PDF text into
  TipTap-shaped blocks (the PDF fallback since T8), the `ImportedDoc` type (`imported-doc.ts`, every block of the
  content catalogue in `src/shared/kernel/tiptap-catalogue.ts`; notebooks'
  `writeImportedContent` rejects anything outside it) with its recursive
  `hasTextContent` predicate, the time budgets (`import-budget.ts`), the
  rules the format mappers share (`imported-marks.ts`: safe link schemes,
  Word highlight → palette, hex colours, the dominant-colour rule,
  monospace fonts; `imported-blocks.ts`: nested lists from flat levels,
  inline merging and trimming; `image-mime.ts`: png/jpeg/gif/webp by magic
  bytes and the image caps; `omml-latex.ts`: repair and validation of
  officeparser's equation LaTeX), the OOXML readers (`zip-directory.ts`,
  `ooxml-guard.ts`, `xml-tags.ts`, `ooxml-hidden-text.ts`, `pptx-xml.ts`)
  and every port interface.
  No framework, no npm dependency other than Zod.
- `application/`: the five use cases (`requestPdfUpload`, `startPdfImport`,
  `processImportJob`, `getImportJobStatus`, `getActiveImports`), each
  `Result`-returning and testable with the in-memory fakes under
  `application/testing/`. Never imports `infrastructure` or `ui`.
- `infrastructure/`: the only layer allowed to import `mammoth`,
  `officeparser`, the Supabase client and `@/modules/notebooks`. `SupabasePdfStorageGateway` wraps the
  private `page-pdfs` bucket, `FormatRoutingDocumentExtractor`
  (`createDocumentExtractor()`) dispatches to one `DocumentExtractor` per
  format — `PdfDocumentExtractor` maps officeparser's PDF AST, with
  `textToBlocks` as fallback (see "PDF"),
  `DocxDocumentExtractor` merges mammoth and officeparser (see "DOCX"),
  `PptxDocumentExtractor` maps officeparser's slides (see "PPTX") —
  `NotebooksPagesAdapter` wraps `createNotebooksServerApi` to implement
  `NotebookPagesPort`, `ImportTelemetryAdapter` reports to PostHog and
  Sentry, and `DrizzleImportJobRepository` persists `import_jobs`.
- `actions.ts`: the composition root. `"use server"` — every Server Action
  resolves the session first, composes the adapters above per call and maps
  every `DomainError` to the plain `ActionError` shape before returning, so
  no action ever throws to the client. This is also the only file allowed
  to read `serverEnv()`'s Supabase/PostHog configuration for this module.
- `index.ts`: the public API. Only the five Server Actions, pure
  types/constants from `domain`/`application` are re-exported; nothing from
  `infrastructure` ever crosses this barrel, so importing this module from
  a Client Component never pulls Drizzle, the Supabase client or a parser
  into the client bundle.
- `ui/`: the menu item, progress card, providers and page view.
  `ActiveImportsProvider`/`useIsImporting` (T13a) track the sidebar's
  active imports (initial ids from a server-side `getActiveImports()` call
  plus polling) so `ImportingPageBadge` can show next to a page under
  import; `DocumentImportProvider` calls `add()` right after `startPdfImport`
  succeeds and `PageImportView` calls `remove()` once its own job reaches a
  terminal state.

## UI

Since T11 the picker imports PDF and Word documents, and PowerPoint
decks since T7 (`ui/`; components
renamed from `Pdf*` to `Document*`; since T11b the app shell uses the
`Document*` names and the old aliases are gone):

- Entry points: the notebook menu's "Importar documento"
  (`ImportDocumentMenuItem`) and the editor's `/` item "Importar
  documento" — "Importa un PDF, un Word o un PowerPoint en esta página"
  (`page-editor.tsx`). Both open `DocumentImportProvider`'s single hidden
  input (`data-testid="document-import-input"`).
- Formats (`ui/import-formats.ts`): `DOCUMENT_FORMATS` minus
  `NOT_YET_IMPORTABLE_IN_UI` (empty since T7; a future format waits there
  until its adapter exists, and `invalidFileType` follows by itself). The
  input's `accept` is `.pdf,.docx,.pptx,application/pdf,<docx mime>,<pptx
  mime>`; `importMimeOf` takes a file whose declared type is one of those
  mimes, or whose type is empty or generic (`application/octet-stream`,
  `application/zip`, …) and extension is `.pdf`/`.docx`/`.pptx`. That mime is what `requestPdfUpload`,
  the signed upload (`uploadDocumentToSignedUrl`, its `contentType`) and
  `startPdfImport` receive; the server still checks the stored object and
  the real bytes.
- Client-side refusals, before any Server Action: another type (a legacy
  `.doc`/`.ppt`, an image) → "Solo puedes importar archivos PDF, Word
  (.docx) o PowerPoint (.pptx)."; over 20 MiB → "El documento supera el límite de 20 MB.".
  A rate-limited request or start shows "Llegaste al límite de
  importaciones por ahora. …" in the failed banner.
- Progress: "procesando el documento…"; the sidebar badge's accessible
  name is "Importando documento".
- Done with `skippedImages > 0` (`ImportJobStatusView.skippedImages`): the
  warning card above the editor says "No pudimos importar N imágenes de
  este documento." (singular for one), below the omitted-pages line when
  both apply.

## Ports and adapters

| Port (`domain/`) | Adapter (`infrastructure/`) | Fake (`application/testing/`) |
|---|---|---|
| `PdfStorageGateway` | `SupabasePdfStorageGateway` | `FakePdfStorageGateway` |
| `DocumentExtractor` | `FormatRoutingDocumentExtractor` → `PdfDocumentExtractor`, `DocxDocumentExtractor`, `PptxDocumentExtractor` | `FakeDocumentExtractor` |
| `NotebookPagesPort` | `NotebooksPagesAdapter` | `FakeNotebookPagesPort` |
| `ImportTelemetry` | `ImportTelemetryAdapter` | `FakeImportTelemetry` |
| `ImportJobRepository` | `DrizzleImportJobRepository` | `InMemoryImportJobRepository` |

A shared contract suite (`application/testing/import-job-repository.contract.ts`)
runs against both `InMemoryImportJobRepository` (`pnpm test`) and
`DrizzleImportJobRepository` (`pnpm test:db`, against `cogni-dev`), so the
two never drift on the transition semantics (`create`/`claim`/`markDone`/
`markFailed` are each meant to be one atomic conditional `UPDATE ...
RETURNING`).

## Document port

`DocumentExtractor.extract(bytes, format)` returns
`Result<ExtractedDocument, DomainError>`, where `ExtractedDocument` is
`{ content: ImportedDoc; totalPages; pagesWithoutText; images:
ExtractedImage[]; skippedImages }` and `ExtractedImage` is `{ key, bytes,
mime, alt }`. An image node in `content` points at its image with
`attrs.pendingId === key` (the DOCX adapter emits images since T6, the
PPTX adapter since T7, the PDF adapter since T8).
`skippedImages` counts images found in the source but not kept because
their format is not png/jpeg/gif/webp. Errors: `DOCUMENT_UNSUPPORTED_FORMAT`
when no adapter handles the format, `DOCUMENT_UNREADABLE` for a corrupt,
encrypted or truncated file.

`processImportJob` downloads the object, rejects it above 20 MiB, detects
its format from the bytes, and maps each outcome to a failure kind:

| Outcome | Kind | Message |
|---|---|---|
| Legacy (`.doc`/`.ppt`), unknown bytes, or bytes that are not the format the path declares | `unsupported_format` | "Solo puedes importar archivos PDF, Word (.docx) o PowerPoint (.pptx)." (derived from `IMPORTABLE_FORMATS` in `domain/document-format.ts`) |
| Extractor returns `DOCUMENT_UNSUPPORTED_FORMAT` | `unsupported_format` | same |
| Any other extractor error, a thrown extractor, or a file over 20 MiB | `invalid_document` | "Este archivo no es un documento válido o está protegido. …" |
| No block carries text (`hasTextContent`), PDF | `no_text_layer` | "Este PDF no tiene texto seleccionable y Cogni no hace OCR. …" |
| No block carries text, DOCX/PPTX | `empty_document` | "El documento no tiene texto que podamos importar." |

### Images (T9)

After the text check, `processImportJob` stores every image the content
references (`pendingImageKeys`, each key once) through
`NotebookPagesPort.storeImportedAsset` — notebooks uploads it to the
`page-assets` bucket under `{ownerId}/{pageId}/{fileId}.{ext}` and inserts
the `page_assets` row — one at a time, while more than
`IMAGE_UPLOAD_RESERVE_MS` (10 s) of the processing budget is left. The pure
`resolvePendingImages` (`domain/pending-images.ts`) then swaps each stored
image's `pendingId` for its `assetId` and removes the rest (refused
mime/size, failed or throwing upload, budget exhausted), at any depth
(lists, tables, callouts, quotes, details); a container left empty gets an
empty paragraph. Removed images add to the extractor's `skippedImages`,
reported as `skipped_images` on `document_imported` and persisted in
`import_jobs.skipped_images` (`markDone`) for a done job. Each upload is raced against what is left
of the upload budget (T9b): one that outlives it is dropped and the
remaining images are not attempted; if it completes later, its asset is
deleted again best effort (it stays an orphan if the function is frozen
first). When the write returns an error, the stored assets are deleted
again with `deleteImportedAssets` (best effort, only logged on failure);
when the write *throws*, the outcome is unknown (it may have committed),
so the assets are kept and the case is logged instead. The "convert" stage timing includes the uploads.

`startPdfImport` also refuses (`DOCUMENT_UNSUPPORTED_FORMAT`) a stored
object whose real mime is not the format its path declares. Only the
message is stored on the job; the kind classifies the Sentry report
(`warning` for `no_text_layer`, `empty_document`, `unsupported_format`).
Telemetry: every terminal transition sends one PostHog event
`document_imported` (`pdf_imported` until T10 renamed it) with
`page_count`, `pages_without_text`, `duration_ms`, `status`
(`done|failed`), `format` (`pdf|docx|pptx`, the job's column) and
`skipped_images` (the job's column; 0 for a failed job).

## Storage and database

- Bucket `page-pdfs` (private, `drizzle/0006_page_pdfs_storage.sql`, mimes
  widened by `0014_document_formats.sql`): 20 MiB per object, accepts
  `application/pdf`, the DOCX mime
  (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
  and the PPTX mime
  (`application/vnd.openxmlformats-officedocument.presentationml.presentation`).
  Objects live under `{ownerId}/{uploadId}.{pdf|docx|pptx}`; RLS lets a user
  read, write and delete only their own folder.
  **Known naming debt:** the bucket (and `SUPABASE_PDF_BUCKET`,
  `PdfStorageGateway`) keep the PDF-era name although they hold every
  imported format; renaming a bucket means moving every object, so it is
  left as is.
- Table `import_jobs` (`0005`, `0014`): one row per import. `format`
  (`pdf|docx|pptx`, CHECK, default `pdf` for rows before 0014, backfilled
  from the path) is taken from the storage path when the job is created;
  `skipped_images` (≥ 0, CHECK) is written by `markDone`. Server-only
  (RLS on, no policies).

## DOCX

`DocxDocumentExtractor` (T6) runs two engines, one after the other
(T9b; in parallel until then), on the same checked package (T0 spike
decision; see "Límites y seguridad"):

- **mammoth 1.13** reads the block structure. Its document model is
  captured with the `transformDocument` hook and mapped node by node
  (`docx-model-mapper.ts`); the HTML mammoth renders afterwards is
  discarded, so there is no HTML parsing.
- **officeparser 8.2** reads what mammoth drops: run colour and shading,
  the list counters (ordered `start`) and OMML equations as LaTeX. Its
  AST is reduced to one enrichment per paragraph (`docx-enrichment.ts`)
  and paired with mammoth's paragraphs in document order by equal text
  with a short lookahead. A paragraph the engines read differently gets
  no enrichment; if officeparser fails, the document imports from mammoth
  alone.

| DOCX construct | Block |
|---|---|
| `Title` style | `heading` 1 |
| `Heading 1`–`Heading 9` (style name or id) | `heading` 1–6 (7–9 → 6) |
| Bold, italic, underline, strike, sub/superscript | marks |
| Monospace run font (Courier New, Consolas, … any "Mono") | `code` mark (alone: Tiptap's code excludes other marks) |
| Run colour (officeparser) | `textStyle.color` `#rrggbb`, except on headings/quotes/code, character-styled runs (links), pure black/white and the document's dominant (Normal style) colour |
| Highlight (mammoth) | `highlight` with the nearest palette name; greys dropped |
| Shading (officeparser) | `textStyle.backgroundColor` (same exclusions) |
| Hyperlink | `link` for http/https/mailto; other schemes and bookmarks keep the text, drop the mark |
| Numbered/bulleted paragraphs | nested `bulletList`/`orderedList` by level; `start` from officeparser's counter |
| Checkbox content control, or a `☐`/`☑`/`☒` prefix | `taskList`/`taskItem` (`checked`), glyph removed |
| Table | `table`; header rows (`tblHeader`) → `tableHeader`; `colspan`/`rowspan`; `colwidth: null`; empty cell → empty paragraph |
| `Code`-like style, or a paragraph whose text is all monospace | one `codeBlock` per run of consecutive paragraphs (newlines and indentation kept, `language: null`) |
| `Quote`/`Intense Quote` style | `blockquote` (consecutive paragraphs grouped) |
| Page break | `horizontalRule` (splits the paragraph) |
| Line break | `hardBreak` |
| Image (png/jpeg/gif/webp, by magic bytes) | `image` block (`pendingId`, `alt` from the DOCX description), splitting the paragraph; an SVG goes through the PNG fallback Word stores next to it |
| Image in another format (EMF, WMF, TIFF, …) | skipped, counted in `skippedImages` |
| Equation in a paragraph with text | `inlineMath` |
| Paragraph holding only equations | one `blockMath` each |
| Equation whose LaTeX does not validate | the LaTeX as plain text |
| Empty or whitespace-only paragraph | dropped |

Not mapped: footnotes/endnotes and comments (mammoth references are
dropped), text boxes and SmartArt, headers/footers, section breaks (only
explicit page breaks), column breaks, paragraph alignment, tracked-change
deletions, `Subtitle` (a plain paragraph).

Equations: officeparser writes a one-character argument without braces
right after a command (`\fracab`, `\sqrty`). `omml-latex.ts` restores them
deterministically (officeparser escapes all document text, so every
`\name` is one of its own commands), then accepts the LaTeX only if braces
balance and every command is one officeparser emits (looked up in a
`Map`, so `Object.prototype` names such as `\constructor` never pass).

`totalPages` is the number of explicit page breaks + 1 (a DOCX stores no
reliable page count); `pagesWithoutText` is always 0. A file mammoth
cannot open (truncated, not a ZIP), or whose model the mapper throws on,
returns `DOCUMENT_UNREADABLE`, which
`processImportJob` maps to `invalid_document`. `large-30p.docx` extracts
in about 0.2 s locally.

`officeparser` is listed in `serverExternalPackages` (`next.config.ts`):
Turbopack breaks its ESM wrapper when bundled. Its optional
`@napi-rs/canvas` (through pdfjs-dist) is not used on the DOCX path.

## PPTX

`PptxDocumentExtractor` (T7) runs officeparser 8.2 alone (T0 spike
decision) on the checked package and maps its AST slide by slide
(`pptx-slide-mapper.ts`). What officeparser does not report is read from
the slide XML first (`domain/pptx-xml.ts`, a linear tag scan, no DOM):
the deck order (the presentation's slide list, the same order
officeparser numbers the slides in), hidden slides, hidden shapes, the
title kind, the bullets a placeholder inherits from the slide master,
table spans and each picture's media part.

| PPTX construct | Block |
|---|---|
| Slide title (`title` placeholder) | `heading` 2 — the page title already names the deck |
| Title slide's centred title (`ctrTitle`) | `heading` 1 |
| Slide without a title but with content | `heading` 2 "Diapositiva N" (N = its place in the deck, hidden slides counted, as PowerPoint numbers it) |
| Body text (text boxes, placeholders, subtitle) | `paragraph`; a line break → `hardBreak` |
| Bold, italic, underline, strike, sub/superscript | marks |
| Monospace run font | `code` mark (alone) |
| Run colour / highlight (`srgbClr`) | `textStyle.color` / `textStyle.backgroundColor` `#rrggbb`, except on titles and links, pure black/white and the deck's dominant body colour (≥ 50 % of the body text) |
| Hyperlink | `link` for http/https/mailto; other schemes and jumps to slides keep the text, drop the mark. The underline PowerPoint draws on hyperlink runs goes with the link |
| Bulleted/numbered paragraphs (own bullet, or a content placeholder's bullet from the master's body style) | nested `bulletList`/`orderedList` by level (`lvl`); a soft break inside an item stays in it |
| Table | `table`; first row → `tableHeader`; `colspan`/`rowspan` from `gridSpan`/`rowSpan`, covered (`hMerge`/`vMerge`) cells left out; `colwidth: null`; empty cell → empty paragraph |
| Picture (png/jpeg/gif/webp, by magic bytes) | `image` (`pendingId`, `alt` from `p:cNvPr@descr`); a picture shown on several slides is one upload |
| Picture in another format, missing or over a cap | skipped, counted in `skippedImages` |
| Equation in a paragraph with text / paragraph of equations only | `inlineMath` / `blockMath` (`omml-latex.ts`), else the LaTeX as text |
| Speaker notes | last block of the slide: `details` (`open: false`) > `detailsSummary` "Notas del orador" + `detailsContent` with the notes' blocks |

Separators: none — each slide opens with its heading, so no
`horizontalRule` is added between slides.

Skipped on purpose: hidden slides (`<p:sld show="0">`, notes included),
hidden shapes (`p:cNvPr hidden="1"`, a hidden group with all its
children) and page furniture (slide number, date, footer and header
placeholders, on slides and notes pages — this is how the slide number
officeparser would read from every notes page disappears). The text of
all of them never reaches the page or the AI (same policy as Word's
`w:vanish`).

Speaker notes and the AI: notes are visible content (the details block
opens), so `extractPlainText` (notebooks) writes them — and the summary
"Notas del orador" — into `plain_text` like any other block; the AI
generates from them too (test: "feeds the speaker notes to the plain
text").

SmartArt: officeparser reads a diagram's text as a nested bulleted list,
which imports as one (the diagram's shapes and layout are lost).

Not mapped: charts (officeparser reads no chart data without
attachments), comments,
slide layouts' own placeholder overrides of the master bullets, a
numbered list's `startAt` (always 1), paragraph alignment, text box
geometry, slide transitions and animations.

Pages: `totalPages` is the number of visible slides; `pagesWithoutText`
the visible slides with no text of their own (title or body; notes not
counted). A slide with no title, body, picture or notes is left out. A
deck with no text anywhere (notes included) gets no "Diapositiva N"
headings either, so `processImportJob` fails it as `empty_document`.

Errors: a package the guard refuses, a ZIP without
`ppt/presentation.xml`, or any officeparser/mapper failure →
`DOCUMENT_UNREADABLE` (`invalid_document`); a cap breach →
`DOCUMENT_LIMIT_EXCEEDED`. `large-40s.pptx` extracts in about 0.05 s
locally.

## PDF

`PdfDocumentExtractor` (T8; unpdf + `textToBlocks` until then) runs
officeparser 8.2 alone, page geometry on, and maps its AST page by page
(`pdf-ast-mapper.ts`). officeparser reads a tagged PDF's structure tree
(headings, lists, tables, footnotes, reading order) and rebuilds what it
can from the geometry of an untagged page (headings by font size, lists,
columns, paragraphs), with each run's font, size, link and box. pdf.js runs
in a separate Node process that officeparser keeps for the next parse
(`separateProcess`), under a 1 GiB heap: a hostile content stream ends that
process (`PDF_PROCESS_FAILED`), not the server, and the abort signal ends
it at once. OCR stays off (T12 undecided).

Which output is used (fallback rule):

1. officeparser's blocks when the AST holds at least one heading, list or
   table anywhere. A `PDF_STRUCT_TREE_UNRELIABLE` warning does not change
   this: officeparser then rebuilt the structure from geometry, as for an
   untagged page, which beats the text heuristics (`untagged.pdf` golden
   test).
2. Otherwise (plain paragraphs only) `textToBlocks` over each page's text —
   a line per baseline, a blank line between officeparser's paragraphs —
   which still finds uppercase or numbered headings and `- `/`1)` lists in
   plain text; the page's images go after its text. This keeps the
   behaviour of plain-text PDFs from before T8 (`pdf-document-extractor.test.ts`,
   the 30-page e2e). There is one path with or without images (T8b):
   `textToBlocks` reads every page on its own (no cross-page rule), so
   converting page by page is byte-identical to one call over the whole
   document.

| PDF construct | Block |
|---|---|
| Heading (tag `H1`–`H6`, or font size on an untagged page) | `heading` at its level (1–6), without the bold of its runs |
| Bold / italic font | `bold` / `italic` |
| Monospace font run (Courier, Consolas, Menlo, JetBrains Mono, … "Mono" as a word of its own — "DejaVuSansMono", not Monotype Corsiva —, subset prefix ignored) | `code` mark (alone) |
| Link annotation | `link` for http/https/mailto; other schemes keep the text, drop the mark |
| List items (flat `indentation` + `itemIndex`) | nested `bulletList`/`orderedList`; ordered `start` = first item's `itemIndex` + 1 |
| Table (tagged) | `table`; header cells → `tableHeader`; no spans; short rows padded with empty cells; `colwidth: null` |
| Paragraph whose runs are all monospace | one `codeBlock` per run of consecutive such paragraphs, a line per baseline, `language: null` |
| Image (png/jpeg/gif/webp by magic bytes) | `image` (`pendingId`, `alt: null`) under `IMAGE_LIMITS` |
| Footnote (tagged `Note`) | paragraphs at the end of its page |
| Running header/footer band | dropped (`ignoreHeadersAndFooters`) |
| Two columns | read in officeparser's order (left column, then right) |

What a PDF loses: underline, strike, colour, highlight and
sub/superscripts (a smaller run read out of order — officeparser sorts by
baseline, so a raised superscript comes before its line — is dropped; one
in order keeps its text without a mark, "H2O"; a paragraph holding only a
short smaller run is dropped); table spans; blockquotes; horizontal rules;
image alt text; leading indentation in code. A word broken at its own
hyphen across lines ("two-" / "column") is joined without it
("twocolumn"): officeparser's `mergeHyphenatedWords` drops a line-end
hyphen before a lowercase continuation; it stays on because syllable
hyphenation is far more common. On untagged pages officeparser may miss a
heading level, turn bullets and tables into paragraphs and misplace a line
around a column break (`expected/tagged.pdf.md`).

Pages: `totalPages` is the PDF's page count; `pagesWithoutText` the pages
whose blocks hold no text (a page officeparser emits no node for counts as
one). If officeparser reports no page count, a document whose last read
page reached the cap is refused as over it (fail closed, T8b). Errors: any
officeparser failure (corrupt — `corrupt.pdf` — encrypted, truncated) →
`DOCUMENT_UNREADABLE` (`invalid_document`), never a document without
text; `PDF_PROCESS_FAILED`, an officeparser limit error or a
`PDF_CONTENT_LIMIT_EXCEEDED` warning → `DOCUMENT_LIMIT_EXCEEDED`
(`pdf-document-extractor.limits.test.ts`, officeparser stubbed); a scanned
page → no text → `no_text_layer`.
`large-30p.pdf` extracts in about 0.2 s locally (pdf.js process start
included).

unpdf was removed in T8: it loads its own pdf.js (6.4) into the server
process and publishes its worker as `globalThis.pdfjsWorker`, which
officeparser (pdf.js 6.2) then takes for a caller-preloaded worker — every
later PDF parse fails on the version mismatch or runs in-process. No module
may import unpdf or pdfjs-dist (`no-in-process-pdfjs`). The build traces
`pdfjs-dist/legacy/build/pdf.worker.mjs` into the page route's output
(`officeparser` stays in `serverExternalPackages`); `next start` was seen
running the pdf.js child process.

Degraded mode (T8b): if the process cannot start (a runtime that cannot
run Node as a child), officeparser warns `PDF_SEPARATE_PROCESS_UNAVAILABLE`
before reading anything. The adapter aborts that parse at once — its
result is never used — and parses again with pdf.js in the server process
(`separateProcess: false`) under `PDF_IN_PROCESS_LIMITS`: 50 pages,
20,000 characters per page, 250,000 in total, and officeparser's
`maxTextItems` 5,000, `maxOperators` 50,000, `maxAnnotations` 2,000
(nothing bounds pdf.js's memory or CPU there, and the abort stops it only
between time slices). A document over them → `DOCUMENT_LIMIT_EXCEEDED`.
Every such parse is reported, never silently: a server log and a Sentry
warning (`reportPdfInProcessParse` in `import-telemetry-adapter.ts`) with
the reason code and caps only — no file name, owner or text. The golden
tests assert the real fixtures never take this path.

Tests run under jsdom (vitest.config.ts), where officeparser takes itself
for a browser; the PDF test files set its `isBrowser` flag back to false,
as Node detects it.

## Límites y seguridad

Import hardening from the 2026-10-26 security audit (T9b). Every cap is a
named constant; a document over one fails as `invalid_document`.

### OOXML packages (zip bombs)

`inspectOoxmlPackage` (`domain/ooxml-guard.ts`, pure, over the central
directory parser in `domain/zip-directory.ts` that format detection
shares) reads the directory before any parser runs and refuses the file
when it cannot be trusted — no readable directory, encrypted or zip64
entries, a method other than stored/deflate, duplicate names, data
outside the archive (`DOCUMENT_UNREADABLE`) — or declares too much
(`DOCUMENT_LIMIT_EXCEEDED`):

| `OOXML_LIMITS` | Value |
|---|---|
| `maxEntries` | 2,000 entries |
| `maxPartBytes` | 50 MiB declared per part (media included) |
| `maxTotalBytes` | 150 MiB declared for all parts together |
| `maxRatio` / `ratioMinBytes` | 200:1 for any entry of 1 MiB or more |
| `maxImageBytes` | 10 MiB per image (larger ones are skipped, see Images) |
| `maxXmlElements` | 1,000,000 XML elements across the parts read |
| `maxXmlDepth` | 256 levels of XML nesting in one part |

Declared sizes can lie, so neither engine inflates anything itself.
`OoxmlPackage` (`infrastructure/ooxml-package.ts`) inflates each part
lazily with `node:zlib`'s `inflateRawSync({ maxOutputLength })` at its
declared size (a stream that holds more throws instead of allocating it)
and counts the inflated total; XML parts are also counted (elements,
nesting) before a parser gets them. mammoth reads through the package's
zip-file object (`mammoth.convertToHtml({ file })`; mammoth 1.13's
`openZip` accepts a ready zip file besides a buffer), so its JSZip never
inflates; officeparser parses a rebuilt stored archive of the XML parts
only, with `decompressionLimits` (`maxUncompressedBytes`,
`maxZipEntries`, `maxXmlElements`) at the same caps as a second fence.
No new dependency: `fflate` was not needed. The engines run sequentially
so their peaks never add up. PPTX (T7) goes through the same package:
officeparser parses `xmlArchive()` with the same `decompressionLimits`,
never reads a media part itself (`extractAttachments: false`), and any
officeparser limit error fails the import as `DOCUMENT_LIMIT_EXCEEDED`. officeparser's enrichment (colours, list
starts, equations) is optional — any other officeparser failure imports
from mammoth alone — but a limit breach on its path (a part only
`xmlArchive()` reads, or officeparser's own `ZIP_*`/`XML_ELEMENT_*`/
`MAX_NESTING_DEPTH_EXCEEDED`/`OUTPUT_TOO_LARGE` errors) fails the import as
`DOCUMENT_LIMIT_EXCEEDED` (T10). A part refused by the element or nesting
check is refused on every later read too. `processImportJob` reports a limit breach
with `DOCUMENT_LIMIT_EXCEEDED_MESSAGE` ("Este documento es demasiado
grande o complejo para importarlo. …").

### Time and CPU bound

Chosen bound: deterministic caps plus a budget race, not a
`worker_thread`. A worker would give a hard kill, but it needs a separate
entry file traced into the Next 16 server output (with mammoth bundled
and officeparser external) and per-call worker start-up; the caps below
bound the worst case without that.

- `processImportJob` races `extractor.extract` against what is left of
  `PROCESSING_BUDGET_MS`; when the budget wins the job fails as
  `timeout` and the extractor's `AbortSignal` is aborted. Adapters check
  the signal between their steps (before and after the PDF parse, which
  also gets it; before mammoth, before officeparser, before mapping).
- PDF (`PDF_LIMITS`, `pdf-document-extractor.ts`): officeparser reads at
  most 300 pages (`pageRange`) and a document with more is refused once
  its page count is known (up to 300 pages are parsed before the refusal:
  officeparser cannot stop at the count alone); a page with more than
  100,000 characters, or 2,000,000 in total, is refused after the parse.
  officeparser's own content limits bound the parse: `maxTextItems`,
  `maxOperators`, `maxAnnotations` (defaults), 5 s + 20 ms/KB of CPU in its
  pdf.js process (`maxTimeMs`) and a 1 GiB heap there
  (`processMemoryMb`); a partly read document
  (`PDF_CONTENT_LIMIT_EXCEEDED`) or an out-of-memory process
  (`PDF_PROCESS_FAILED`) is `DOCUMENT_LIMIT_EXCEEDED`. The signal is
  handed to officeparser, which checks it between pages and ends the pdf.js
  process at once.
- DOCX: the OOXML caps above bound the XML mammoth and officeparser
  parse (size, elements, nesting); tables nested more than
  `MAX_TABLE_NESTING` (16) levels are refused by the mapper.
- PPTX: the same OOXML caps; the signal is checked before and after
  officeparser and handed to it as `abortSignal` (it checks it per
  slide).

Residual risk: OOXML parsing is synchronous (xmldom for a whole part), so
the race cannot interrupt it (a PDF's pdf.js runs in its own process, which
the abort ends; only the mapping after it runs here); a single page or part
within the caps can still run past the budget, after which the result is
discarded. The platform's `maxDuration` (120 s) remains the hard ceiling,
and `getImportJobStatus`'s abandoned-job rule still resolves a job the
platform killed.

### Rate limits

Per user (`domain/import-rate-limiter.ts`), refused with
`INGESTION_RATE_LIMITED` ("Llegaste al límite de importaciones por ahora.
Intenta de nuevo más tarde."):

| Limit | Where | Value |
|---|---|---|
| `UPLOAD_GRANTS_PER_HOUR` | `requestPdfUpload`, after validation, before Storage | 20 per hour |
| `IMPORT_STARTS_PER_HOUR` | `startPdfImport`, new imports only, consumed after the stored object passed the metadata/mime/size checks and right before the page is created (an idempotent repeat or a refused object consumes nothing) | 10 per hour |
| `MAX_ACTIVE_IMPORTS` | `startPdfImport`: an early `countActiveJobs` (abandoned jobs excluded) before any page exists, then enforced atomically by `ImportJobRepository.create(job, { maxActiveJobs })` — Drizzle counts and inserts in one transaction under a per-owner `pg_advisory_xact_lock`, so concurrent starts never exceed it (a start that loses that race leaves its empty page, like the storage-path race). The storage path is checked before the cap at both points (T11): a concurrent repeat of the same upload replays its job instead of being refused | 3 queued/processing |

`processPdfImport` needs no limit of its own: it only processes a queued
job of the caller, created by a limited start. The limiters come from
`src/shared/rate-limit` (`createRateLimiter`), composed in `actions.ts`
with the AI layer's configuration and no new variable:
`AI_PROVIDER_MODE=live` → Upstash sliding window under
`{REDIS_KEY_PREFIX}:rl:import-upload|import-start`
(`UPSTASH_REDIS_REST_URL`/`TOKEN`); otherwise (fake mode: CI, e2e, local)
an in-memory fixed window shared by the server process. Upstash errors
fail open (logged): the database cap on active imports still holds.

### Hidden and invisible text

Text the user never sees must not reach the AI (imported content feeds
`plain_text`, the AI paragraph split and generation):

- DOCX runs Word hides — `w:vanish` or `w:specVanish` on the run, or on
  its character style or paragraph style (`basedOn` followed), unless
  turned off with `w:val="0|false|off"` — are cut from
  `word/document.xml` (`domain/ooxml-hidden-text.ts`) before mammoth and
  officeparser read it; mammoth 1.13 ignores both properties. Not
  resolved: `docDefaults`, table/numbering styles. Tracked formatting
  changes (`w:rPrChange`) are ignored on purpose.
- PPTX: hidden slides, hidden shapes and page-furniture placeholders are
  skipped or cut before officeparser reads the slide (see "PPTX").
- Image alt text (≤ 2000 characters, from the DOCX/PPTX description) stays on
  the image node for accessibility, but `extractPlainText` (notebooks)
  writes an image's caption only, never its alt.

### Images

The DOCX, PPTX and PDF mappers (`IMAGE_LIMITS`, `domain/image-mime.ts`) read embedded
images one at a time, never more than 100 per document; an image over
10 MiB (refused by `OoxmlPackage` from its declared size, before
inflating, and checked again once read) is skipped and counted — the rest
of the document still imports (regression tests in
`docx-document-extractor.limits.test.ts` and
`pptx-document-extractor.variants.test.ts`) — and once the images
read reach 40 MiB in total the rest are not read. Every image not kept
counts in `skippedImages`. PDF images differ: officeparser decodes every
page image itself (at most 40 megapixels each) and hands them over as PNG
in base64; the mapper decodes one at a time, never one whose encoded size
is already over 10 MiB, under the same caps. Residual risk: officeparser
holds all of a document's images in memory at once before the caps apply.

### File names and import status

- `pageTitleFromFileName` drops control (`\p{Cc}`) and format
  (`\p{Cf}`: bidi overrides/isolates U+202A–U+202E and U+2066–U+2069,
  zero-width characters, BOM, soft hyphen) characters before collapsing
  whitespace — whitespace controls (tab, LF, VT, FF, CR, NEL U+0085) become
  a space, the BOM U+FEFF is removed — so a title cannot
  spoof another name (`factura\u202Efdp.docx`) or hide text.
- `getImportJobStatus` looks the job up by (pageId, ownerId) and answers
  `ok(null)` for another user's page, exactly like a page without
  imports, so it is no existence oracle (it returned `IMPORT_JOB_NOT_FOUND`
  for a foreign page until T9b).

## Job lifecycle

```
queued --claim()--> processing --markDone()--> done
                                --markFailed()--> failed
queued --markFailed(timeout)--> failed   (Server Action ran out of budget before claiming)
```

`queued`/`processing`/`done`/`failed` is the full set (`IMPORT_JOB_STATUS`).
There is no lease column: a non-terminal job that goes longer than
`ABANDONED_AFTER_MS` (`MAX_DURATION_S + 30` seconds) without an
`updated_at` write is swept purely by age. `getImportJobStatus` reports
such a job as `failed(timeout)` to the caller without ever writing that
state itself — only a later `processPdfImport` call is allowed to persist
a terminal transition, so a job the platform actually killed mid-flight
still eventually resolves once someone reopens the page.

Idempotency is keyed by `storagePath` (a `UNIQUE` constraint since T1):
`startPdfImport` called twice for the same upload returns the existing job
instead of creating a second page/job pair, and a repeated
`processPdfImport` on a non-`queued` job is a no-op (`ok(job)`, no
download, no write, no second `document_imported`).

## `maxDuration`

`processPdfImport` runs `processImportJob` synchronously inside the same
Vercel function invocation (Fluid Compute; ADR 0003 — no worker, no
Trigger.dev). Next.js applies a Server Action's `maxDuration` from the page
segment it is invoked from, not from the module that defines the action:
`processPdfImport` is only ever invoked from
`src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`, which
exports `export const maxDuration = 120;` — a literal (route segment
config must be statically analyzable at build time), pinned equal to
`MAX_DURATION_S` by `max-duration.test.ts`. `processImportJob`'s own
internal budget (`PROCESSING_BUDGET_MS`, 100 s) stays well under that
ceiling so there is always time left to persist a `failed` state and
respond even when the platform never interrupts the call. No other route
segment changes its `maxDuration`; `startPdfImport` is fast and keeps the
platform default wherever it is invoked from.

**Requires Fluid Compute enabled on the Vercel project** (Settings →
Functions) — without it, the Hobby plan's ceiling is lower and
`maxDuration = 120` is not honored.

## Environment

- `SUPABASE_PDF_BUCKET` (server-only, required, no default): the name of
  the private Storage bucket for imported documents (PDF, DOCX and PPTX;
  the PDF-era name is kept, see "Storage and database"). Validated at boot by
  `serverEnv()` (`src/shared/config/env.schema.ts`) — a deploy without it
  fails loudly instead of silently pointing at the wrong bucket.

## Tests

- `pnpm test -- ingestion` — unit tests (Vitest): `domain`, `application`
  (against the in-memory fakes), `infrastructure` adapters (against mocked
  clients, or real parsers for the document extractors: the DOCX and PPTX
  golden tests read `tests/fixtures/documents/files/all-constructs.docx`
  and `all-constructs.pptx`, the PDF golden tests `tagged.pdf`,
  `untagged.pdf`, `corrupt.pdf`, `scanned.pdf` and `large-30p.pdf`) and
  `actions.ts` (against mocked adapters + session, matching
  `notebooks/actions.test.ts`'s pattern). No `DATABASE_URL` or
  `SUPABASE_PDF_BUCKET` needed.
- `pnpm test:db` — DB smoke tests against `cogni-dev`: the shared
  repository contract run through `DrizzleImportJobRepository`, plus the
  `import_jobs` table/bucket migration proofs.
