# Design-system atoms

Reusable, shadcn-style building blocks under `src/shared/ui/`. All classNames
are forwardable (`cn()` merge) and every visual variant reproduces an
existing screen exactly — this pass is refactor-only, zero visual change.

## Card (`card.tsx`)

Surface box: `rounded-xl border`.

- `tone`: `default` (border-subtle, bg-card, shadow-xs) · `subtle` (bg-neutral-50)
  · `success` · `error` · `achievement` (gradient) — only `default` is
  currently consumed; the rest exist as documented API surface.
- `padding`: `none | sm(16px) | md(20px) | lg(24px)`. A non-standard padding
  (the former Home StatCard's 18px) stays `padding="none"` + a `className` override.
- `interactive`: adds the hover lift (`-translate-y-0.5` + `shadow-card-hover`).
- `asChild` (radix Slot, same pattern as `Button`): renders the styling onto
  the single child instead of a `div` — used to keep `<article>`/`<Link>`
  semantics.
- Slots: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
  `CardFooter` (shadcn-style, available for future composition).

Used by: `stat-card.tsx`, `home/ready-to-review.tsx`, `home/recent-pages.tsx`,
`notebooks/[notebookId]/page.tsx` (its list-view wrapper; the grid's page
cards are `PageSheetCard` since Phase 8 H5-T1).

## IconTile (`icon-tile.tsx`)

The pastel/semantic square behind notebook, stat and empty-state icons.

- `size`: literal pixel keys (`"28" | "30" | "36" | "40" | "44" | "48" |
  "52" | "56"`) — the real screens use distinct sizes, not a clean 5-step
  scale, so the key is the exact px value instead of an idealized
  sm/md/lg/xl/2xl. `"48"` was added for the Flashcards design preview's
  `DeckSummaryCard` header tile (studyplatform-flashcards-style.md §4).
- `radius`: `md(8px) | input(10px) | tile(14px) | xl(16px) | full` — independent of
  `size` (size 36 ships with both `md` and `input` radius on different screens).
- `tone`: notebook pastel pairs (`purple | pink | green | yellow | orange |
  blue | mint`, matching `NotebookColor`) plus semantic tones (`primary |
  neutral | success | warning | error | info`).

`notebookToneFromColor(color)` (in `_components/notebook-swatches.ts`) maps a
`NotebookColor | null` straight onto an `IconTile` tone, falling back to
`"purple"` for legacy notebooks without a stored color.

Used by: `home/stat-card.tsx`,
`home/ready-to-review.tsx`, `home/weak-topics.tsx`, `app/(app)/page.tsx`,
`notebooks/[notebookId]/page.tsx` (no longer: its header badge is a
`PageSheet` since Phase 8 H5-T1 and its empty state an
`IllustratedEmptyState` with a `PageSheetFan` since H5-T4),
`modules/notebooks/ui/create-notebook-trigger.tsx`.

## Pill (`pill.tsx`)

Small rounded-full label (status/count/"pronto" indicators).

- `size`: `sm(10.5px) | md(11.5px)`.
- `tone`: `neutral | muted` + the same pastel/semantic tones as `IconTile`,
  plus `rose` (2026-09-24, exams "preguntas" screen: `bg-rose-500/10
  text-rose-600` — no `--color-rose-100` token exists, so this reuses the
  existing `rose-500` theme color with an opacity modifier, same pattern
  `status-banner.tsx`'s `rose` tone border already uses).
- `dot`: optional leading `currentColor` dot. `icon`: optional leading node.

Used by: `nav-item.tsx` (disabled row's "pronto" badge),
`app/(app)/page.tsx` ("Repasos pendientes hoy" stat's "pronto" action).

## SectionHeader / SectionTitle (`section-header.tsx`)

- `SectionHeader`: page-level head — `eyebrow` (11px uppercase overline),
  `title` (24px/700 by default, override via `titleClassName`),
  `description`, `actions` (right-aligned), optional leading `icon`.
  `description` may be a list of strings: one line of phrases joined by
  6px `primary-300` dots (`data-part="separator"`, `aria-hidden`), wrapping
  on narrow columns. `leadingClassName` overrides the icon + text row
  (default `gap-3`). Phase 8 H4-T4: the notebooks hub passes a small
  `NotebookCover` as `icon` with `gap-4`, a 32px tight-tracked
  `text-gradient-brand` title and `["Tus materias, organizadas", count]`.
- `SectionTitle`: in-card section heading — 14px/600 by default; passing
  `action` switches it to 16px/600 with a right-aligned link/action row.

Used by: `home/home-header.tsx`, `notebooks/page.tsx`,
`notebooks/[notebookId]/page.tsx` (`SectionHeader`; since Phase 8 H5-T1 the
hub's line: a `PageSheet` `sm` badge, the 32px `text-gradient-brand` title
and a "Cuaderno · N páginas" dot list, no eyebrow); `home/ready-to-review.tsx`,
`home/recent-pages.tsx`, `app/(app)/page.tsx` ("Mis cuadernos") (`SectionTitle`).

Not used by `page-header.tsx` (the editor page title): its title+meta-row
anatomy (gap-based stacking, a `Clock` icon inline with the timestamp, an
autosave status slot) doesn't map onto SectionHeader's eyebrow/title/
description/actions shape without restructuring it — left as-is.

## ProgressBar (`progress-bar.tsx`)

Thin rounded-pill track + fill. `value` (0-100, clamped; non-finite counts as
0), `fillClassName` (e.g. `"gradient-streak"`). The fill width is set through
an inline `style`. The track exposes `role="progressbar"` with
`aria-valuenow` (clamped) / `aria-valuemin=0` / `aria-valuemax=100`; a name
is required whenever the bar is not decorative (axe `aria-progressbar-name`):
pass `aria-label`, or `aria-labelledby` pointing at a visible label (the former
Home StatCard used `useId` + the stat's label). Only a purely decorative bar may opt out with
`role="presentation" aria-hidden`. `data-slot="progress-bar"`/`"progress-fill"`
are unchanged so existing test queries still work.

Used by: `home/stat-card.tsx`.

## EmptyState (`empty-state.tsx`)

Centered icon + title + copy + optional action, in one of four framings
actually shipped: `plain` (full-page body), `dashed` (create-first-X
prompts), `tinted` (permanent placeholder panel), `success` (green "all
caught up" panel). `icon` is a pre-built node (usually an `IconTile`) — this
atom only lays it out. `fill` adds `flex-1`; `as`/`titleAs` pick the root/
title element tag.

Used by: `home/home-empty-state.tsx` (zero-notebooks Home, `plain`, Phase 8
H2-T3), `home/ready-to-review.tsx` (`success`), `home/weak-topics.tsx`
(`tinted`). The notebook page's zero-pages `dashed` state became an
`IllustratedEmptyState` in Phase 8 H5-T4.

## FeaturePreviewCard (`feature-preview-card.tsx`)

Phase 8 H2-T3. A dashed, text-only box that previews a section the user
will see once there is data (Home empty state, "Lo que verás aquí"). It is
static on purpose: no link, no button, no skeleton shimmer, so it never
reads as clickable or loading.

- `icon` (pre-built node; Home passes a neutral `IconTile` 36 with an 18px
  / 1.75 stroke lucide icon), optional `adornment` at the right of the icon
  row (Home: the technique-colour dots `warning-500` / `success-500` /
  `rose-500` of the techniques that feed the section), `title` (an `h3`,
  15px medium), `description` (14px `text-fg-muted`), `className?`.
- Style: `rounded-xl` (16px), 1px dashed `neutral-300` border, `bg-card`
  (so a backdrop never shows through), `px-5 py-4`, `h-full` so the boxes
  in a grid row share one height.

Used by: `home/home-empty-state.tsx` (three boxes: Para hoy, Continúa donde
lo dejaste, Temas débiles; dots on Para hoy (3) and Temas débiles (2)).

`CreateNotebookTrigger` (notebooks module) also gained a `hero` variant for
the same screen: the large `rounded-pill` primary `Button` with a custom
`label` ("Crea tu primer cuaderno") and a `tourId` that becomes its
`data-tour` anchor for the product tour. Phase 8 H4-T1 added a `cta`
variant for the notebooks hub empty state: the same dialog behind a large
`rounded-pill` violet `Button` (`primary-600`, hover `primary-700`, 15px
semibold, soft violet shadow `0 6px 18px -6px rgb(124 58 237 / .55)`) with
no plus icon and a custom `label` ("Crear mi primer cuaderno").

## TechniqueFan (`technique-fan.tsx`)

Phase 8 Home empty state hero, client. The three study techniques as mini
cards fanned like a hand of flashcards behind a mini notebook, so an empty
screen still says what Cogni does. Decorative only: `aria-hidden`, no text,
no data.

- Props: `techniques` (`("flashcards" | "recall" | "exams")[]`, left to right —
  keys, not icon components, because a server parent cannot pass
  components to this client atom), `className?`. Footprint 300×150.
- Each card: 92×112, `rounded-[14px]`, white, hairline `border-default`,
  layered shadow (tight contact `0 1px 2px` + soft offset ambient
  `0 8px 20px -8px`, no glow), a 20px pastel chip with the lucide icon
  (12px / 1.75 stroke, pair from `TECHNIQUE_PAIR_CLASS`) and a miniature
  of the technique's screen: Flashcards a card front (question lines +
  `pastel-yellow` "Ver respuesta" pill), Recordación activa a prompt plus
  an answer in a `pastel-mint` box, Exámenes three options with the middle
  one chosen in `pastel-pink`. Cards carry `data-technique`.
- Pose (`fanPose`): ±8deg outer tilt, ±80px spread, outer cards 10px lower,
  middle lifted 4px; pivot at each card's bottom. `fanPose(index, count,
  shape?)` and `fanStack(shape?)` take an optional `FanShape` (`tiltDeg`,
  `spreadPx`, `outerDropPx`, `middleLiftPx`; Phase 8 H4-T3) so
  `NotebookFan` reuses the same geometry and `fanTransition`.
- Front: a built-in mini notebook (`data-part="notebook"`, 72×76, rounded
  8px at the spine and 14px at the fore edge, same white/border/shadow as
  the cards) with a `primary-100` spine carrying three punched ring holes,
  a `primary-200` title stroke and a soft "+" chip (`primary-50` fill,
  `primary-200` border, `primary-600` `Plus`). Violet only in the spine and
  the chip. Static and not interactive: the real action is the CTA under
  the title. It replaced the former `center` slot (the violet
  `IconTile` 56 with `BookPlus`).
- Motion (`fanTransition`): once on mount the cards settle from a squared
  stack into the fan — spring, no bounce, `visualDuration` 0.36s, 40ms
  stagger, all done within 0.5s — and keep a stable transform. Under
  `prefers-reduced-motion` the transition is zero-duration; `initial`
  never changes, so server markup and hydration match.

Used by: `home/home-empty-state.tsx`.

## NotebookFan (`notebook-fan.tsx`)

Phase 8 H4-T3 hero of the notebooks hub's empty state, client (user
decision 2026-10-20: option D, palette 1 "Técnicas vivas"). Three closed
notebooks fanned on a 560×236 stage: "Historia" / "18 páginas" on the left
(−9deg, 150px out), "Biología" / "9 páginas" on the right (+9deg), both
166×208 and 10px lower, and an upright, larger (180×226) "Nueva materia" /
"Tu primer cuaderno" in front, raised 2px, rendered last with `z-10`.
Decorative only: `aria-hidden`, the names are sample decoration, not data;
no buttons, links or images.

- Props: `className?`.
- Each book (`data-part="fan-notebook"`, `data-notebook="left" | "right" |
  "front"`) is a large `NotebookCover` (see below) carrying the name
  (13px semibold; 15px in front) over a 10.5px meta line, and a 26px icon
  tile bottom-left (lucide 15px / 1.75 stroke).
- Palette: left `amber-200` → `amber-400`, `warning-500` border, white
  tile with a `warning-700` `Layers`, white ribbon; right `emerald-200` →
  `emerald-400`, `success-500` border, white tile with a `success-700`
  `Brain`, white ribbon; front `primary-500` → `primary-700`, white text
  (meta `white/75`), a translucent white tile with `Plus` and a
  `technique-flashcards-accent` ribbon.
- Motion: `TechniqueFan`'s helpers with the notebook `FanShape` — once on
  mount the books settle from a squared stack into the fan (spring, no
  bounce, staggered, done within 0.5s). Under `prefers-reduced-motion`
  only the transition is zero-duration; `initial` never changes.
- Responsive: the root is a size container; the stage scales in steps
  with its own column (0.22 under 210px, 0.4, 0.56 from 300px, 0.75 from
  420px, 1 from 560px) and the box height follows, so it never overflows
  even when the sidebar takes the width.

Used by: `notebooks/page.tsx` (through `IllustratedEmptyState`'s `art`).

## NotebookCover (`notebook-cover.tsx`)

Phase 8 H4-T4 (user decision 2026-10-20), extracted from `NotebookFan` so
the fan's books and the notebooks hub header's badge are one drawing. A
closed notebook seen from the front, decorative (`aria-hidden`,
`data-slot="notebook-cover"`): page-edge thickness from two layers offset
behind the cover (a striped `neutral-0`/`neutral-150` page block and a
`neutral-50` back cover, hairline `border-default`, `data-part="pages"`),
a 160deg gradient cover (`data-part="cover"`) with a `black/7` spine strip
(`data-part="spine"`) and a notched bookmark ribbon (`data-part="ribbon"`,
clip-path) near the top-right.

- Props: `size?` (`"lg"` default | `"sm"`), `cover?` (border + gradient
  stops, default `border-primary-700 from-primary-500 to-primary-700`),
  `ribbon?` (default `bg-technique-flashcards-accent`), `className?`,
  `children?` (printed on the cover).
- `lg`: fills its parent (`size-full`); layers offset 8px / 4px, radius
  `8px 16px 16px 8px`, 14px spine, 14×46 ribbon 26px from the edge;
  depth `0 1px 2px` contact + `0 12px 28px -12px` ambient, no glow.
- `sm`: a fixed 58×70 badge (52×64 cover); layers offset 6px / 3px,
  radius `5px 11px 11px 5px`, 8px spine, 8×22 ribbon 9px from the edge;
  depth `0 1px 2px` contact + a violet-tinted `0 10px 20px -10px` ambient.
  No icon or "+" on it (user correction 2026-10-20).

Used by: `notebook-fan.tsx` (all three books, `lg`), `notebook-cover-card.tsx`
(`lg`), `notebooks/page.tsx` (the header badge, `sm`, through
`SectionHeader`'s `icon`).

## NotebookCoverCard (`notebook-cover-card.tsx`)

Phase 8 H4-T5 (user request 2026-10-28, layout corrections the same day):
one notebook of the notebooks hub grid, drawn as the empty state's closed
notebook instead of a flat card. An `article` (`data-slot=
"notebook-cover-card"`, `data-tone`) in book proportion (`aspect-[4/5]`,
fills its grid cell) holding a large `NotebookCover` (decorative,
`aria-hidden`) and, laid over the cover face (100% − the 8px page edge,
left padding clearing the spine), the readable content:

- Top-left: the page count as plain meta text ("1 página" / "12 páginas",
  `data-part="page-count"`), 11px medium in the tone's meta colour. No
  icon, glyph, badge or tile (user correction 2026-10-28).
- Middle: the title, the stretched `Link` to the notebook (its
  `after:inset-0` covers the whole book, so the accessible name is the
  full title), centred, 15px semibold, `text-balance`, `line-clamp-3`.
  Focus ring on the stretched overlay (`ring-3 ring-ring/50`).
- Bottom row: only the date label (same meta style) and the `actions`
  slot (`relative z-10`, above the stretched link, outside it).
- Props: `href`, `title`, `pageCount`, `dateLabel?`, `tone?`
  (`NotebookCoverTone`, the notebooks pastel keys; null → `purple`),
  `actions?`, `className?`.
- Tones, in the fan's language (200 → 400 gradient, darker border, white
  ribbon, `neutral-900` title, `black/55` meta): pink `pink-*`, green the
  fan's emerald/`success-500`, yellow the fan's amber/`warning-500`, orange
  `orange-*`, blue `blue-*`, mint `teal-*`; purple is the fan's violet
  "new notebook" (`primary-500` → `primary-700`, flashcards-yellow ribbon,
  white title, `white/75` meta).
- Motion: on hover the book lifts 4px and tilts −0.6deg (200ms,
  `cubic-bezier(0.23,1,0.32,1)`, transform only), presses to 0.98; under
  `prefers-reduced-motion` it never moves.
- Below 150px wide (container query on the book: the sidebar may eat the
  column) only a smaller 11px title and the actions remain.
- From 280px wide the type scales up: title 20px (`text-xl`), page count
  and date 13px, more inner padding. The create tile follows the same
  step (56px disc, 18px label, 13px hint).

Used by: `notebooks/page.tsx` (the hub's only view since H4-T6; explicit
columns on the grid's own width, `@container/grid`, capped at five, user "5 por fila"
2026-10-28: 1 below 300px, 2 from 300, 3 from 540, 4 from 680, 5 from
960 — 5 at 1440 and 4 at 1024 with the sidebar open; wider screens grow
the covers, never add columns; `NotebookCardActions` as `actions`,
`formatTimeAgo(updatedAt)` as `dateLabel`, the last update by user
decision 2026-10-28).

The grid's `CreateNotebookTrigger` `tile` (notebooks module, H4-T5 redesign
2026-10-28; always the grid's FIRST item since Phase 8 H5-T2, user
2026-10-29, so many notebooks never push it down) shares the book proportion: a cover-sized face (cell − 8px)
with the same radius, `primary-50` fill and a 2px dashed `primary-300`
border, a 48px `primary-600` plus disc (white `Plus`, soft violet
shadow), "Nuevo cuaderno" in `primary-700` semibold and the hint "Crea un
cuaderno para una materia" (`primary-600/80`). Hover lifts 4px and
deepens to `primary-100` / `primary-400`, press 0.98, none under reduced
motion; below 150px the hint hides and the disc shrinks to 32px. Accessible
name stays "Nuevo cuaderno".

## PageSheet (`page-sheet.tsx`)

Phase 8 H5-T1 (user request 2026-10-29), the sibling of `NotebookCover`:
one page of a notebook as a paper sheet, decorative (`aria-hidden`,
`data-slot="page-sheet"`, `data-tone`). Two sheets stacked behind
(`data-part="stack"`, `neutral-100` and `neutral-50`, hairline
`border-default`, offset 8px / 4px), a `bg-card` face (`data-part="face"`)
with its top-right corner cut by a clip-path and a folded corner
(`data-part="fold"`, `neutral-100` triangle with a crease hairline), an
index tab on the top edge (`data-part="tab"`) and a margin rule
(`data-part="margin"`) in the notebook's colour. Depth is two
`drop-shadow`s (they follow the clipped outline), no glow.

- Props: `size?` (`"lg"` default | `"sm"`), `tone?` (`NotebookCoverTone`;
  null → `purple`), `className?`.
- Tones: the 400 step of the hub covers' gradients — pink `pink-400`, green
  `emerald-400`, yellow `amber-400`, purple `primary-500`, orange
  `orange-400`, blue `blue-400`, mint `teal-400`; the margin rule at `/45`.
- `lg`: fills its parent; 10px radius, 22px fold, 48×6 tab 20px in, margin
  rule 18px in (hidden below 150px wide, a container query on the sheet);
  ruled paper — a `neutral-100` hairline every 22px from 36px down,
  stopping 56px short of the bottom so the date row stays clean.
- `sm`: the fixed 58×70 header badge (the same box as the hub's
  `NotebookCover` badge); 6px radius, 12px fold, 20×4 tab and three short
  `neutral-200` rules (`data-part="rule"`) so it reads as a page.

Used by: `page-sheet-card.tsx` (`lg`), `notebooks/[notebookId]/page.tsx`
(the header badge, `sm`, tinted by the notebook's colour, through
`SectionHeader`'s `icon`).

## PageSheetFan (`page-sheet-fan.tsx`)

Phase 8 H5-T4 (user request 2026-10-29): the empty notebook's hero, the
pages' sibling of `NotebookFan`. Three `PageSheet`s (`lg`) in the
notebook's colour (null → violet), fanned with `TechniqueFan`'s
`fanPose`/`fanStack`/`fanTransition` (±7deg, 104px out, outer 8px lower,
front raised 4px; outer 134×168, front 150×188 on top). The front sheet
reads "Tu primera página" (12px semibold) with a 2px `primary-500` caret
that pulses (`motion-safe:animate-pulse`, still under reduced motion). The
400×196 stage scales in container-query steps (0.25 → 0.45 @180 → 0.6
@220 → 0.8 @300 → 1 @400), so it never overflows a narrow column.
Decorative (`aria-hidden`, `data-slot="page-sheet-fan"`,
`data-part="fan-sheet"`, `data-sheet`). Props: `tone?`, `className?`.

Used by: `notebooks/[notebookId]/page.tsx` (the zero-pages
`IllustratedEmptyState` `art`).

## PageSheetCard (`page-sheet-card.tsx`)

Phase 8 H5-T1 (user request 2026-10-29): one page of the notebook page's
grid as a paper sheet, in the family of `NotebookCoverCard`. An `article`
(`data-slot="page-sheet-card"`, `data-tone`) in `aspect-[4/5]` (the covers'
proportion, so both grids share row rhythm) holding a large `PageSheet` and,
laid over its face, the readable content:

- Top corner (optional `meta`): plain 11px medium `fg-muted` text
  (`data-part="meta"`). Not used yet.
- The title: the stretched `Link` to the page (`after:inset-0`, accessible
  name = full title, focus ring `ring-3 ring-ring/50` on the overlay), 15px
  semibold `fg`, 22px lines that sit on the sheet's rules, `wrap-anywhere`,
  `line-clamp-4`; it keeps clear of the folded corner.
- Bottom row: the date (11px medium `fg-muted`, `datePrefix` such as
  "Actualizada" shown only from 190px wide so the date never truncates)
  and the `actions` slot (`relative z-10`, above the link, never inside it).
- Props: `href`, `title`, `dateLabel?`, `datePrefix?`, `meta?`, `tone?`,
  `actions?`, `className?`.
- Motion: hover lifts 4px and tilts 0.4deg (200ms,
  `cubic-bezier(0.23,1,0.32,1)`, transform only), press 0.98; never moves
  under `prefers-reduced-motion`.
- Below 150px wide only an 11px three-line title and the actions remain;
  from 280px the title is 18px and the dates 13px.

Used by: `notebooks/[notebookId]/page.tsx` (the grid view, on the hub's
`@container/grid` columns: 1 → 2 @300 → 3 @540 → 4 @680 → 5 @960, never
more; `formatUpdatedAt(updatedAt)` as `dateLabel`, "Actualizada" as
`datePrefix`, `ArchivePageButton` as `actions`, the notebook's colour as
`tone`).

## PageSheetCreateTile (`page-sheet-create-tile.tsx`)

Phase 8 H5-T2 (user request 2026-10-29): the notebook page's create
control, always the FIRST item of the sheet grid. A `button`
(`data-slot="page-sheet-create-tile"`, accessible name = `label`) the size
of a `PageSheetCard` (`aspect-[4/5]`, a face the cell minus the 8px stack,
10px radius) in the hub create tile's violet language: `primary-50` fill,
2px dashed `primary-300` border, a `primary-600` plus disc with a soft
violet shadow, the label in `primary-700` semibold and the hint in
`primary-600/80` (hidden below 150px). Hover lifts 4px and deepens to
`primary-100` / `primary-400`, press 0.98, none under reduced motion; the
same 150px / 280px container steps as the hub tile.

- Props: `label`, `hint?`, plus any `button` attribute (`type` defaults to
  `"button"`; the page passes `"submit"` inside its create form).

Used by: `notebooks/[notebookId]/page.tsx` (grid view, "Nueva página" /
"Escribe o importa un apunte"; the header has no create button since H5-T2).
Since H5-T3 it is a plain `button` that opens `NewPageDialog`, which asks
how to create the page.

## PageStripRow (`page-strip.tsx`)

Phase 8 H5-T2 (user request 2026-10-29): one page of the notebook page's
list view as a thin paper strip, the row version of `PageSheetCard`. An
`article` (`data-slot="page-strip-row"`, `data-tone`), 56px tall, 10px
radius, `bg-card`, a hairline `border-default` and a `0 1px 2px` contact
shadow. Decorative (`aria-hidden`): a 4×32 index tab on the left edge
(`data-part="tab"`) and a margin rule 20px in (`data-part="margin"`), both
in `PAGE_SHEET_TONES` (shared with `PageSheet`), and a `neutral-100` ruled
baseline under the text (`data-part="rule"`).

- The title: the stretched `Link` (accessible name = full title, focus
  ring on the overlay), 14px semibold, one truncated line on the baseline.
- Then the 12px medium `fg-muted` date (`datePrefix` from 360px wide; the
  whole date hides below 240px) and the `actions` slot, always visible
  (`relative z-10`, never inside the link).
- Props: `href`, `title`, `dateLabel?`, `datePrefix?`, `tone?`, `actions?`,
  `className?`.
- Motion: hover lifts 1px, the border darkens to `neutral-300` and a soft
  ambient shadow appears (200ms, `cubic-bezier(0.23,1,0.32,1)`); none
  under reduced motion.

Used by: `_components/page-list-row.tsx`.

## PageStripCreateRow (`page-strip.tsx`)

Phase 8 H5-T2: the list view's first row, the strip version of
`PageSheetCreateTile` — a 56px-tall `button`
(`data-slot="page-strip-create-row"`, 10px radius) with the same violet
fill, dashed border and plus disc (28px), the label and, from 360px wide,
the hint beside it (below 160px only the disc remains; the accessible name
stays the label). Hover lifts 1px and deepens its tint, press 0.99, none
under reduced motion. Props: `label`, `hint?`, plus `button` attributes.

Used by: `notebooks/[notebookId]/page.tsx` (list view, same copy as the
grid tile; since H5-T3 it opens `NewPageDialog` too).

## FileFormatBadge (`file-format-badge.tsx`)

Phase 8 H5-T3: a small uppercase file-type tag — the extension ("PDF",
"DOCX", "PPTX") in 10.5px bold on its format's pastel (PDF
`pastel-pink`, Word `pastel-blue`, PowerPoint `pastel-orange`, each with
its `-fg` text), 24px tall, 6px radius, a hairline inset border
(`data-slot="file-format-badge"`, `data-format`). A file label, not a
status `Pill`. Props: `format` (`"pdf" | "docx" | "pptx"`), `className?`.

Used by: `notebooks/[notebookId]/_components/new-page-dialog.tsx` (the
import option, one per `UI_IMPORT_FORMATS` entry, so it follows the
formats the import picker really takes).

### NewPageDialog (route composition, `notebooks/[notebookId]/_components/new-page-dialog.tsx`)

Phase 8 H5-T3 (user request 2026-10-29): every "Nueva página" (grid tile,
list row, empty-state CTA) opens it. Built on `Dialog` (focus trap, Escape,
focus return): title "Nueva página", subtitle "Elige cómo quieres empezar.
Siempre puedes seguir escribiendo después.", two large option cards
(`rounded-2xl`, hairline border, hover lift 2px with a violet border and
soft violet shadow, focus ring, none under reduced motion), side by side
from `sm`, stacked on a phone:

- "Página en blanco": a `PageSheet` in the notebook's colour on a
  `neutral-50` art well; submits the route's `createPage` Server Action
  (creates the page, `redirect`s to its editor); "Creando página…" while
  pending.
- "Importar un documento": a violet `FileUp` disc over the three
  `FileFormatBadge`s; closes the dialog and calls the existing
  `DocumentImportProvider`'s `start` (its hidden picker, PDF/DOCX/PPTX, 20
  MB, its own progress banner and errors, then it opens the new page's
  editor); disabled while another import runs.

It lives in the route, not in `src/modules/notebooks/ui`: notebooks cannot
import ingestion (`cross-module-via-index`), and the app layer is where
the two meet (as in `_components/notebook-actions.tsx`).

## StudyBackdrop (`study-backdrop.tsx`)

Phase 8. A static decorative background that gives a sparse screen body
without competing with its content. Absolutely positioned, `aria-hidden`,
`pointer-events-none`, no text, no animation or parallax. Grid only, no
colour (user decision 2026-10-17):

- `grid`: an SVG of 28px notebook graph paper, lines in
  `stroke-ink-placeholder/55`, centred so a line crosses the middle of the
  card. A radial mask keeps it strongest in the centre and fades it out
  towards the edges.
- `grid-cell`: 16 fixed cells filled with `neutral-150` (light dry gray),
  aligned to the lines and kept clear of the hero text.

Put it first inside a `relative` parent and give the content after it
`relative`. `className?` overrides the inset: Home passes
`inset-[calc(var(--content-padding)*-1)]` so it bleeds over `<main>`'s
padding and fills the whole content card.

Used by: `home/home-empty-state.tsx`.

## RevealGroup / RevealItem (`reveal.tsx`)

Phase 8, client. Staggered entrance with Motion (same feel as the auth
pages' `AuthStack`): each `RevealItem` under a `RevealGroup` (any depth)
rises 8px and fades in, 60ms apart, spring without bounce,
`visualDuration` 0.34s. Opacity/translate only, and items end at
`transform: none`, so the product tour measures the real position of an
anchor inside one. Under `prefers-reduced-motion` the transitions become
zero-duration (nothing animates); only transitions change, never
`initial`, so server markup and hydration match. `revealVariants(reduce)`
is exported for tests.

Used by: `home/home-empty-state.tsx`.

## Keycap (`keycap.tsx`)

A keyboard shortcut chip. `nav-item.tsx` renders one per key of an entry's
`shortcut` array. No sidebar entry sets one since 2026-10-17: the "⌘ H"
chips on "Inicio" were removed because no shortcut was wired to them.

## BackLink (`back-link.tsx`)

Eyebrow-row "back" affordance (user feedback, design/shell-look: the notebook
detail screen and the editor had no way back except the sidebar). A muted
`next/link` with a leading `ArrowLeft` (Lucide, size 15, strokeWidth 1.75)
that only picks up `text-fg` contrast on hover/focus — Notion-style, never a
full button.

- `href`, `children` (the label), `className?` (forwarded via `cn()`).
- Style: `inline-flex items-center gap-1.5`, 13px, `text-fg-muted
  hover:text-fg`, `-ml-1 rounded-md px-1 py-0.5 transition-colors`,
  `self-start`, `focus-visible:ring-2 focus-visible:ring-ring`.

Used by: `notebooks/[notebookId]/page.tsx` (`<BackLink href="/notebooks">`,
first child of the section, above `SectionHeader`), `notebooks/[notebookId]/
pages/[pageId]/page.tsx` (`<BackLink href={/notebooks/${notebookId}}>`, first
child of the centered `max-w-2xl` column, above `PageHeader`).

## Button

Audited for hand-rolled duplication; the existing `default | outline |
secondary | ghost | destructive | link` variants already cover every
Button-composed call site (dialog actions, `CreateNotebookTrigger`'s hero and cta,
`ArchivePageButton`, the kebab menu). The remaining hand-rolled buttons
(`notebooks/[notebookId]/page.tsx`'s "Nueva página", `home/weak-topics.tsx`'s
disabled "pronto", `app/(app)/page.tsx`'s disabled "Ajustar") are each used
exactly once and differ from `Button`'s variants in height, radius, hover
color or focus ring — extending `buttonVariants` for a single call site
would relocate duplication rather than remove it, and reusing `Button` with
enough overrides to stay pixel-exact would be more fragile than the plain
element. Left as native elements; not part of this pass's scope.

## PanelToggleButton (`panel-toggle-button.tsx`)

The 26x26 bordered collapse/expand button (`rounded-md`, `border-neutral-200/70`,
`bg-neutral-0/60`, muted icon). Extracted from `sidebar.tsx`, which inlined
this exact markup for its own `PanelLeft` toggle — the refactor is
zero-visual-change (same classes/DOM, only the icon and aria attributes now
come in as props).

- `icon`: any `LucideIcon`. `size`/`strokeWidth`: default `15`/`1.75`
  (Sidebar's size). The techniques panel (H9-T3, user 2026-10-29) sizes it
  through `className` to match the technique icons: `size-9 rounded-[9px]`
  with a 16px icon in the expanded header (the tiles' 36px icons) and
  `size-12 rounded-lg` with a 20px icon when collapsed, centred in the same
  column as the rail's 48px tiles; neutral chrome, `title` = its
  `aria-label`.
- Forwards `onClick`, `aria-expanded`, `aria-label`, `data-testid`, etc. via
  `React.ComponentProps<"button">` (minus `children`/`type`, which the atom
  owns).

Used by: `sidebar.tsx` (`PanelLeft`), `techniques-panel.tsx`
(`PanelRightOpen`/`PanelRightClose`).

## SidePanel (`side-panel.tsx`)

The floating collapsible card shell behind the "Técnicas" panel
(design/shell-look, studyplatform `StudyPanel.tsx` style reference: 264px
expanded / 52px collapsed, `rounded-xl`, 220ms width transition). Reuses the
exact chrome classes the main Sidebar/content-area cards already use
(`border-neutral-200/60 bg-card shadow-card`) instead of the reference's raw
box-shadow literal.

- `collapsed`, `width`/`collapsedWidth` (px numbers, default 264/52), `side`
  (`"left" | "right"`, default `"right"`; only `"right"` is currently styled
  — a left-side variant is a follow-up if a future panel needs one).
- `header`/`collapsedContent`/`children` are raw slots: the shell owns only
  the header row's alignment/padding/border (centered when collapsed,
  space-between when expanded) and the scrollable body wrapper — the caller
  builds the actual header content for each state and the body content.
- Root is a semantic `<aside>`; `aria-label`/`data-testid` forward onto it,
  and `data-collapsed`/`data-side` are set from props automatically.

Used by: `techniques-panel.tsx` (only consumer so far). The main `Sidebar`
was **not** migrated onto `SidePanel` in this pass — its collapse/expand,
cookie, and section-list anatomy differ enough (nav sections, user footer,
sticky positioning) that migrating it is a separate, not-zero-visual-change
refactor; left as a documented follow-up.

## TechniqueCard / TechniqueIconStrip (`technique-card.tsx`)

The study-technique cards used by the "Técnicas" panel's expanded body and
its collapsed icon strip (design/shell-look, studyplatform `StudyPanel.tsx`
anatomy; simplified per user decision 2026-09-24 — a card has **only** a
"Generar" action, no navigation).

- `TechniqueCard` props: `icon`, `tone`, `name`, `disabled?`
  (default `true` — no technique is built yet), `className?`. `href`, the
  old stats line and `actionLabel` were removed long ago; H9-T1 (user,
  2026-10-29) also removed `description` — users already know each
  technique, so a tile is only icon + name + "Generar" + remaining
  generations.
- Wired variant (Phase 3, Flashcards): pass `onGenerate` and the card becomes
  live — the button is enabled by default (`disabled` can still force it
  off, e.g. quota exhausted, without the "Disponible pronto" title, which is
  reserved for unwired cards), `pending` disables it, sets `aria-busy` and
  swaps the label to "Generando…", `generateTestId` tags the button and
  `children` render under it inside the card (the caller owns the
  remaining-generations, notice and error copy). Without `onGenerate` the
  card behaves exactly as before.
- Anatomy (H9-T2, refined in H9-T3, user 2026-10-29): Home's "Tu progreso
  de hoy" look (`TechniqueCountCard`) — a white bordered `rounded-lg`
  (12px, was 16 in H9-T2) card (`px-3.5 pt-3.5 pb-3`, `shadow-xs`) with the
  technique's pastel fading in from the icon corner (`TECHNIQUE_GLOW_CLASS`
  → globals.css `technique-glow-yellow|mint|pink`), tagged
  `data-part="technique-card"` + `data-tone`. Row 1: a 36px `PixelTile`
  (`data-part="technique-icon"`) and the name as a one-line 15px semibold
  title (`truncate`) vertically centred with it. Row 2: one full-width 36px
  **outlined** "Generar" (`rounded-md`, `border-[1.5px]`, `bg-transparent`,
  13px semibold, leading `Sparkles` 12px): the label in the technique's
  dark ink (`text-pastel-*-fg`; measured on the faded tile yellow 6.72:1,
  mint 7.21:1, pink 6.65:1) and the border in its outline token
  (`border-technique-flashcards|recall|exam-outline` = `#b45309` /
  success-600 / rose-600; UI component 4.76:1 / 3.54:1 / 4.25:1). Hover
  fills it with the technique pastel (`hover:bg-pastel-*`, ink ≥ 5.88:1).
  The three buttons share every class except the colour ones. Then
  `children` (the panel puts "Te quedan N generaciones hoy" there, centred
  11px). Disabled keeps the colour at `disabled:opacity-60` +
  `disabled:cursor-not-allowed`; disabled unwired cards also get
  `aria-disabled` and `title="Disponible pronto"`. (Rejected: H9-T1's flat
  pastel surface with a white button; H9-T2's filled pastel button.)
- `TECHNIQUE_GLOW_CLASS`: the faded glow per `TechniqueTone`, same
  utilities as `TechniqueCountCard`. (H9-T2's `TECHNIQUE_TRIO_GLOW_CLASS`
  and H9-T1's `TechniqueStack` were removed in H9-T3: the empty state is
  plain now.)
- `TechniqueIconStrip`: the collapsed-state 48px `PixelTile` (H9-T3; was a
  40px `IconTile`) with a native `title` tooltip; the panel's collapsed
  width is 64; `opacity-35` when `available` is false (default).
- `TechniqueTone`: `"yellow" | "green" | "rose"` (Flashcards / Recordación
  activa / Examen) — mapped onto the pastel pairs `yellow` / `mint` /
  `pink` (the glow, the button ink and hover fill) and onto `PixelTile`'s
  tones of the same names.
- `TECHNIQUE_PAIR_CLASS` (Phase 7 T1): the pastel pair per `TechniqueTone`
  (`bg-pastel-yellow text-pastel-yellow-fg`, `bg-pastel-mint
  text-pastel-mint-fg`, `bg-pastel-pink text-pastel-pink-fg`), exported so
  `TechniqueChip` reuses exactly the panel's mapping; the button classes are
  derived from it (no visual change).
- `TECHNIQUE_ACCENT_CLASS` (Phase 8 H3, user decisions 2026-10-19): the
  technique accent per tone — `bg-technique-flashcards-accent` #fcd34d
  (pastel yellow, not amber), `bg-technique-recall-accent` #6ee7b7,
  `bg-technique-exam-accent` #ef4444 (solid, vivid red), globals.css tokens
  — for the calendar's technique bars and dots: `TechniqueChip`,
  `CalendarReviewCard`, `TodayReviewRow`, `TechniqueStatusPill`'s dot and the
  week card's dot counts. Accents never carry text; chip and pill
  backgrounds keep the pastel pairs.
- `TECHNIQUE_ACCENT_TEXT_CLASS`: the same accents as `text-*` classes, for
  SVG strokes drawn with `currentColor` (`TechniqueRing`).

- `controls?` (Phase 5 T5): options of the action rendered between the
  header and the button. No card passes it since Phase 6 T5b v2:
  Examen's question count moved into `ExamGenerateDialog` (page route
  component composing `Dialog` + `CountStepper` + `Button`), so the three
  cards look the same.

Used by: `techniques-panel.tsx`.

**Generated list (Phase 6 T5b).** The panel no longer has sample previews:
all three techniques are real, and below the cards one `SavedStudySection`
("Generado en esta página") lists one `StudyItemRow` per technique with
content on the page (NotebookLM Studio model). Cards only generate — no
practice button or deck/exam link inside a card; Examen's "Preguntas" link
was removed too (manual questions live in Exámenes → cuaderno → página).
`SavedStudySection` keys rows by tone + href + label, so rows sharing a label
need distinct hrefs. Its empty state (H9-T3) is a plain neutral card:
`EmptyState` `tinted` restyled as `rounded-lg border-border-subtle bg-card`,
no icon, no colour or gradient, "Aquí verás todo lo que generes" +
"Empieza con una técnica de arriba." The panel is 280px wide since H9-T2
(was 264).

## PixelTile (`pixel-tile.tsx`)

The landing's pixel motif (`landing/_components/pixel-tile.tsx`), ported
app-side in H9-T3 (user 2026-10-29) so the app never imports from
`src/app/(marketing)`: a square in a technique colour filled with a coarse
4×4 Bayer dither (dark / mid / light, light in the top left), at 2 CSS px
per cell, under a crisp Lucide glyph (stroke 2.1) with a 1px offset shadow.

- Props: `tone` (`"yellow" | "green" | "rose"`), `icon` (`LucideIcon`),
  `size` (`36` → 9px radius, 19px glyph; `48` → `rounded-lg`, 24px glyph),
  `title?` (native tooltip), `className?`, `data-part?`. Always
  `aria-hidden`; tagged `data-slot="pixel-tile"` + `data-tone`.
- Colours: globals.css `.pixel-tile[data-tone]` sets `--pt-dark/-mid/-light/
  -ink/-shadow` — yellow warning-500 / flashcards-accent / pastel-yellow,
  ink pastel-yellow-fg; green success-500 / recall-accent / success-50, ink
  pastel-mint-fg; rose `--color-pixel-rose-dark` #be123c / rose-400 /
  `--color-pixel-rose-light` #fecdd3, ink `--color-pixel-paper` with a
  `--color-pixel-rose-shadow` shadow (the landing's values). The tile casts
  a soft `0 5px 10px -6px` shadow in its dark tone.
- `ditherLevel(grid, col, row)` is exported (pure, tested). Dither paths
  are computed once per grid size.
- Used by: `TechniqueCard` (36), `TechniqueIconStrip` (48).

## StudyItemRow (`study-item-row.tsx`)

A single generated-item row inside the "Técnicas de estudio" panel
(Phase 6 T5b, `docs/design-system/screenshots/editor.png` "Mazos guardados"
row anatomy): a white `bg-card`/`border-border-subtle` `rounded-input` row
(`px-3 py-2`) with a 6px tone dot, an 11.5px/500 truncating label over a
10px muted meta line, and a muted `ChevronRight` (12/2). The whole row is a
`Link` — clicking it goes straight to that item's practice route.

- `href`, `label`, `detail` (free-form meta line under the label, e.g. "24
  tarjetas" or "12 preguntas · Repetición pendiente"), `tone: "yellow" |
  "green" | "rose"` (dot colour — `warning-500`/`success-600`/`rose-600`,
  the technique colours of `TechniqueCard`), `testId?` (e2e hook), `title?`
  (native tooltip), `className?`.
- `StudyItemTone` is its own type (not imported from `technique-card.tsx`)
  so this atom has no dependency on the technique-card module.

Used by: `saved-study-section.tsx`.

## SavedStudySection (`saved-study-section.tsx`)

One labelled group of `StudyItemRow`s (design/shell-look, studyplatform
`StudyPanel.tsx` "Mazos guardados" / "Sesiones de Active Recall" /
"Exámenes recientes" groups): a 1px divider, a 10px/500 uppercase muted
label (`tracking-[0.06em]`), then the rows. Renders nothing when `items` is
empty, so a group with no content simply disappears — same behavior as the
reference.

- `label`, `items: StudyItemRowProps[]`, `empty?: ReactNode` (shown under
  the label when `items` is empty; without it an empty group renders
  nothing), `className?`.

Used by: `techniques-panel.tsx`, once, as "Generado en esta página": one row
per technique with content on the page (Flashcards → "N tarjetas", deck
route with `?repasar=1`; Recordación activa → "N preguntas", recall session
route; Examen → "N preguntas" plus "· Repetición pendiente" while a retake is
pending, exam route), with a tinted `EmptyState` as `empty` when nothing was
generated yet.

## NativeSelect (`native-select.tsx`)

A native `<select>` with the `Input` atom's field chrome (`h-8`,
`rounded-lg`, `border-input`, focus ring, disabled opacity) for short pick
lists (Phase 6 T5b, "Crear examen" notebook and page pickers). Native on
purpose: keyboard, screen readers and mobile pickers work without a custom
listbox. Forwards every `<select>` prop; `className` merges.

Used by: `exams/_components/create-exam-dialog.tsx`; the Configuración
time-zone select (`identity/ui/time-zone-form.tsx`, Phase 7 T2a), which
passes `<optgroup>` children per region and widens it with `className`
(`h-10 sm:w-[280px]`, the Profile Settings form-input size). No atom change.

## ChoiceGroup (`choice-group.tsx`)

A single-choice list of bordered rows with radio semantics
(`role="radiogroup"` + `role="radio"`/`aria-checked`), each with a label and
an optional muted description. Unchecked rows use `OptionRow`'s default
palette (`border-neutral-200/80 bg-card`), the checked row its selected
palette (`border-rose-500 bg-pastel-pink/30`).

- `options: { value, label, description? }[]`, `value`, `onChange`,
  `aria-label`, `testId?` (each row gets `${testId}-${value}`), `className?`.

Used by: `exams/_components/create-exam-dialog.tsx` ("Generar con IA" /
"Crear mis preguntas").

## ViewToggle (`view-toggle.tsx`)

The segmented grid/list control (`LayoutGrid`/`List` icons, `rounded-input`
border, `bg-neutral-100` track, active option gets `bg-card` + `shadow-xs`).
Extracted from `notebooks/page.tsx` (design pass 2 atoms-first rule) so
`notebooks/[notebookId]/page.tsx` could reuse the identical control for its
page list. Phase 8 H4-T6 (user decision 2026-10-29) removed it from the
`/notebooks` hub, which now shows only the cover grid.

- `value`: `"grid" | "list"`.
- `hrefFor`: `(view) => string` — builds each option's `Link` href, so the
  choice is server-rendered and persisted in that route's own `?view=` URL
  param (default grid) instead of client state.
- `className`: forwarded onto the root via `cn()`.
- Options (`aria-label` "Ver como cuadrícula"/"Ver como lista",
  `aria-current`) are fixed at two — grid/list is the only case the screen
  needs — not a generic `options` prop.

Used by: `notebooks/[notebookId]/page.tsx`.

## List-row molecule: PageListRow

`page-list-row.tsx` (`app/(app)/_components/`) is one row of the notebook
page's `ViewToggle` `list` view. Since Phase 8 H5-T2 (user request
2026-10-29) it composes `PageStripRow`: the page's route as `href`,
`formatUpdatedAt(updatedAt)` as `dateLabel` with "Actualizada" as
`datePrefix` (the same formatter the `PageSheetCard` grid uses),
`ArchivePageButton` as `actions` and the notebook's colour as `tone`. The
rows stack with an 8px gap under the `PageStripCreateRow`, no `Card`
wrapper, no `IconTile` and no chevron anymore.

Used by: `notebooks/[notebookId]/page.tsx`. The notebook list row was
deleted in Phase 8 H4-T6, when the `/notebooks` list view was dropped.

## DropdownMenu / Popover (`dropdown-menu.tsx`)

E2b token fix: `DropdownMenuContent` was styled with `bg-popover`/
`text-popover-foreground`, but `--color-popover`/`--color-popover-foreground`
are never registered in `globals.css`'s `@theme`, so those utilities emitted
no CSS at all and every dropdown (including the block-context-menu.tsx grip
menu) rendered with a fully transparent background, letting page content show
through. Fixed to the real design-system tokens instead: `bg-card`,
`text-fg`, `border-border-default` (white card, radius 12, shadow-md, same
chrome as the CommandMenu "/" slash menu atom).

Same fix, applied atom by atom (atoms-first rule), so every floating surface
shares one chrome (`rounded-xl border border-border-default bg-card shadow-md`):

- `DropdownMenuContent` / `DropdownMenuSubContent`: card chrome, `min-w-52`.
- `DropdownMenuItem` / `CheckboxItem` / `RadioItem` / `SubTrigger`: `text-[13.5px]`,
  `px-2.5 py-1.5`, highlighted with the `hover` token (`hover:bg-hover`,
  `focus:bg-hover`) instead of the unregistered `accent`; the destructive
  variant uses `error-700` text and an `error-50` highlight.
- `PopoverContent` (`popover.tsx`): same card chrome, `text-fg`.
- `HighlightPickerControls` (editor): same card chrome instead of
  `bg-popover`/`border-border`.

Tests: `dropdown-menu.test.tsx`, `popover.test.tsx` and `highlight-picker.test.tsx`
assert the chrome so the unregistered tokens cannot come back.

## Dialog (`dialog.tsx`)

Radix dialog atom used by every modal form (`CreateNotebookDialog`,
`QuestionFormDialog`, `NewFlashcardDialog`). Since 2026-10-04 (Phase 4 T3)
`DialogContent` uses the card surface — `bg-card`, `border-border-default`,
`text-fg`, `shadow-lg` — instead of `bg-popover` / `text-popover-foreground`.
`--color-popover` is not registered in `globals.css`, so the old classes
produced no CSS and every dialog rendered transparent (the same defect the
DropdownMenu fix handled). Radius stays at the atom's `rounded-xl` (12px);
the design-system modal mockups use 24px — a known gap, not yet aligned.
Covered by `dialog.test.tsx` (asserts the `bg-card` surface).

## Flashcards design preview (2026-09-24)

Six new atoms for the `/flashcards` design-preview screens (user decision:
"solo vamos a construir esas pantallas para validar el diseño" — sample
data only, no backend). Style source:
`studyplatform-flashcards-style.md` (StudyPlatform's built flashcards
screens) plus `docs/design-system/screenshots/flashcard.png`/`flashcard2.png`
for the session mockup. `Pill` and `IconTile`'s existing `success`/
`warning`/`error` tones already covered everything the report needed — no
new `Pill` tones were required (only the `IconTile` `"48"` size above).

**Preview gate.** Every `/flashcards/**` page calls
`requireDesignPreviews()` (`shared/config/design-previews.ts`) first, so it
answers 404 in production unless `COGNI_DESIGN_PREVIEWS=1`; a structural test
(`src/app/(app)/preview-gate.test.ts`, which walks every preview route tree
listed in it) fails when a page is added without the guard. The sidebar "Flashcards" entry carries `preview: { href, isActive }`:
a link while previews are enabled, a disabled "pronto" row otherwise.

**Product rule (2026-09-24): one flashcard deck per page.** A page owns at
most one deck; the deck has no name of its own — it's identified by the page
and titled with the page title. There is no notebook-level deck/card
creation. `flashcards/_data/sample.ts` models this with `SamplePage` (no
separate deck entity) and `getSamplePagesWithCards(notebookId)`, which only
returns pages that actually have cards (no empty decks).

### DeckSummaryCard (`deck-summary-card.tsx`)

Hub grid item (one per notebook that has pages with decks): a pastel-toned
header (`HEADER_BG`, keyed by `NotebookColor` — always that notebook's own
color) with a translucent `IconTile` (`size="48"`, `bg-white/[55%]`
override) and a red due-count badge, then a body with the notebook title
and a due/al-día meta line (`text-error-600`/`text-success-600`).

- `href`, `tone: NotebookColor`, `title`, `cardCount`, `dueCount`.

Used by: `flashcards/page.tsx` (hub).

### DeckCard (`deck-card.tsx`)

Deck grid item (one per page with cards on a notebook's
`/flashcards/[notebookId]` list): a fixed 200px-tall link card with a
cycling `DeckTone` border (13% alpha) and icon tile (14% alpha), a
due/al-día status `Pill`, a centered two-line-clamped label and a footer
card count. `label` is the page title; the footer's left text is the fixed
string "Página" (not a `Pill`/prop — one page is always one deck, so it
never needs to say anything else).

- `DeckTone`: `"warning" | "info" | "success" | "orange" | "pink"` — the
  report's amber/blue/green/orange/pink `DECK_COLORS` cycle, mapped onto
  existing warning/info/success/pastel-orange/pastel-pink tokens instead of
  new hex literals. Assigned by position in the notebook's page list.
- `href`, `tone`, `label`, `cardCount`, `dueCount?`. `dueCount` is optional:
  omitted (the due list could not be loaded) the status pill is not
  rendered at all, instead of showing a false "Al día". Since Phase 4 T6
  `flashcards/[notebookId]/page.tsx` passes the page's flashcards due now
  (scheduling's `listDueTodayAction`); the pill reads "1 pendiente" /
  "{N} pendientes".

Used by: `flashcards/[notebookId]/page.tsx`.

### StatDots (`stat-dots.tsx`)

The session header's live tally: a row of dot+count pairs (Flashcards:
again `error-500`, hard `warning-500`, good `success-500`, easy
`primary-600`). Generalized to caller-owned items, see "StatDots —
generalized" below.

- `items: { key, count, dotClassName }[]`.

Used by: `flashcards/_components/flashcard-player.tsx`.

### FlipCard (`flip-card.tsx`)

The 3D question/answer card: a 660px-wide, 300px-tall perspective card that
rotates on the Y axis (`rotateY`, 550ms, `cubic-bezier(0.4,0,0.2,1)`)
between a plain white front face and a `from-primary-50 to-primary-100`
gradient back face. Renders as a real `<button>` — native Space/Enter
toggle, `aria-pressed={flipped}` — with `data-testid="flip-card"` and
`data-flipped`.

- `front`, `back` (`ReactNode`), `flipped`, `onToggle`.
- `frontEyebrow`/`backEyebrow`/`frontHint`/`backHint`: default to the
  report's copy ("Frente · Pregunta" / "Reverso · Respuesta" / …), 
  overridable per call site.
- The caller `key`s this component per card so a new card starts unflipped
  without animating in from the previous card's angle.

Used by: `flashcards/_components/flashcard-player.tsx`.

### RatingButton (`rating-button.tsx`)

One of the 4 equal-flex recall-quality buttons below a flipped `FlipCard`:
tinted bg/border per tone, `-2px` hover lift + `shadow-card-hover`.
`data-testid="rate-{tone}"`.

- `RatingTone`: `"again" | "hard" | "good" | "easy"`.
- `tone`, `label`, `hint`, `onClick?`, `disabled?`.
- Tone → token pairs (`error-500/30` border · `error-50/90` idle ·
  `error-100/95` hover for `again`; same pattern for `hard`/`warning` and
  `good`/`success`; `easy`/`primary` sits one step darker —
  `primary-100/90` idle · `primary-200/95` hover — because that's the
  report's own pair for that tone).

Used by: `flashcards/_components/flashcard-player.tsx`.

### SessionSummary (`session-summary.tsx`)

The session-complete panel: an emoji + title + subtitle + a 3- or 4-cell
stats grid + an optional "highlight" panel + a "Retroalimentación de la
sesión" placeholder + two actions (`Button` outline/default). Generalized
2026-09-24 (Active recall design preview) from a Flashcards-only component
with a fixed 4-cell again/hard/good/easy shape into a technique-agnostic one
— Flashcards' own call site was migrated onto the new props with zero
visual change.

A **plain fixed overlay**, not Cogni's Radix `Dialog` (`dialog.tsx`):
`DialogContent` always renders its own hardcoded `DialogOverlay`
(`bg-black/10`, no blur, `sm:max-w-sm`) with no prop to reach the darker/
blurred overlay or the 520px panel the mockups call for, and editing the
shared `Dialog` atom was out of scope for this design-only pass — the
task's own fallback clause covers this case. The panel adds
`max-h-[calc(100dvh-32px)] overflow-y-auto` so the extra feedback block
still fits at a 720px viewport height instead of overflowing the screen.

- `emoji?` (default `"🎉"`), `title`, `subtitle` (both `ReactNode`, no
  longer fixed strings — Flashcards passes "¡Sesión completada!", Active
  recall passes "Sesión completada" + `emoji="🧠"`).
- `stats: SessionSummaryStat[]` (`{ key, label, value, toneClassName }`) —
  a 3-cell grid (Active recall: por reforzar/regular/dominadas) or 4-cell
  grid (Flashcards: again/hard/good/easy) picked from `stats.length`.
- `highlight?: ReactNode`: the content of the tinted `bg-neutral-100` panel
  below the stats grid — Flashcards' "Próxima revisión" line, Active
  recall's "Autoevaluación promedio" line + a success `ProgressBar`. The
  atom owns the panel's own wrapper/spacing; the caller only supplies the
  inner content.
- `highlightBeforeFeedback?` (default `false`): Flashcards' original layout
  is stats → feedback → highlight; Active recall's documento-maestro §3.3
  flow wants stats → highlight → feedback instead (the AI feedback is
  reserved for the very end) — a plain ordering switch instead of forking
  the component in two.
- `feedback?: ReactNode` (design/shell-look, user decision 2026-09-24):
  reserves the slot for the future AI session feedback. Defaults to
  `FeedbackPlaceholder`'s own default copy ("Aquí verás qué recordaste
  bien...").
- `primaryAction`/`secondaryAction: SessionSummaryAction`
  (`{ label, href?, onClick? }`) replace the old fixed `backHref`/
  `onRestart` — renders a `Link`-backed `Button` when `href` is set, a
  plain `onClick` button otherwise. Flashcards: secondary "Volver al mazo"
  (href), primary "Repasar de nuevo →" (onClick restart).

Also exports `FeedbackPlaceholder({ description })`: the reusable
Sparkles-`IconTile` + fixed title + "pronto" `Pill` + per-technique
description markup behind the default `feedback` panel above, so a caller
can reuse the exact same chrome with its own copy.

Used by: `flashcards/_components/flashcard-player.tsx`. No longer used by
Active recall (design/shell-look fix, 2026-09-24): its documento-maestro
§8.5 async-evaluation flow needs a "still evaluating" state this overlay
can't represent, so its session-complete screen moved to the in-page
`ActiveRecallResultsView` documented below instead — see `StatusBanner` and
`QuestionFeedbackItem`.

### StatDots (`stat-dots.tsx`) — generalized

Generalized 2026-09-24 (Active recall design preview) from a fixed
again/hard/good/easy 4-tone tally into `items: StatDotItem[]`
(`{ key, count, dotClassName }`), so both Flashcards' 4-tone tally and
Active recall's 3-tone por-reforzar/regular/dominadas tally can reuse the
same dot+count row instead of duplicating the markup. Flashcards' call site
now builds its `items` array from a local `TALLY_TONE` lookup instead of
passing raw counts — zero visual change.

Used by: `flashcards/_components/flashcard-player.tsx`,
`active-recall/_components/active-recall-player.tsx`.

### DeckSummaryCard (`deck-summary-card.tsx`) — generalized

Generalized 2026-09-24 (Active recall design preview): `cardCount`/
`dueCount` are now optional, and a new `meta?: ReactNode` prop overrides
the default "{cardCount} tarjetas · {due|al día}" line entirely — Active
recall's hub passes `meta="{N} sesiones · última {p}%"` instead (no
card/due concept). Flashcards' call site is unchanged (still passes
`cardCount`/`dueCount`, no `meta`) — zero visual change.

Used by: `flashcards/page.tsx`, `active-recall/page.tsx`.

Phase 4 T6 (2026-10-04): the default meta line pluralizes ("1 tarjeta",
"1 pendiente"). The flashcards hub now passes `cardCount` and the
notebook's summed flashcards due now as `dueCount`; when the due list
cannot be loaded it passes `meta` with the card count only, so the card
never claims "al día" without data.

### "Repasos de hoy" list (`flashcards/_components/due-today-list.tsx`)

Route component, not an atom: it composes `Card` (`padding="md"`),
`SectionTitle`, `IconTile` (size `36`, radius `input`, notebook tone),
`Pill` (`sm`, `error`, `dot`: "{N} pendientes") and `Button`
(`asChild`, `size="sm"`, `variant="outline"`) around a `next/link`
"Repasar" that opens `/flashcards/{notebookId}/{pageId}?repasar=1`.
Rows reuse the divider pattern of the former Home ReadyToReview panel
(removed in Phase 8 H2-T5). Nothing due shows
`EmptyState variant="success"` ("Estás al día"); a failed load shows one
muted line instead.

## Active recall design preview (2026-09-24)

Five new atoms for the `/active-recall` design-preview screens (user
decision: mirror the Flashcards preview, sample data only, no backend), plus
the `SessionSummary`/`StatDots`/`DeckSummaryCard` generalizations documented
above. Style source: `studyplatform-active-recall-style.md` (StudyPlatform's
built Active Recall screens) plus `docs/design-system/screenshots/
active-recall.png`. Follows documento-maestro §3.3 where it differs from
StudyPlatform: feedback shows only at the end of the session (never between
questions), and self-evaluation is a 0–5 scale instead of a 3-option
correct/partial/incorrect pick.

**Preview gate.** Every `/active-recall/**` page calls
`requireDesignPreviews()` as its first statement, so it answers 404 in
production unless `COGNI_DESIGN_PREVIEWS=1` (same structural test as
Flashcards, `src/app/(app)/preview-gate.test.ts`). The sidebar "Active
recall" entry carries `preview: { href: "/active-recall", isActive }`: a
link while previews are enabled, a disabled "pronto" row otherwise.

**Product rule: one study unit per page.** A page owns at most one Active
recall "deck" — its sessions — with no separate named-session entity, same
shape as Flashcards' one-deck-per-page rule. `active-recall/_data/sample.ts`
models this with `RecallPage` (sessions inline) and
`getRecallPagesWithSessions(notebookId)`, which only returns pages that
actually have at least one session (no empty sessions).

### QuestionCard (`question-card.tsx`)

The session's open-question card: white, `rounded-2xl` (20px, the closest
token to the report's 18px), `p-9` (36px), `shadow-md`; a 6px success dot +
uppercase eyebrow (default "Pregunta") above the question text at 19/600.
`children` is a reserved extra-content slot below the question, unused by
the current session.

- `eyebrowLabel?`, `question`, `children?`.

Used by: `active-recall/_components/active-recall-player.tsx`.

### AnswerTextarea (`answer-textarea.tsx`)

The open-answer field: `min-h-[120px]`, `bg-neutral-50`, `border-[1.5px]`,
`rounded-lg` (12px, exactly the report's radius 12), turning
`border-success-500` + `ring-success-500/10` + `bg-card` on focus. Built as
its own atom instead of styling the generic `Textarea` — its shadcn
defaults conflict with too much of this look to override cleanly, the same
call `RatingButton`/`DeckCard` already made for their own custom controls.

- Plain `React.ComponentProps<"textarea">` passthrough.

Used by: `active-recall/_components/active-recall-player.tsx`.

### FeedbackBlock (`feedback-block.tsx`)

The post-answer "Tu respuesta" card (documento-maestro §3.3: feedback only
shows at the end of the session, so the review step shows the student's own
answer back to them, never an "expected answer"): a `neutral` (white/muted
eyebrow, current use) or `success` (tinted, reserved for a future
correct-answer callout) panel with an uppercase eyebrow + body text.

- `eyebrowLabel`, `tone?: "neutral" | "success"` (default `"neutral"`),
  `children` (body).

Used by: `active-recall/_components/active-recall-player.tsx`.

### DifficultyScale (`difficulty-scale.tsx`)

The post-answer self-evaluation (documento-maestro §3.3 "¿Qué tan difícil te
resultó?"): 6 equal tinted buttons (0 Imposible → 5 Trivial), grading
error (0–1) → warning (2–3) → success (4–5) with `RatingButton`'s own
bg/border/hover pattern, in a responsive grid (3 columns narrow, 6 once
there's room). Tapping an option both records the rating and advances to
the next question — there's no separate "Siguiente". `data-testid=
"self-rate-{n}"`.

- `onSelect: (value: number) => void`, `disabled?`.

Used by: `active-recall/_components/active-recall-player.tsx`.

### RecallPageCard (`recall-page-card.tsx`)

The "Sesiones por página" grid item (one per page with sessions on a
notebook's `/active-recall/[notebookId]` list): a tinted `success-100/35`
header (notebook name + page title), a body with the latest session's date
and a preguntas/sesiones meta line, and a footer with the latest session's
mastery/"dominio" (tone by threshold: ≥70 success, ≥40 warning, else error)
+ its AI-score breakdown, plus a "Ver resultados →" success `Pill` (was
"Repasar →" until Phase 6 T7, user decision 2026-10-08: the card opens the
latest session's results, where "Nueva sesión →" starts a session). The
meta line uses the singular for one question or one session ("1 pregunta", "1 sesión").

- `href`, `notebookTitle`, `pageTitle`, `lastSessionDate`, `questionCount`,
  `sessionCount`, `mastery`, `aiCorrect`, `aiPartial`, `aiIncorrect`.
  Renamed from `accuracy`/`correct`/`partial`/`incorrect` (design/shell-look
  fix, 2026-09-24 — documento-maestro §7.4 "dominio"/combined quality, not
  raw accuracy; the breakdown is explicitly the AI score buckets: ≥4
  `aiCorrect`, 2-3 `aiPartial`, ≤1 `aiIncorrect` — never the self-rating
  bucket, see `StatDots`/`ActiveRecallResultsView`'s stats grid for that
  one).

Used by: `active-recall/[notebookId]/page.tsx`.

### StatusBanner (`status-banner.tsx`)

The async-evaluation status panel (design/shell-look fix, 2026-09-24;
documento-maestro §8.5: answers save first, the AI evaluation is async, and
feedback only shows once every evaluation for the session has finished): a
tone-tinted panel (`pending` warning / `success` / `error`) with an
`IconTile` (a spinning `Loader2` for `pending`) + title + muted description.

- `tone: "pending" | "success" | "error" | "rose"`, `title`, `description`
  (`ReactNode`), `action?` (`ReactNode`, rendered below the description),
  `className?`, plus the rest of `React.ComponentProps<"div">` (e.g.
  `data-testid`) forwarded onto the root.

Used by: `active-recall/_components/active-recall-results-view.tsx`
(`tone="pending"` — this design preview has no backend to ever resolve the
evaluation, so the results view always renders that tone).

**Extended for Exams (2026-09-24):** `rose` tone + `action` slot (bg
`pastel-pink/50`, border `rose-500/25`, title `text-pastel-pink-fg`, icon
`RotateCcw` on the existing `pink` `IconTile` tone — no new `IconTile` tone
needed). Used by `exams/page.tsx` (hub retake banner, with `action` =
"Repetir examen"), `exams/_components/exam-player.tsx` ("Examen de
repetición" notice, no action) and `exams/_components/exam-results-view.tsx`
(failed-exam banner, with `action` = "Repetir examen").

### QuestionFeedbackItem (`question-feedback-item.tsx`)

One row in the results view's "Retroalimentación por pregunta" list
(design/shell-look fix, 2026-09-24; documento-maestro §8.5: "el estudiante
ve la justificación y puede marcar 'no estoy de acuerdo' (se registra, no
cambia el puntaje en v1)"): the question + a nested `FeedbackBlock` ("Tu
respuesta") + a self-rating `Pill` (tone by bucket) and an "IA — / 5"
neutral `Pill` + a "Justificación" block + an outline "No estoy de acuerdo"
button.

- `index`, `question`, `answer` (`"(sin respuesta)"` for a skipped
  question), `selfRating`, `selfRatingLabel`/`selfRatingTone` (caller passes
  the bucket's `label`/`pillTone` from `self-rating.ts`'s
  `SELF_RATING_BUCKET_META`).
- `pending?` (default `true`): while pending, the "Justificación" block
  renders two `animate-pulse` skeleton bars + "Disponible cuando termine la
  evaluación", and the disagree button is `disabled` with that same string
  as its `title`.
- `aiScore?: number | null` and `justification?: string` (Phase 6 T6,
  approved 2026-10-06, no layout change): once `pending` is false the
  neutral pill reads "IA {aiScore} / 5" (still "IA — / 5" without a score)
  and the justification renders as a 13px `text-fg-secondary` paragraph in
  the slot the skeleton used. While pending both are ignored.
- `disagreed?: boolean` (default `false`; user-approved 2026-10-07): once
  evaluated and disagreed, the same outline `sm` button turns `disabled` and
  reads "Marcado como desacuerdo" (same icon, style and size, no new
  element). The results view passes it from the stored `disagreed` flag
  (so a later read shows it) and sets it at once on click, undoing it if
  the save fails.
- `onDisagree?`, `className?`.

Used by: `active-recall/_components/active-recall-results-view.tsx`.

## Active recall results view (2026-09-24 design fixes)

`active-recall/_components/active-recall-results-view.tsx` +
`active-recall/_components/self-rating.ts` (route-local — not shared/ui,
same reasoning as the route's own `_data/sample.ts`): the session-complete
screen, rendered in-page by `ActiveRecallPlayer` when the session ends
instead of the `SessionSummary` overlay (documento-maestro §8.5's async
evaluation needs a "still evaluating" state the overlay can't represent).
Column `max-w-[680px]`, `BackLink` "Todas las sesiones", a "Resultados de la
sesión" header, then: `StatusBanner` (pending), a 3-cell self-rating stats
grid, the "Autoevaluación promedio" panel, "Calidad combinada" and
"Calibración" placeholder panels (documento-maestro §7.4 — always render
their pending "—" state; there's no backend in this preview to ever combine
`ai_score` with `self_rating`), the `QuestionFeedbackItem` list under a
"Retroalimentación por pregunta" `SectionTitle`, then two actions (outline
"Volver a las sesiones" / dark "Nueva sesión →"). `self-rating.ts` exports
the shared `SelfRatingBucket` type/bucketing function/tone-and-label lookup
(`SELF_RATING_BUCKET_META`) and the `QuestionRecord` shape both this view
and `ActiveRecallPlayer` build from — `ActiveRecallPlayer` now keeps one
`QuestionRecord` per answered/skipped question instead of only running
tallies, so the results view can render each one's own feedback row.
`data-testid`s: `active-recall-results` (root), `evaluation-status`
(`StatusBanner`), `question-feedback-item` (each row).

Phase 6 T6 (2026-10-07), same layout on real data: the header shows the
session's date; the view polls the evaluation and keeps everything pending
while any answer is pending; the banner turns `success` ("Evaluación
completa") when every answer is evaluated or `error` ("No pudimos evaluar
algunas respuestas") with an outline `sm` "Reintentar" in its `action` slot
when a provider failed every attempt; the same error banner shows when
polling stops (a read that cannot heal, or about 9 minutes of backoff
without a result). Resolved, "Calidad combinada" shows
the average combined quality ("x,x / 5") and "Calibración" the over/under
confidence counts, each without its "pronto" pill; evaluated rows pass
`pending={false}`, `aiScore`, `justification` and `onDisagree`, while a
failed row stays pending until retried. New `data-testid`s (no visual
change): `combined-quality`, `calibration-over`, `calibration-under`.

## Exams design preview (2026-09-24)

Six new atoms plus the `StatusBanner` `rose` tone/`action` slot documented
above, for the `/exams` design-preview screens (design-only pass, no
backend). Style source: `studyplatform-exams-style.md` (StudyPlatform's
built Exams screens). Product rules follow documento-maestro §3.3
"Exámenes", §7.5 "Reprogramación y repetición de exámenes", and the
`ExamQuestion`/`ExamPageState`/`ExamSession` entities — these win over the
style source wherever they differ.

**Tokens added:** `--color-rose-400`/`-500`/`-600` (`#fb7185`/`#f43f5e`/
`#e11d48`) in `globals.css`'s `@theme` — the exam technique's own accent
(option selection, current-question progress dot, `ExamPageCard`'s gradient
bar), layered on top of the existing `pastel-pink`/`pastel-pink-fg` pair.

**Product rules:** multiple choice, 4 options, 1 correct, N per session
(default 10), deterministic correction. A score below 70 % marks the page
`retake_pending` and reschedules the failed questions (due tomorrow, shown
in "Hoy" with "Repetir examen"). A retake never repeats the same question
with the same wording — one AI-generated variant per failed concept, topped
up with new questions to at least 5. Unlike Active recall/Flashcards, a page
shows up in the technique screens once it has **generated** questions,
independent of whether it has been attempted (`exams/_data/sample.ts`'s
`getExamPagesWithQuestions` filters on `questionCount > 0`, not on
`attempts`).

### ExamPageCard (`exam-page-card.tsx`)

The "Exámenes por página" grid item (one per page with generated
questions on a notebook's `/exams/[notebookId]` list): a 4px rose/pink
gradient top accent bar, page title, a preguntas/intentos meta line, a
score-or-"Sin intentar" `Pill` row (+ a "Repetir pendiente" `Pill` when
`retakePending`, or a "Vence hoy" `Pill` when questions are due today), the
last attempt date, and a CTA that reads the page's state ("Presentar
examen" / "Repetir examen" / "Rendir examen" / "Ver resultados").

- `notebookId`, `pageId`, `pageTitle`, `questionCount`, `attempts`,
  `lastScore: number | null`, `retakePending`, `lastDate?`, `dueToday?`,
  `className?`.
- Due state (user decision 2026-10-06): `dueToday > 0` on an examined page
  with no pending retake shows the pink "Vence hoy" pill and the CTA
  "Rendir examen →" on the exam route. A pending retake ("Repetir examen")
  and a never-attempted page ("Presentar examen") take precedence.

Used by: `exams/[notebookId]/page.tsx`.

### TimerChip (`timer-chip.tsx`)

The exam session header's count-up timer: a bordered chip with a `Clock`
icon + `MM:SS`. Presentational only — `ExamPlayer` owns the `setInterval`
tick itself (so the final elapsed time survives into the results view's
"Tiempo" stat) instead of this atom running its own.

- `seconds`, `className?`. `data-testid="exam-timer"`.

Used by: `exams/_components/exam-player.tsx`.

### QuestionProgressDots (`question-progress-dots.tsx`)

The exam session's clickable question tracker: a row of 24×6px pills —
current `rose-500`, answered `pastel-pink-fg`, unanswered
`neutral-200/60` — each one jumping straight to that question.

- `total`, `current` (0-based), `answered: ReadonlySet<number>`,
  `onJump: (index: number) => void`, `className?`.
  `data-testid="exam-progress-dots"`.

Used by: `exams/_components/exam-player.tsx`.

### OptionRow (`option-row.tsx`)

One multiple-choice option: a letter badge (A–D) + option text. While
taking the exam only `default`/`selected` states are ever used (no
correct/incorrect reveal during the session, documento-maestro §3.3);
`correct`/`incorrect` swap the badge for a `Check`/`X` icon, reserved for a
future read-only reuse.

- `index` (0-based, drives `data-testid="exam-option-{index}"`), `letter`,
  `text`, `state: "default" | "selected" | "correct" | "incorrect" |
  "muted"`, `onClick?`, `disabled?`, `className?`.

Used by: `exams/_components/exam-player.tsx`.

### ScoreCard (`score-card.tsx`)

The results view's headline: a 100px tinted disc with the score % (band:
≥80 success / ≥60 warning / else error) + correct/total, and a band title
(≥90 "¡Excelente!", ≥70 "¡Buen trabajo!", ≥50 "Puedes mejorar", else "Sigue
practicando") + page/notebook + a correctas/incorrectas/sin
responder/tiempo stats row.

- `score`, `correct`, `incorrect`, `unanswered`, `total`, `timeLabel`
  (preformatted "MM:SS"), `pageTitle`, `notebookTitle`, `className?`.
  `data-testid="exam-score"` on the score % itself.

Used by: `exams/_components/exam-results-view.tsx`.

### ExamReviewRow (`exam-review-row.tsx`)

One row in the results view's "Revisión pregunta por pregunta" list: a
status tile (`Check` success / `X` error / `Minus` muted for unanswered) +
the stem + a status label + a "Concepto: {concept}" `Pill`, then the
student's own answer (always shown) and the correct one + a pending AI
explanation block (both only when the answer wasn't correct) — reuses
`question-feedback-item.tsx`'s exact skeleton pattern for the pending
explanation.

- `index`, `stem`, `status: "correct" | "incorrect" | "unanswered"`,
  `concept`, `yourAnswerLabel`, `correctAnswerLabel`,
  `explanationPending?` (default `true`), `explanation?`, `className?`.
  `data-testid="exam-review-row"`.
- Phase 5 T6: `explanation` is the question's own explanation, shown under
  an "Explicación" label for a failed question when `explanationPending` is
  `false` (the AI explanation of T8 replaces it later). With neither a
  pending AI explanation nor an `explanation`, no explanation block renders
  (before T6 an empty "Explicación de la IA" heading stayed).

Used by: `exams/_components/exam-results-view.tsx`.

### Exams sample data and routes

`exams/_data/sample.ts` (route-local, same reasoning as the other two
previews' `_data/sample.ts`): `ExamQuestion { id, pageId, stem, options[4],
correctIndex, concept }`, `ExamPage { id, notebookId, title, questionCount
(derived, never hand-typed), attempts, lastScore: number | null, passed,
retakePending, lastDate }`. `getExamPagesWithQuestions(notebookId)`,
`getExamPage(notebookId, pageId)`, `getExamQuestions(pageId, { retake? })`,
`getExamVariantQuestions(pageId)` (only "mitocondria" has a variant set in
this preview — the only sample page with `retakePending: true`) and the
exported `MITOCONDRIA_RETAKE_CONCEPTS` list (the retake session's
StatusBanner copy).

Routes mirror the Flashcards/Active recall previews exactly: `exams/page.tsx`
(hub, + the retake `StatusBanner` when any page has `retakePending`),
`exams/[notebookId]/page.tsx` (`ExamPageCard` grid), `exams/[notebookId]/
[pageId]/page.tsx` (resolves `?retake=1` into the variant question set,
renders the client `exams/_components/exam-player.tsx`, which switches to
`exams/_components/exam-results-view.tsx` on submit — same in-place
results pattern as `ActiveRecallResultsView`, not the `SessionSummary`
overlay). `data-testid`s: `exam-session`/`exam-results` (roots),
`exam-option-{index}`, `exam-timer`, `exam-progress-dots`, `exam-score`,
`exam-review-row`.

Phase 5 T6: the player (`exams/[notebookId]/[pageId]/page.tsx`) and the
results (`…/resultados/page.tsx`) left the preview and run on real data.
The route renders `exams/_components/exam-start.tsx` (`CountStepper` for
N = 10–30, `StatusBanner` notes for "needs 10" and a pending retake) or,
while the page has an open session, the real `exam-player.tsx` (one
question at a time, `OptionRow` `correct`/`incorrect`/`muted` reveal + a
`StatusBanner` with the explanation, `TimerChip` counting from the session
start). "Ver resultados" finishes the session and opens
`resultados?sesion=<id>`, rendered by `exam-results-view.tsx` (`ScoreCard`,
pass/fail `StatusBanner`, failed-concept `Pill`s, `ExamReviewRow` with the
question's explanation). Only the hub and the notebook view still read
`exams/_data/sample.ts`.

`flashcards/_data/sample.ts`'s `getSampleStudyItemsForPage()` exam item now
points at the real preview (`/exams/biologia-celular/mitocondria`,
"Examen · 22 sept" / "10 preguntas · 60 % · repetir") instead of a
placeholder `#` href. The sidebar's "Exámenes" item is no longer disabled
(`sidebar.tsx`'s `TECNICAS_SECTION`, `href: "/exams"`,
`isActive: (path) => path.startsWith("/exams")`).

## Exams design audit fixes (2026-09-24)

A follow-up design-only pass against documento-maestro §3.3/§7.5, fixing 5
gaps found while auditing the exams preview above.

### ExamPageCard — routing fix

`exam-page-card.tsx` no longer takes a single `href`: it takes
`notebookId`/`pageId` and computes 3 destinations itself — a
`retakePending` page links straight to `?retake=1` (never the plain
session), a passed/scored page links to its new `/resultados` route
instead of re-running the exam, and only a never-attempted page still
links to the plain session. The root is now a `div` (not one big `Link`),
because the footer gained a second "Preguntas (N)" link to the new
`/preguntas` route: the title uses the stretched-link pattern
(`after:absolute after:inset-0` on a `relative` root, same as
`page-list-row.tsx`) to keep the whole card clickable, and the footer link
opts back into its own clickable layer with `relative z-10`.

### Stored results — `/exams/[notebookId]/[pageId]/resultados`

Renders the page's last stored session from sample data through the same
`ExamResultsView` the live player uses. `ExamResultsView` (`exam-results-
view.tsx`) gained `mode: "live" | "stored"`, `date?`, `isRetake?`, and
`durationSeconds` (renamed from `seconds`): `mode="stored"` swaps "Nuevo
examen" from a local restart into a `Link` to a fresh session, and an
outline "Editar preguntas" action (→ `/preguntas`) was added next to
"Volver a los exámenes" in both modes. A `date`/`isRetake` line renders
above the `ScoreCard` only when provided — the live flow passes neither by
default (`ExamPlayer` now passes `isRetake` from its own prop), so nothing
changes visually for a fresh live submission unless it actually was a
retake.

`exams/_data/sample.ts` gained `ExamSessionRecord { id, pageId, isRetake,
date, answers, durationSeconds }` and `getLastExamSession(pageId)`: one
stored record per attempted page (Mitocondria 60 % / 6/10 with 2 wrong + 2
unanswered, Membrana celular 83 % / 5/6, Renacimiento 100 %). `data-testid`
stays `exam-results` (reused).

### Manual question creation/editing — `/exams/[notebookId]/[pageId]/preguntas`

New route + client view (`exams/_components/exam-questions-view.tsx`):
header count "{N} preguntas · {M} generadas por IA · {K} manuales" (N/M/K
only count non-retired questions), a "Nueva pregunta" `Button` opening the
new `QuestionFormDialog`, and one `ExamQuestionRow` per question. All state
is local (saving appends/edits in memory; "Retirar" marks `retiredAt`
instead of deleting — history stays visible, nothing is persisted past a
remount).

**Since Phase 5 T4 (2026-10-05) the route runs on real data** and left the
design-preview gate (the exams hub, player and results stay previews until
T6/T9). The page reads the page's active questions through
`listExamQuestionsAction` (retired questions are not listed any more, so no
row shows the "Retirada" pill here); "Nueva pregunta" / "Editar" save
through `createExamQuestionAction` / `editExamQuestionAction` and
"Retirar" opens a `Dialog` confirmation ("¿Retirar esta pregunta?",
destructive "Retirar") before `retireExamQuestionAction`; each success
refreshes the route. Below the header, while the page holds fewer than 10
questions, a calm bordered note with a muted `Info` icon reads "Un examen
necesita al menos 10 preguntas. Agrega {n} más para poder rendirlo."
(`data-testid="exam-questions-minimum"`); with none, an `EmptyState`
(pink `IconTile` + `ClipboardList`) reads "Esta página aún no tiene
preguntas". The `BackLink` is "Volver a la página" (the notebook page) and
the "Vista previa" pill is gone. Entry point: the page's "Técnicas" panel —
the Examen card (visible in production too) carries an outline "Preguntas"
`Button asChild` link (`data-testid="exam-questions-link"`) under its still
disabled "Generar".

`exams/_data/sample.ts`'s `ExamQuestion` gained optional `origin: "ai" |
"manual" | "ai_variant"`, `variantOf?`, `explanation?`, `retiredAt?` —
populated only by the new `getExamQuestionsForManagement(pageId)`, a
derived list built with `.map()` (never mutating the underlying arrays),
so it can never change what `getExamQuestions`/`getExamVariantQuestions`
serve to the live session or retake. Mitocondria's management list marks
`mitocondria-q6` `origin: "manual"`, retires its 4 failed-concept originals
(`retiredAt`), and tags its 5 retake variants `origin: "ai_variant"` (4
with `variantOf` pointing at the original they replace, the 5th — the
"topped up" extra question — with none). Every other page's management
list is just its plain question set tagged `origin: "ai"`.

#### ExamQuestionRow (`exam-question-row.tsx`)

Index + stem, a neutral "Concepto: …" `Pill`, an origin `Pill` ("IA"
primary / "Manual" success / "Variante" rose), a muted "Retirada" `Pill` +
`opacity-60` on the whole row once `retiredAt` is set, an A–D options
preview line with the correct option bold, and "Editar"/"Retirar" ghost
buttons (`onRetire` omitted, not just disabled, once already retired).

- `index`, `stem`, `concept`, `origin: "ai" | "manual" | "ai_variant"`,
  `options`, `correctIndex`, `retiredAt?`, `onEdit`, `onRetire?`,
  `className?`. `data-testid="exam-question-row"`.

Used by: `exams/_components/exam-questions-view.tsx`.

#### QuestionFormDialog (`question-form-dialog.tsx`)

Built on Cogni's `Dialog` atom (same composition as `modules/notebooks/ui/
create-notebook-dialog.tsx`): "Enunciado" `Textarea`, 4 "Opción A–D" rows
(each an `Input` + a native radio marking the correct one), "Concepto que
evalúa" `Input` with a helper line, "Explicación (opcional)" `Textarea`,
footer "Cancelar" / "Guardar pregunta" ("Guardar cambios" in edit mode) —
disabled until the stem, all 4 options and the concept are filled. Fully
controlled (`open`/`onOpenChange`) so the same instance serves both "Nueva
pregunta" and every row's "Editar"; it re-syncs its local form state from
`initialValues` on every `open` transition instead of being remounted.

- `open`, `onOpenChange`, `mode: "create" | "edit"`, `initialValues?`,
  `onSubmit: (values: QuestionFormValues) => undefined | Promise<string |
  null | undefined>`. `data-testid="question-form-dialog"`.
- Since Phase 5 T4: a sync `onSubmit` closes at once (as before); an async
  one keeps the dialog open while it runs (save button disabled, reading
  "Guardando…"), then closes on `null`/`undefined` or shows the returned
  Spanish message as a `role="alert"` line (`text-destructive text-sm`,
  same as `NewFlashcardDialog`) above the footer and stays open. Re-opening
  clears the error.
- Since the T4 review fixes: while an async save runs, "Cancelar" is
  disabled and Escape, the overlay and the close button do not dismiss the
  dialog (a running save is never silently abandoned). Each `open`
  transition starts a new session: if the caller closes the dialog anyway,
  the reopened form starts enabled ("Guardando…" never leaks into it) and
  the old save's outcome is ignored — it never closes or shows its error in
  the new session. `NewFlashcardDialog` still lets "Cancelar" run during a
  save and carries the Phase 4 stale-transition advisory; align it with
  this behaviour when that dialog is next touched.

Used by: `exams/_components/exam-questions-view.tsx`.

### Blocked retake preview — `?retake=1&variantes=error`

documento-maestro §7.5 point 5: when variant generation fails on every
provider, the retake is blocked and the original session is never reused.
There's no backend here to actually fail, so `exams/[notebookId]/[pageId]/
page.tsx` treats `variantes=error` as a design-preview-only query flag
(documented in a code comment, not a real API contract): instead of
`ExamPlayer`, it renders an `error`-tone `StatusBanner` ("No pudimos
preparar tu examen de repetición" / …) with "Reintentar" (→ `?retake=1`)
and outline "Volver a los exámenes" actions, wrapped in
`data-testid="retake-blocked"`. `ExamPlayer`'s own "Examen de repetición"
banner (shown while taking a real retake) gained a small muted link "Ver
estado de error (vista previa)" pointing at that same flag, so the blocked
state is reachable from the UI instead of only by hand-typing the URL.

### Submit confirmation — `SubmitConfirmDialog` (removed)

**Removed on 2026-10-05** (commit `673fa79`, "take an exam and see its
results on real data"); kept here as history. The design-preview
`ExamPlayer` asked for confirmation before submitting with unanswered
questions. The real player (`src/app/(app)/exams/_components/
exam-player.tsx`) has no submit dialog: each answer is graded and locked
as it is given, and "Ver resultados" appears only on the last question
once every question is answered, so finishing is immediate. Do not
reintroduce the dialog without a product decision.

## Dashboard v2 (2026-09-25, design/shell-look)

A full rebuild of `/dashboard` (design-only, no backend). The user rejected
the 2026-09-25 v1 layout ("too many charts, loud colours, not focused on
week-over-week progress and feedback"). v2 follows the user's reference
screenshot's grid (a dark analytics dashboard — kept LIGHT with Cogni
tokens): hero + key insight, main activity chart + accuracy ring, 3 KPI
tiles, a notebook-progress list + a calibration table, then the
per-technique cards and the strengths/weaknesses lists carried over from
v1. Charts stay MONOCHROME (never distinguishing a series by hue alone) —
the reference's own restraint, not StudyPlatform's.

**Removed** (v1 atoms/components no longer used by any screen):
`mastery-heatmap.tsx`, `stacked-level-bar.tsx`, `quadrant-scatter.tsx`,
`notebook-filter.tsx`, `radial-progress.tsx` (`shared/ui/`); `calibration.tsx`,
`mastery-curve.tsx`, `mastery-heatmap-section.tsx`, `review-load.tsx`,
`technique-metrics.tsx` (`dashboard/_components/`). The `?notebook=` filter
is gone entirely — v2 always shows every notebook, so `NotebookFilter` had
no remaining call site.

**Kept unchanged:** `chart.tsx`, `mastery-level.ts`, `kpi-card.tsx`
(no longer used by the dashboard itself, but not deleted — still a generic,
documented atom), `sparkline.tsx`, `dot-streak.tsx`, `concept-bar-list.tsx`.

### ChartCard (`chart-card.tsx`) — extended

Gained two optional props for the v2 icon-header cards
(`ActivityChart`/`AccuracyRing`/`TechniqueActivity`/`CalibrationTable`):
`icon` (rendered before eyebrow/title, `flex items-center gap-2.5`) and
`divider` (a `border-b border-border-subtle` hairline between the header
row and the `<figure>` body — matches the reference screenshot's header
rule under "Sales Overview"/"Sales Distribution"). Both default to
unset/`false`, so every other existing call site is unaffected.

### IconTile (`icon-tile.tsx`) — new `rose` tone

Added `tone="rose"` (`bg-rose-500/10 text-rose-600`) — the exact pair
`Pill`'s existing `rose` tone already uses (no `--color-rose-100` token
exists). Needed so the Exámenes technique's icon tile matches its
established brand colour (used by `TechniqueActivity`'s per-card header).

### PeriodFilter (`period-filter.tsx`) — range values changed

`DashboardRange` is now `7 | 15 | 30` (was `7 | 30 | 90`) per this pass's
brief. Same segmented 3-option `Link` control, only the values/labels
changed (`"15 días"` replaces `"90 días"`).

### LevelStrip (`level-strip.tsx`) — new

Row 1 "Dominio global" key-insight strip: one thin (3px) vertical bar per
page, height proportional to score, coloured by `mastery-level.ts`'s solid
tone scale — the reference's dense vertical-bar sparkline, kept
per-level-coloured instead of one flat tone so a glance still shows "how
many pages at each level". A pure-CSS `group`-hover/focus tooltip (page ·
nivel · score%) keeps it server-renderable, same pattern `MasteryHeatmap`
used. A 3-tone legend (Aprendiendo/Consolidando/Dominado — "Nuevo" omitted,
matching the widget's own 3-tone legend requirement) renders below.

- `bars: { id, label, level, score }[]`, `className?`.

Used by: `dashboard/_components/mastery-insight.tsx`.

### DashedRing (`dashed-ring.tsx`) — new, replaces RadialProgress

Row 3 "Tasa de acierto" ring: a plain SVG (two `<circle>`s, no Recharts) —
the TRACK is a genuinely dashed circle (`stroke-dasharray="2 6"`), which a
Recharts `RadialBarChart`'s solid background arc couldn't do; the
progress arc is a second circle with `stroke-dasharray`/rotated -90deg so
it starts at 12 o'clock. Centered content: an icon tile, the value
(22px/700) and an uppercase caption, server-renderable (no chart library
needed for one static ring).

- `value` (0-100), `icon`, `label`, `colorVar?` (default
  `var(--color-primary-600)`), `size?` (default 160), `className?`.

Used by: `dashboard/_components/accuracy-ring.tsx`.

### TableHeaderButton (`table-header-button.tsx`) — new

Row 7's sortable `<th>` header button: label + a direction-aware icon
(`ChevronsUpDown` unsorted, `ArrowUp`/`ArrowDown` when active). The caller
renders it inside a `<th aria-sort=…>` and owns the actual sort state —
this atom is presentational only.

- `children`, `direction?: "asc" | "desc"`, `onClick`, `className?`.

Used by: `dashboard/_components/calibration-table.tsx` (4 sortable columns:
Página, Autoevaluación, Resultado real, Brecha).

### Dashboard route (`dashboard/page.tsx` + `_components/*`)

`?range=` (`7 | 15 | 30`, default 7) is the only URL param now — no
`?notebook=`. `data-testid`s: `dashboard` (root), `hero`, `mastery-insight`,
`activity-chart`, `accuracy-ring`, `kpi-row`, `notebook-progress`,
`calibration-table`, `technique-activity`, `concepts`.

- **`hero.tsx`** (`DashboardHero`, Row 1 wide): "Buenos días, {nombre}" +
  a feedback sentence built from `heroFeedback()` (the same
  `dominioGlobalInsight()` delta and the weakest notebook from
  `notebookProgressRows()` — never a second, independently-typed number),
  a primary `Button` "Ver repasos de hoy →" to `/`, and a purely decorative
  inline SVG (`primary-50/100/200` shapes, `aria-hidden`, no emoji).
- **`mastery-insight.tsx`** (`MasteryInsight`, Row 1 narrow): "Dominio
  global" — big %, a `success`/`error`-toned delta line, `LevelStrip`.
- **`activity-chart.tsx`** (`ActivityChart`, Row 3 wide, `"use client"`):
  "Actividad de repaso" — title, big value + delta line, a 3-dot legend row
  + `PeriodFilter` (7/15/30), then a stacked `BarChart` — one bar per day,
  MONOCHROME series (`neutral-900`/`neutral-500`/`neutral-300` for
  Flashcards/Recordación activa/Exámenes), `radius=[4,4,0,0]` on the top
  (Exámenes) segment only, a dashed `CartesianGrid`, and (15/30 días only)
  a light dashed `ReferenceLine` + "Sem N" label at every Monday so the
  chart reads day-by-day AND week-by-week. X-axis ticks: every day at 7
  días; a custom tick component prints a label only every 5th index at
  15/30 días (`ActivityTick`) so 30 bars never overlap.
- **`accuracy-ring.tsx`** (`AccuracyRing`, Row 3 narrow): "Tasa de
  acierto" — a review-volume-weighted overall accuracy inside `DashedRing`,
  plus a 3-row technique breakdown (dot + label + accuracy% + delta).
- **`kpi-row.tsx`** (`KpiRow`, Row 5): 3 tiles (racha de repasos / ítems
  vencidos / páginas dominadas), each label + big value + delta pill +
  icon tile (`Flame`/`AlarmClock`/`BookCheck`) + outline "Ver detalle →"
  button. The icon-tile+button tile shape stays a route-local `KpiTile`
  helper inside `kpi-row.tsx` (3 call sites in one file, same precedent as
  v1's `TechniqueCard`) rather than a new `shared/ui` atom — `KpiCard`
  (the existing shared atom) has a different anatomy (sparkline, no
  icon/button) and stays available for any future KPI row that fits it.
- **`notebook-progress.tsx`** (`NotebookProgress`, Row 6, simplified):
  dropped `StackedLevelBar`/`Sparkline` — now icon tile + title +
  "{items} ítems · {due} vencidos", a mastery `Pill`, a 1-week trend arrow,
  and a bottom "Ver cuadernos →" button.
- **`calibration-table.tsx`** (`CalibrationTable`, Row 7, `"use client"`):
  replaces v1's `QuadrantScatter`. One row per page (every self-evaluated
  concept on it averaged via `calibrationRows()`): Página (title +
  notebook), Autoevaluación/Resultado real (0-5 averages), Brecha, a
  Señal `Pill` (Exceso/Falta de confianza/Calibrado — same §7.4 thresholds
  as v1, applied to the averages), and a "Repasar" link. Sortable via
  `TableHeaderButton` (client `useState` sort key/direction), 5 rows per
  page with Prev/Next pagination.
- **`technique-activity.tsx`** (`TechniqueActivity`, Row 8, `"use client"`,
  renamed from v1's `technique-metrics.tsx`): 3 cards, simplified — icon
  tile + name header (no divider), big "Repasos completados" value + delta,
  `DotStreak`, a 7-day mini bar chart in the technique's own tone (the only
  place technique colours are still used strongly), a small "Acierto X%"
  `Pill`. The per-card `RadialProgress` ring moved to the page-level
  `AccuracyRing` widget; "tiempo de estudio" was dropped everywhere (it
  can't be measured honestly without a real study-time log).
- **`concepts.tsx`** (`Concepts`, Row 9): unchanged from v1 — two
  `ConceptBarList`s (fortalezas/puntos débiles), now notebook-filter-free
  (no `notebookId` param).

### `_data/sample.ts` — rebuilt

Deterministic sample data only (no `Math.random()`; the one `Date` object,
`TODAY_ANCHOR = new Date(2026, 8, 25)`, is a fixed sample-fixture "today",
never `Date.now()`). Kept from v1: `DASHBOARD_PAGES` (19 pages, unchanged
scores — reused because their existing `trend` ramps already reproduce
this pass's target numbers, see Deviations), `NOTEBOOK_WEEKLY_MASTERY` (12
weekly points × 3 notebooks, unchanged), `TECHNIQUE_METRICS` (unchanged
accuracy/streak/weekly-activity values — also reproduce this pass's target
numbers unmodified), `CALIBRATION_SEEDS` (24 seeds, unchanged). New:
`DAILY_ACTIVITY` (30 deterministic daily per-technique counts — weekday
base arrays × a linear "recency" ramp factor, `1x` 29 days ago → `2x`
today), `dominioGlobalInsight()`, `notebookProgressRows()`,
`heroFeedback()`, `activityChartInsight(range)`, `accuracyRingInsight()`,
`rachaRepasosKpi()`/`paginasDominadasKpi()`/`itemsVencidosKpi()` (no more
`notebookId` param — always every notebook), `calibrationRows()`
(per-page aggregation, replaces v1's per-concept scatter points/jitter).

**Deviations from the brief's illustrative example numbers** (the brief's
"Metrics per widget" section gave example values like "60% / +6 pts" and
"128 / +18%" — most emerged exactly from real computation over the
UNCHANGED v1 data; two are honestly derived instead of force-fit):

- **Matched exactly, unmodified data:** "7 de 19" páginas dominadas (+1),
  "62" ítems vencidos (−11), "76%" tasa de acierto general (weighted avg of
  84/71/63 by weekly volume), and the per-technique 84/71/63 accuracy
  values themselves — all fall out of `DASHBOARD_PAGES`/`TECHNIQUE_METRICS`
  unchanged from v1.
- **Derived, doesn't match the brief's illustrative "+6 pts"/"128"/"+18%":**
  `dominioGlobalInsight()`'s 1-week delta over the real
  `NOTEBOOK_WEEKLY_MASTERY` curve computes to a smaller delta than "+6";
  the hero subtitle plugs in that SAME computed number (never a second,
  independently-typed "6") so the two stay internally consistent. The
  activity chart's total/delta% are computed from `DAILY_ACTIVITY`'s
  formula rather than hand-fit to hit "128"/"+18%" exactly — prioritizing
  derived-not-hardcoded correctness over matching an illustrative example.
- **Literal sample constants (no deeper model exists yet):** `rachaRepasosKpi()`'s
  `delta: 2` (the streak itself is derived — the longest of the three
  technique streaks — but no "streak a week ago" log exists to derive its
  delta from); `TechniqueMetric.repasosDeltaPct` (+12/+9/−4, one literal
  per technique — no historical weekly-activity series exists to derive it
  from, same category as v1's `itemsVencidosKpi` ×1.18 approximation,
  which IS kept as a real formula since it already reproduces "−11"
  exactly for due=62).

Verification: `pnpm typecheck`, `pnpm lint` (clean on every file this pass
touched — pre-existing, unrelated formatting findings remain in the
untracked `.claude/skills/ui-ux-pro-max/` fixtures, outside this pass's
scope), `pnpm depcruise`, `pnpm build`, and
`vitest run src/app/no-inline-hex.test.ts "src/app/(app)/_components/sidebar.test.tsx"`
— all green.

## Checkbox (`checkbox.tsx`)

Native `<input type="checkbox">` with a visible label and optional helper
text (terms-of-use acceptance, 2026-10-04). It stays a real input, so it
posts `name=on` from a plain `<form action>` and keeps keyboard and
screen-reader behaviour.

- Props: `label` and `name` (required), `description` (linked through
  `aria-describedby`), plus any input prop (`required`, `defaultChecked`,
  `data-testid`, `id`). `className` styles the wrapper (`data-slot="checkbox"`).
- Look: 20px box, `border-default`, `accent-primary-600`, primary focus ring;
  label 14px `text-fg`, description 12px `text-fg-secondary`.

Used by: `modules/identity/ui/accept-terms-form.tsx`.

## CountStepper (`count-stepper.tsx`)

Compact numeric choice inside a fixed range (Phase 5 T5, 2026-10-05): how
many exam questions "Examen → Generar" creates (10–30, default 10). Reusable
for T6's exam length selector (same range).

- Props: `label` (visible, names the `role="group"` and the buttons:
  "Más/Menos {label in lower case}"), `value`, `min`, `max`, `step?` (1),
  `onChange`, `disabled?`, `testId?` (the value is tagged `${testId}-value`),
  `className?`.
- Anatomy: 10.5px muted label on the left; on the right two `Button`
  `variant="outline" size="icon-xs"` (Lucide `Minus`/`Plus`, strokeWidth 2)
  around an `<output aria-live="polite">` with the value (12px semibold,
  tabular numbers). Each button clamps to `[min, max]` and is disabled at its
  bound or when `disabled`.

Used by: `techniques-panel.tsx` (Examen card `controls`).

## TechniqueChip (`technique-chip.tsx`)

Calendar event chip (Phase 7 T1; Phase 8 H3, user reviews 2026-10-19): one
study technique of one page on the month/week grid, drawn as an outlined
card — `rounded-sm border border-border-default bg-card`, no tinted fill —
with a 3px bar in the technique's accent on the left
(`TECHNIQUE_ACCENT_CLASS`, `data-part="accent"`, `aria-hidden`), the page
title in semibold black (`text-fg`) and an optional muted subline. The
coloured side bar is a deliberate, approved exception to the "no coloured
side borders" rule. No count on the chip: the caller's `aria-label` /
`title` carries it.

- Props: `tone` (`TechniqueTone`), `label` (page title, 12px,
  `data-part="label"`), `meta?` (11px `text-fg-muted` subline — the notebook
  on the week grid, `data-part="meta"`), `compact?` (one truncated title
  line for the month grid; default up to two lines, `line-clamp-2`),
  `href?` (renders a `next/link`; without it a `span`), plus any HTML
  attribute (`aria-label`, `title`, `className` merged via `cn()`).
- Anatomy: `relative flex flex-col py-1.5 pr-2 pl-3.5`, bar `absolute
  inset-y-1.5 left-1.5 w-[3px] rounded-full`. Linked chips firm the border
  (`neutral-300`) and add a `neutral-50` wash on hover, plus the focus ring.
- `collapse?: "dot-when-narrow"` (Phase 7 T2, narrow month grid): inside a
  container narrower than 42rem (`@max-2xl`, the `CalendarGrid` frame) the
  chip shrinks to a 10px round dot in the technique's accent (borderless);
  the bar hides and label / meta become `sr-only` there, so the link keeps
  its text for assistive tech. Sets `data-collapse`.
- `data-slot="technique-chip"`, `data-tone={tone}`.

Used by: `calendario/_components/calendar-period.tsx` (week: title +
notebook; month: compact title).

## TechniqueStatusPill (`technique-status-pill.tsx`)

Technique status pill (Phase 8 H3, reference "● Pendiente / ● Conectado /
● Error"): `rounded-full px-2 py-0.5 text-xs font-medium` on the
technique's pastel pair (`TECHNIQUE_PAIR_CLASS`: pale background, dark
text in the same hue, ≥ 5.9:1) with a 6px dot in its accent
(`TECHNIQUE_ACCENT_CLASS`, `aria-hidden`); the label truncates.

- Props: `tone`, `size?` (`"md"` default; `"sm"`: 11px, `px-1.5 py-0`,
  for height-capped rows), `children` (the technique name), `className?`.
- `data-slot="technique-status-pill"`, `data-tone`, `data-size`; part `dot`.

Used by: `technique-ring.tsx`, `calendar-review-card.tsx`.

## TechniqueRing (`technique-ring.tsx`)

One technique's week progress (Phase 8 H3-T2, Semana metric card option 1,
user decision 2026-10-19). Client component (Motion). A 46px ring (5px
stroke): `text-neutral-150` track and an arc in `TECHNIQUE_ACCENT_TEXT_CLASS`
reading done / total clockwise from 12 o'clock (`pathLength={100}`, round
cap), the share in the centre (11px bold tabular), and the technique's
`TechniqueStatusPill size="sm"` below. A technique with nothing this week
(total 0) shows the bare track and "—"; 0 of N shows the track and "0%"
(no arc: a round cap would leave a dot). The arc draws in once
(`strokeDasharray` "0 100" → percent, spring without bounce); under
prefers-reduced-motion only the transition becomes `duration: 0`, never
`initial`, so hydration matches. Accessibility: one sr-only sentence
("Flashcards: 3 de 10 repasos (30%)" / "Examen: sin repasos esta semana");
the drawing and digits are `aria-hidden`.

- Props: `tone`, `label`, `done`, `total`, `className?`.
- `data-slot="technique-ring"`, `data-tone`; parts `indicator`, `value`.
- The static `ProgressRing` (Home's technique cards) stays as is: it is a
  server component with no animation.

Used by: `calendario/_components/week-summary.tsx`.

## IllustratedEmptyState (`illustrated-empty-state.tsx`)

Illustrated empty state (Phase 8 H3, the calendar's "Hoy"; user decision
2026-10-19). Client component (Motion). A centred column on a calm glow
(`empty-state-glow` utility: a violet radial — `primary-200` →
`primary-100` → transparent — that stays around the illustration and
fades out before the section's edges): a decorative `next/image`
(`alt=""`, `sizes="(min-width: 768px) 480px, 90vw"`, up to 480px wide,
scaling down on phones) with a transparent background, so every figure
stays whole, inside `data-part="art"` on a blurred diagonal violet blob
(`illustration-backdrop` utility: `primary-100` → `primary-300` in an
ellipse, `blur(18px)`, 75% opacity), then a big title (`text-2xl md:text-3xl` semibold,
`text-gradient-brand`, `h3`), a muted
15px message and an optional quiet action. The block fades and rises 10px
once; under prefers-reduced-motion only the transition becomes
`duration: 0`, never `initial`, so hydration matches.

- Props: exactly one of `image` (`{ src, width, height }`) or `art`
  (`ReactNode`, Phase 8 H4-T3: a decorative CSS hero such as
  `NotebookFan`, rendered full width in `data-part="art"` with no blob,
  no `<img>`, and the title at `mt-4`), then `title`, `description`,
  `action?` (rendered in `data-part="action"`), `steps?`
  (`readonly string[]`), `entrance?` (`"block"` default | `"cascade"`),
  `paper?`, `className?`.
- Since Phase 8 H5-T4 also the empty notebook page
  (`notebooks/[notebookId]/page.tsx`): `art={<PageSheetFan tone />}`,
  `entrance="cascade"`, `paper`, title "Tu cuaderno está listo para su
  primera página", and the hub's violet pill CTA "Nueva página" (a
  `Button` that opens `NewPageDialog`).
- `data-slot="illustrated-empty-state"`, `data-entrance="block" |
  "cascade"`, `data-surface="paper"` when `paper`.
- `steps` (Phase 8 H4, user decision 2026-10-20): an
  `<ol data-part="steps">` of centred, wrapping pills between message and
  action — white, 1px `border-default`, `rounded-pill`, 13px
  `fg-secondary` text, the number in bold `primary-600`. With steps the
  action moves to `mt-7`.
- `entrance="cascade"` (Phase 8 H4-T2): instead of the whole block, art,
  title, message, each step (0.06s apart) and the action fade and rise
  10px in turn with `cubic-bezier(0.16, 1, 0.3, 1)`, 0.32s each, finishing
  under 0.7s. Under prefers-reduced-motion only the transitions become
  `duration: 0`; `initial` never changes, so hydration matches.
- `paper` (Phase 8 H4-T2): the `dotted-paper` utility on the block —
  `primary-200` dots on a 22px grid in a `::before` layer (`z-index: -1`,
  `isolation: isolate` on the block, so it sits over the glow and under
  the content), radially masked so they are strongest around the centre
  and dissolve before the edges.
- History (2026-10-20): a `backdrop={false}` plain variant (opaque white
  illustration, later framed as a card on a violet aura) and a Three.js
  floating-sheets layer were tried for the notebooks hub and dropped by
  the user (no visible rectangle; performance); H4-T2 then gave the hub
  the calendar's glow and blob around a keyed-out illustration at a
  400px `artSize="sm"`. H4-T3 (user decision 2026-10-20) replaced that
  illustration with the CSS `NotebookFan` through `art`, and `artSize`
  was removed with its last user.

Used by: `calendario/_components/today-list.tsx` ("¡Terminaste tus repasos
de hoy!" / "Hoy estás al día", with "Próximo repaso: …" or "Ver la
semana"), `calendario/_components/scheduled-list.tsx` ("Día libre de
repasos", "Ver la semana"), with `/illustrations/calendar-empty.webp` (the
source JPEG's flat grey background keyed out to transparency), both with
the defaults; `notebooks/page.tsx` (zero notebooks: "Todas tus materias,
en un solo lugar", three steps and `CreateNotebookTrigger variant="cta"`,
`entrance="cascade"`, `paper`), with `art={<NotebookFan />}`; the glow and
the dotted paper stay behind the fan.

## CalendarReviewCard (`calendar-review-card.tsx`)

Review card of the month's right panel (Phase 8 H3, approved mockup
2026-10-19): one fixed size whatever its text — a 60px-high hairline
`rounded-xl` link with a 3px bar in the technique's accent on the left
(`data-part="accent"`, `aria-hidden`), the page title (13px semibold) on
its own line across the card's full width, and below it
(`data-part="meta"`) the notebook (12px muted) with the technique's
`TechniqueStatusPill size="sm"` pushed right (`shrink-0 whitespace-nowrap`,
never wraps). Title and notebook truncate to one line each with the full
text as `title` tooltip. Width follows the panel. Hover and
`focus-visible` share one gentle lift (200ms ease-out): `primary-300`
border, a `primary-100/60` wash, a soft violet-tinted
shadow and — only under `motion-safe:` — a 2px rise (`-translate-y-0.5`);
under reduced motion just the colours change. The size never changes (the
rise is a transform; focus adds a `primary-200` ring). No chevron.

- Props: `href` (the page), `tone`, `title`, `detail`, `techniqueLabel`,
  `aria-label` (technique, page and amount: "Examen de …: 2 ítems"),
  `className?`.
- `data-slot="calendar-review-card"`; parts `accent`, `title`, `detail`.

Used by: `calendario/_components/month-day-panel.tsx` (the selected day's
reviews and "Próximos repasos").

## DaySelectLink (`day-select-link.tsx`)

The cover link that selects a calendar day (Phase 8 H3, the month grid).
Client component. An `absolute inset-0` `next/link` with `scroll={false}`
(the selection lives in the URL, the page does not jump) that also
activates with Space, like a button; inset focus ring. `CalendarDayCell`
renders it when given `selectHref`.

- Props: `href`, `aria-label` ("Ver martes, 20 de octubre"),
  `aria-current?` (`"date"` on the selected day), `className?`.
- `data-part="select"`.

Used by: `calendar-grid.tsx` (`CalendarDayCell`).

## TodayReviewRow (`today-review-row.tsx`)

Review-today row (Phase 8 H3-T4, the calendar's "Hoy"; user-approved
mockup 2026-10-19): ONE `next/link` for the whole row, `rounded-2xl`
hairline border, `p-4` (`md:px-5`), hover `border-border-default` +
`shadow-card`, focus-visible ring. md+: a grid `[140px wait] [4px solid
technique bar] [title + pills] [Repasar + chevron]`; below md the wait sits
above the title; below sm the "Repasar" cue moves under the pills so the
title keeps the width. The title is 15px semibold (two lines max); the pills
are `Pill size="md"`: technique in its pastel tone (yellow / mint / pink),
notebook and amount neutral. "Repasar" is a `span` styled with
`buttonVariants()` (dark primary) because the row is already the link.

- Props: `href`, `aria-label` (the link's name, e.g. "Flashcards de
  Mitocondria: 8 pendientes"), `tone`, `title`, `waitingTitle` ("Desde
  ayer"), `waitingDetail` ("1 día esperando"), `techniqueLabel`,
  `notebookTitle`, `amountLabel` ("8 tarjetas"), `data-testid?`,
  `className?`.
- `scheduled?` (Phase 8 H3-T4, a later day on "Hoy"): no wait column and no
  "Repasar" cue; a muted 12px "Programado" marker (`data-part="status"`)
  with the chevron instead, in a `[4px 1fr auto]` grid. `waitingTitle` /
  `waitingDetail` are then optional. Sets `data-mode="scheduled"` (else
  `"due"`).
- `data-slot="today-review-row"`; parts `waiting`, `accent`, `action`,
  `status`.

Used by: `calendario/_components/today-list.tsx`,
`calendario/_components/scheduled-list.tsx` (`scheduled`).

## DateBadge (`date-badge.tsx`)

Calendar card date badge (Phase 7 T1, the reference's "JAN / 10" tile): a
56px-wide bordered tile with the abbreviated Spanish month in capitals
(`OCT`, neutral-50 band, 10.5px semibold muted) over the day number (18px
bold).

- Props: `date`, `timeZone?` (IANA zone the day is read in; omitted, the
  runtime zone, like the rest of the shell), `className?` and span attributes.
- The visible parts are `aria-hidden`; an `sr-only <time datetime="YYYY-MM-DD">`
  carries the long date ("lunes, 12 de octubre").
- `size?` (Phase 8 H3): `"md"` (default, 56px wide, 18px day) or `"xl"`
  for the calendar page header — 88px wide and `h-full`, so it is as tall
  as its slot (the title + tabs stack, ~96px), with a 12px month strip and
  a 34px day centred in the rest; `data-size`.
- `tone?` (Phase 8 H3): `"neutral"` (default, `bg-neutral-50` muted month
  strip) or `"brand"` — a Cogni-violet month strip (`bg-primary-600
  text-white`, 5.7:1) so the badge reads as a calendar icon.
- `data-slot="date-badge"`, parts `data-part="month"` / `"day"`.

Used by: `calendario/page.tsx` (`tone="brand"`, `size="xl"`, left of the
"Calendario" title and tabs; it shows the day being viewed: Hoy's day,
today or the week's Monday, today or the month's 1st).

## SegmentedTabs (`segmented-tabs.tsx`)

Page-level segmented tabs (Phase 7 T1, the reference's "All events / Shared
/ …" row; Phase 8 H3 violet glass pill, user review 2026-10-19). Client
component (Motion). Same container as `ViewToggle`/`PeriodFilter`
(`rounded-input border bg-neutral-100 p-1`), text items `px-3 py-1.5
text-[13px] font-semibold text-fg-muted`. The active item is white text on
a solid `primary-600` pill (`data-part="active-pill"`, `aria-hidden`) with a
glass edge: an inset top highlight, a faint inner bottom shade, a thin
`ring-white/25` inner ring, a soft diagonal white sheen and a small violet
drop shadow — the fill stays solid. The pill slides between items with a
Motion `layoutId` (scoped with `useId`); under prefers-reduced-motion the
transition is `duration: 0`.

- Props: `aria-label` (names the `<nav>`), `items` (`{ value, label, href }`
  or `{ value, label, disabled: true, hint }`), `value`, `className?`.
- Linked items are `next/link`s (the view lives in the URL); the active one
  gets `aria-current="page"`. A disabled item is a `span` with
  `aria-disabled="true"`, `title={hint}` and `opacity-60`.
- `data-slot="segmented-tabs"`.

Used by: `calendario/page.tsx` ("Hoy" / "Semana" / "Mes").

## `text-gradient-brand` (globals.css utility)

Cogni violet gradient text (Phase 8 H3): `linear-gradient(120deg,
primary-600, primary-800)` clipped to the glyphs (`background-clip: text`,
transparent `-webkit-text-fill-color`, so a `text-*` colour class on the
same element never paints over it). Both ends meet AA on white (5.7:1,
8.9:1); the accessible name is the plain text.

Used by: `calendario/page.tsx` (the "Calendario" h1, via `SectionHeader`'s
`titleClassName`).

## CalendarNav (`calendar-nav.tsx`)

Calendar period navigation (Phase 7 T2; Phase 8 H3, user reference
`ref-arrows.png`): two bare muted chevrons — no container and no middle
button, since the view tabs return to the current period. Each is a 32px
round hit area (`rounded-full text-fg-muted`) with a 20px `ChevronLeft` /
`ChevronRight` that darkens over a faint `neutral-100` wash on hover, plus
the focus ring. A `disabled` arrow ("Día anterior" on today) is an inert
`span` (no href, not focusable) with `aria-disabled="true"` at
`opacity-35`, its name kept as sr-only text.

- Props: `aria-label` (names the `<nav>`), `prev`, `next` (each `{ href,
  label, disabled? }`; the label is the arrow's accessible name),
  `className?`.
- `data-slot="calendar-nav"`.

Used by: `calendario/_components/period-header.tsx` ("Día anterior / Día
siguiente", "Semana anterior / Semana siguiente", "Mes anterior / Mes
siguiente").

## CalendarGrid / CalendarDayCell (`calendar-grid.tsx`)

Calendar day grid (Phase 7 T2, the reference's month body). `CalendarGrid`
renders an `aria-hidden` weekday header row (`bg-neutral-50`, 12px semibold
muted, centred) over a `<ul>` of seven `minmax(0,1fr)` columns, so phones get
narrow cells instead of a horizontal scroll. `CalendarDayCell` is one `<li>`:
hairline `border-r border-b border-border-subtle`, `p-1.5` (`md:p-2`),
min-height 72px (`md:` 128px); day number top-left in a 24px slot (12px
semibold); today's number in a violet rounded square (`rounded-md
bg-primary-600 text-white`) on a faint violet cell (`bg-primary-50`), days
outside the shown month on `bg-neutral-50` with a muted number. The
`variant="week"` cell (Phase 8 H3) shows today as a soft violet wash down
the whole column (`bg-linear-to-b from-primary-100/70 via-primary-50/40
to-transparent`) and shows its number row (`data-part="number-row"`) only where the
days stack (`@2xl:hidden`): the week's numbers live in the grid's header
("Lun 19"). The sr-only long name and "(hoy)" are always present. Children
stack (`gap-1`) and wrap in a row when narrow; an optional "N más…" link
(12px semibold muted, `+N` when narrow).

- `CalendarGrid` props: `aria-label` (names the list), `weekdays` (seven
  short names, Monday first), `weekdayNumbers?` (Phase 8 H3, the week:
  `{ dayNumber, isToday }` per weekday, shown next to its name in the
  header — `data-part="weekday-number"`, 20px, today's in a violet
  rounded square), `stackWhenNarrow?` (week layout: one column and no
  header when narrow), `fill?` (Phase 8 H3, the week: the frame becomes
  `flex flex-1 flex-col` and the list `flex-1`, so the days stretch to the
  bottom of a flex-column card), `className?`.
- `CalendarDayCell` props: `day` (ISO, also `data-day` and the `<time
  dateTime>`), `dayNumber`, `label` (sr-only long name, "(hoy)" appended for
  today), `weekday?` (shown next to the number only below `md`), `isToday?`,
  `outside?`, `more?` (`{ count, href }`, accessible name "N más el …"),
  `variant?` (`"month"` default / `"week"`), `selectHref?` (Phase 8 H3,
  the month grid: a `DaySelectLink` cover selects the day; the number row
  and chips sit above it, only the chips catching the pointer), `isSelected?`
  (2px inset `ring-primary-600` outline, `data-selected`, the cover's
  `aria-current="date"`), `className?`,
  children (event chips).
- `data-slot="calendar-grid"` / `"calendar-day"`, `data-today`,
  `data-outside`.

Used by: `calendario/_components/calendar-period.tsx` ("Mes", "Semana").

## Auth screens redesign (Phase 8 L1, 2026-10-15)

Atoms added for the login/register/forgot/reset screens. They are generic
and safe to reuse elsewhere.

### TextDivider (`text-divider.tsx`)

Horizontal rule with a short centred label: the "o" between "Iniciar sesión"
and "Continuar con Google". Two `aria-hidden` 1px rules
(`h-px flex-1 bg-border-default`) around a `text-xs text-fg-secondary`
label, `flex items-center gap-3`.

- Props: `children` (the label), any `div` prop, `className?`.
- `data-slot="text-divider"`.

Used by: `(public)/login/page.tsx`, `(public)/register/page.tsx`.

### GoogleIcon (`google-icon.tsx`)

Google's four-colour "G" as inline SVG (no external request), 18px by
default, `aria-hidden` — the button carries the accessible name.

- Props: any `svg` prop, `className?` (size override).
- `data-slot="google-icon"`.

Used by: `modules/identity/ui/google-button.tsx`.

### TextLink (`text-link.tsx`)

Inline `next/link` for links inside running copy ("¿No tienes cuenta? Crea
una"): `font-medium text-fg-active` (violet, AA on the warm panels),
`hover:underline hover:text-primary-800` with `underline-offset-4`, and a
`focus-visible:ring-3 ring-ring/50` focus ring.

- Props: every `next/link` prop, `className?`.
- `data-slot="text-link"`.

Used by: the four `(public)` auth pages and
`modules/identity/ui/terms-notice.tsx`.

### BrandMark / BrandGlyph (`brand-mark.tsx`)

Single source of truth for the Cogni brand ("7 v2 Glass", usage rules in
`docs/design-system/assets/logo.md`). `BrandGlyph` is the mark: the frosted
violet squircle with a white lowercase "c", rendered with `next/image`
(`unoptimized`) from the static SVGs in `public/brand/`, always decorative
(`alt=""`, `aria-hidden`). At 20px and below it switches to the blur-free
favicon build. `BrandMark` puts the mark next to the outlined lowercase
"cogni" wordmark SVG (decorative, with a visually hidden "Cogni" as the
accessible name and text content), sized to the
lockup's proportions (wordmark width = 2.1462 × mark height). Static copy of
the paper lockup: `docs/design-system/assets/logo.svg`.

- `tone`: `light` (default; paper glass, ink wordmark) · `dark` (ink glass,
  paper wordmark) for ink surfaces such as the auth brand panel.
- `size`: `md` (default, 28px mark) · `sm` (20px favicon-build mark, app
  sidebar).
- `wordmark`: `false` renders the mark alone (collapsed sidebar); the caller
  then owns the accessible name.
- Not a link; `data-slot="brand-mark"` / `"brand-glyph"` /
  `"brand-wordmark"`, `data-tone`.
- The landing nav and footer (`(marketing)`) keep a live Manrope/Inter text
  wordmark and place the same `public/brand` mark before it.

Used by: `(public)/layout.tsx` (dark tone on the brand panel; light tone
above the form below `md`), `(app)/_components/logo.tsx` (wrapped in the home
link).

### SubmitButton (`submit-button.tsx`)

`Button` (via `motion.create`) with `type="submit"`, a pressed scale of 0.98
(spring, no bounce, 150ms) and a loading state: while pending it is
disabled, sets `aria-busy` and shows a spinning `Loader2`
(`data-slot="spinner"`, static under reduced motion). The label never
changes, so its accessible name stays stable for tests and screen readers.

- Props: every `Button` prop except `type`, plus `pending?` (e.g. from
  `useActionState`). The enclosing form's `useFormStatus().pending` also
  counts, so plain server-action forms get the loading state for free.

Used by: `modules/identity/ui/auth-forms.tsx` (all four auth forms),
`modules/identity/ui/google-button.tsx`.

## Populated Home atoms (Phase 8 H2-T5, 2026-10-18)

The Home with notebooks: hero with the review streak full width, then a
main column (three technique count cards, "Continúa donde lo dejaste",
"Temas débiles") and a 320px "Para repasar hoy" column on the right that
starts at the cards' top (H2-T5j, user decision 2026-10-18; it replaced
the earlier weak-topics-on-the-right layout). It is one CSS grid
(`lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_auto_auto_1fr]`,
the right column spanning all four rows so the `1fr` row absorbs its extra
height); below `lg` it stacks in DOM order, today's work first: cards,
"Para repasar hoy", "Continúa donde lo dejaste", "Temas débiles". References:
`docs/new_design_fase_8` (capture 10.37.53 hero + stat cards, Uxcel Web 22
day streak, capture 12.28.40 row). They replace the old Home `StatCard`,
`StreakDots`, `ReadyToReview`, `NotebookGrid`, `RecentPages` and
`HomeHeader` route components, which were deleted.

Personality pass (v2, impeccable "Operate" mode: restraint, one authored
moment): the hero has soft radial glows (`home-hero-glow`: violet top-left, pink behind the illustration) and the illustration sits on it
directly, with no graph paper (user 2026-10-18; `mix-blend-multiply` drops
the image's white box); the focal moment is the week's streak chain filling in one
day at a time, followed by the flame; everything else is a quiet `RevealGroup`
entrance and a pop on the count numbers. All motion runs once, ≤0.5s, and
only its transitions change under reduced motion (never `initial`).

### PopNumber (`pop-number.tsx`)

Client atom: a `motion.span` that settles in once (opacity 0→1, scale
0.82→1, y 4→0, spring bounce 0.3, 0.4s, optional `delay`). It always
renders the final value, so server markup, tests and screen readers never
see an intermediate count (chosen over a count-up for that reason). Props:
`value: number | string`, `delay?` (seconds), `className?`.

Used by: `TechniqueCountCard`.

### TechniqueCountCard (`technique-count-card.tsx`)

v2 (H2-T5f, 2026-10-18): today's progress per technique instead of a "due
today" count, so the cards no longer repeat the "Para repasar hoy" rows.
User constraint: compact, never taller than v1 (~125px); v2 is ~118px at
1440px. The label never shares a row with the ring, so "Recordación activa"
is never truncated (user 2026-10-18).

One `next/link` card per technique, two rows:

- Top row: `IconTile` 30 (`radius="md"`, the technique's pastel tone:
  yellow / mint / pink), the full 14px label and a muted `ChevronRight`
  that nudges right on hover.
- Bottom row, left: a 28px-high value line. `emphasis="tone"`: a 26px bold
  tabular `PopNumber` in the technique's 600 shade (`warning-600`,
  `success-600`, `rose-600`) plus an optional 14px `text-fg-secondary` `valueSuffix`
  ("de 8"). `emphasis="muted"`: a 17px semibold `text-fg-secondary` phrase
  ("Sin repasos hoy", "Aún no generas", "—"). Under it the 12.5px `text-fg-secondary`
  sub line (truncates); secondary text uses `fg-secondary`, not
  `fg-muted`, for legibility (user 2026-10-18).
- Bottom row, right: `ProgressRing` 46px (stroke 4) in the technique
  shade. Centre: the percentage (11px semibold `text-fg`), a lucide `Check` (day
  done, full ring) or a muted dash.

Surface unchanged: `technique-glow-{yellow,mint,pink}` from the top-left,
`rounded-xl`, `border-border-subtle`, `shadow-xs`; hover lifts
(`-translate-y-0.5`, `shadow-card-hover`, `border-border-default`); visible
focus ring.

- Props: `href`, `icon` (lucide component), `tone: "yellow" | "green" |
  "rose"`, `label`, `value: string`, `valueSuffix?: string | null`,
  `emphasis: "tone" | "muted"`, `sub`, `ring: { percent; center:
  "percent" | "check" | "dash" }`, `ariaLabel` (full link name; the ring
  is aria-hidden), `delay?`, `className?`.

Used by: `home/technique-counts.tsx` (Flashcards → `/flashcards`,
Recordación activa → `/active-recall`, Exámenes → `/exams`), which maps
`home/technique-progress.ts` onto the props. The counts are study UNITS
(H2-T5i, user decision 2026-10-18): one unit is one page × technique, the
same unit as a "Para repasar hoy" row, so five exams due read "0 de 5",
never "0 de 100" questions. Pending = pages with an item of the technique
due today; done = pages with a review of the technique logged today (local
day of the profile zone) and nothing of it still due — a partially
reviewed page stays pending only. Both come from scheduling
`getTechniqueOverview` (`pendingUnits`, `doneUnits`). States (total = done
+ pending):

| State | Value | Sub | Ring | Link name |
|---|---|---|---|---|
| progress (pending > 0) | "{done}" + "de {total}" | "repasos hechos hoy" | done/total (floored), % inside | "{Label}: {done} de {total} repasos hechos hoy" |
| done (pending 0, done > 0) | "Al día" | "{done} de {done} repasos hechos hoy" | full, check | "{Label}: al día, {done} repasos hechos hoy" (singular at 1) |
| none (nothing today, items exist) | "Sin repasos hoy" (muted) | "Próximo repaso: mañana" / "el lunes 20" / "Nada agendado" | empty, dash | "{Label}: sin repasos hoy, próximo repaso {label}" |
| never (no items) | "Aún no generas" (muted) | "Genera desde una página" | empty, dash | "{Label}: aún no generas contenido" |
| unknown (the overview read failed) | "—" (muted) | "No pudimos cargar tu progreso" | empty, dash | "{Label}: progreso no disponible" |

Home renders the three cards under a visible "Tu progreso de hoy" heading
(17px semibold `text-fg`, `mb-3.5`, same as "Continúa donde lo dejaste"),
so progress reads apart from "Repasar hoy" (user 2026-10-18).

### ProgressRing (`progress-ring.tsx`)

Small static SVG progress ring (server-renderable, no motion): a track
circle (`trackClassName`, default `text-neutral-150`) and an arc
(`indicatorClassName`, a text-* token class; both stroke `currentColor`)
that starts at 12 o'clock and reads clockwise. The arc uses
`pathLength={100}` so `stroke-dasharray` is the percentage itself; no arc
is drawn at 0 (a round cap would leave a dot). `value` is clamped to
0–100 and NaN reads 0. Children are centred inside. Always `aria-hidden`:
the surrounding control carries the accessible name.

- Props: `value`, `size?` (px, default 46), `strokeWidth?` (default 4),
  `indicatorClassName?`, `trackClassName?`, `className?`, `children?`.

Used by: `TechniqueCountCard`. (The dashboard's `DashedRing` stays the
large labelled gauge with its own `role="img"`.)

### StreakWeek (`streak-week.tsx`)

Client atom, the day-streak block at the bottom-left of the Home hero
(v3, 2026-10-18). References: Duolingo's lit flame + week bar, habit
check-in pills with a "today" marker, GitHub-style streak chains.

- Header: a 40px flame tile, dormant at 0 (`neutral-100` / `neutral-400`)
  and lit with a streak (`warning-100` → `pastel-orange` vertical gradient,
  `warning-600` stroke, `warning-500/45` fill). Next to it a 28px bold
  tabular streak number with "días seguidos" / "día seguido" (14px
  `text-fg-secondary`; the full `streakLabel` is `sr-only`), and the 13px
  helper line under it.
- Week: `<ol aria-label="Últimos 7 días">`, a 7-column grid of 28px day
  circles over 12px initials. A reviewed day is a `warning-500` circle with
  a white `Check` (`data-part="check"`). Consecutive reviewed days are
  joined by a 4px `warning-500/40` bar (`data-part="link"`), so a run reads
  as a chain. A past day without reviews is `neutral-150`. Today without a
  review is a dashed `warning-500/70` target ring; reviewed, it adds a
  `ring-warning-500/30` halo. Each item has `sr-only` text ("domingo (hoy):
  sin repasos").
- Milestone: `milestoneHint(streakDays)` → "N días más para tu primera
  semana" / "para llegar a 30" / "para llegar a 100" (12px `warning-700`),
  hidden at 0 and past 100.
- Card: `data-state="dormant" | "lit"`. Dormant: plain bordered card. Lit:
  `border-warning-500/25`, a faint `warning-50` wash from the top-left and a
  warm glow (`shadow-lg shadow-warning-500/15`). `px-4 py-3.5`,
  `max-w-[380px]`.
- Motion, once: reviewed days pop in left to right (50ms apart, spring) and
  their links draw after them. Then the flame flickers on once (0.6s scale +
  rotate keyframes), and today's target ring pulses outward twice and stops.
  Under prefers-reduced-motion only the transitions change (zero duration),
  never `initial`. No new colour tokens: the warm tones are `warning-*` plus
  `pastel-orange`.
- Props (unchanged contract): `streakDays`, `days: { key, initial, name,
  studied, isToday }[]` (oldest first), `helper`, `className?`.

Used by: `home/home-hero.tsx`, fed by analytics `getDashboardTechniqueMetrics`
over the last 7 local days (`overall.streakDays` + `daily`), via
`home/streak-week-days.ts` (Spanish initials L M M J V S D). The helper copy
depends on the streak (`home/home-copy.ts`): none → start one; today not
reviewed yet → keep it; 1 → good start; 2–6 → keep going; 7+ → great
consistency.

### ReviewRow (`review-row.tsx`)

An action row: leading `icon` node, a 15px semibold `text-fg` title over a
13px `text-fg-secondary` meta line (flex, truncating), an optional `badge`,
and a solid near-black `Button` (`asChild` → `next/link`, `h-9`,
`rounded-input`, 13px) on the right. Row: `rounded-xl`, bordered,
`bg-card`, `px-4 py-3`, `shadow-xs`; hover lifts 1px and firms the border
(`shadow-card`, `border-border-default`).

`layout="tile"` (H2-T5n, user 2026-10-18, reference: a course list with a
round logo, bold name, muted provider line and a chevron; replaces the
earlier stacked/list/outlined looks): the whole tile is one `next/link`
named by `actionAriaLabel` (`data-layout="tile"`), `rounded-2xl`, `py-3 pr-4 pl-3.5`, white
`bg-card`, neutral `border-border-subtle` (`border-border-default` on
hover), `shadow-xs`, hover lifts a pixel with `shadow-card`, visible focus
ring. The `icon` (Home: a round `IconTile` 40, `radius="full"`, technique
pastel), the page title (13.5px semibold, `line-clamp-2`) over the `meta`
(12px `text-fg-muted`, one line, truncates: the notebook name) and a
`ChevronRight` that nudges right on hover. `actionLabel` and `badge` are
not rendered.

- `icon`, `title`, `meta?` (node; required visually by `inline`), `badge?` (node), `href`, `actionLabel`,
  `actionAriaLabel` (full name, since every row says "Repasar"),
  `layout?: "inline" | "tile"`, `className?`.

Used by: `home/review-today.tsx` — one row per page × technique due
(`toReviewRows` in `calendario/_lib/today-rows.ts`, same `TECHNIQUES` hrefs
as the calendar "Hoy" chips: flashcards `?repasar=1`, recall, exam), in the
tile layout, one link tile per page × technique: the technique's round
icon, the page title and its notebook, and a chevron (user 2026-10-18).
The section is a bordered card (`rounded-xl`, `border-border-subtle`,
`bg-card`, `p-5`, `shadow-xs`) headed "Repasar hoy" in 22px bold
`text-primary-600`, sentence case like the other Home headings (capitals
tried and dropped, user 2026-10-18), with the 13px subtitle "Los repasos programados para hoy
que aún tienes pendientes. Elige uno y empieza." The tiles sit directly on
the card (no grey panel: user 2026-10-18). On `lg` the card is
absolutely positioned inside its grid cell (`lg:absolute lg:inset-0`, the
cell spans the three left rows), so it ends exactly where Temas débiles
ends and never sets the grid's height; a long list scrolls inside it. No footer message and no item total (user
2026-10-18); the empty state is a compact tinted `EmptyState` (`px-4
py-5`, `IconTile` 36).

### ForgettingCurve (`forgetting-curve.tsx`)

Decorative backdrop for Home's "Continúa donde lo dejaste" cards (Phase 8
H2-T5r, user 2026-10-18; picked over seven other background studies). It
draws the Ebbinghaus forgetting curve, the science behind spaced
repetition: retention `e^(-t/40h)` over 7 days, left (just edited) to
right, in a band from 8% to 95% of the card's height: it starts near the
card's top-left corner and the card nudges its title right (`pl-7`) to
clear it (no visible notebook since H2-T5s, user 2026-10-18). A 2.25px `primary-500` line at 55% opacity
(`vector-effect: non-scaling-stroke`) over a `primary-100` fill fading
down, and a "now" marker (`size-2.5` `bg-primary-500`, `ring-4
ring-primary-200/70`) placed by the hours since the page was edited, kept
5% from the card's sides. Motion: the curve wipes in left to right once
(clip-path, 0.6s, `cubic-bezier(0.23,1,0.32,1)`; `pathLength` dashes break
with the non-scaling stroke) and the marker springs in at 0.5s; under
reduced motion only the transition changes. `aria-hidden`. Client leaf
(`motion/react`); the pure `forgettingCurve(elapsedHours)` gives the
points and marker in a 100 x 100 box.

- Props: `elapsedHours`, `className?`.

### PageLinkCard (`page-link-card.tsx`)

A link card restyled in H2-T5q after kokonutui's "Widget Grid" cards (user
2026-10-18, no icons): the whole card is one `next/link` with an explicit
`ariaLabel` (page and notebook, since the visible text is split across
lines). `rounded-2xl`, bordered `bg-card`, `p-4 pt-3`, `min-h-[96px]`,
flex column: an optional `h-7` meta header (12px `text-fg-secondary`,
`data-part="meta"`; Home shows none since H2-T5s, user 2026-10-18), the
page title below it (or at the top, `pt-1`, without meta) (15px semibold `text-fg`,
`line-clamp-2`), and an optional 11px `text-fg-muted` trailing label
pinned to the bottom-right corner (`data-part="trailing"`, `mt-auto
self-end`, tabular numbers). Hover lifts 2px with a soft layered shadow
(`0 18px 36px -16px` at 16% + `0 6px 12px -8px` at 8%) and
`border-border-default`, easing `cubic-bezier(0.23,1,0.32,1)` over 300ms;
focus shows the shared `ring-3 ring-ring/50`.

- `href`, `title`, `titleClassName?`, `meta?` (node), `trailing?` (node), `backdrop?` (node:
  a decorative layer rendered `aria-hidden` behind the content, the card
  being `relative isolate overflow-hidden`), `ariaLabel`,
  `className?`.

Used by: `home/continue-reading.tsx` — Home's "Continúa donde lo dejaste"
(Phase 8 H2-T5h), under the technique cards in the main column (H2-T5j): up to 4 of
notebooks' `getHomeOverview().recentPages` (newest edit first), each linking
to `/notebooks/{nb}/pages/{id}`, with the notebook name as a neutral
chip as meta (`bg-neutral-100 text-fg-secondary`, `rounded-full px-2
py-0.5`, 11.5px medium, truncates; no notebook colour and no icons, user
2026-10-18) and "Editada {formatTimeAgo}" as the trailing
label in the bottom-right corner (`self-end`, so it never crowds the
title); an empty title reads "Sin título". A 2-column grid from `lg`,
stacked below. Empty: one muted line, "Aún no abriste ninguna página."

### "Temas débiles" column (`home/weak-topics.tsx`)

Route component, not an atom: a bordered `bg-card` `rounded-xl` `p-5`
card (h2 + one-line description), last in Home's wide main column since
H2-T5j, listing up to 5 weak pages as links in a two-column grid from `sm`
(`/notebooks/{nb}/pages/{id}`): semibold title with the accuracy %, notebook
dot + name, and a `ProgressBar` with an `aria-label` (% and number of
answers). Two severities (`accuracySeverity`): under 40% → `error-600` text
/ `error-500` fill; 40–69% → `warning-700` / `warning-500`. Empty: a small
`IconTile` composition (neutral `Target` tile flanked by tilted mint
`Brain` and pink `FileCheck` tiles — the two techniques that feed it) next
to "Aún no hay temas débiles" and its hint, one compact `neutral-50` row
(`data-part="empty"`, no tall empty area). Data: analytics `getHomeWeakTopics`.
