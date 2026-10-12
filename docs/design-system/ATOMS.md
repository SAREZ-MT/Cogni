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
  (StatCard's 18px) stays `padding="none"` + a `className` override.
- `interactive`: adds the hover lift (`-translate-y-0.5` + `shadow-card-hover`).
- `asChild` (radix Slot, same pattern as `Button`): renders the styling onto
  the single child instead of a `div` — used to keep `<article>`/`<Link>`
  semantics.
- Slots: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
  `CardFooter` (shadcn-style, available for future composition).

Used by: `notebook-card.tsx` (interactive, `asChild` article), `stat-card.tsx`,
`home/ready-to-review.tsx`, `home/recent-pages.tsx`, `notebooks/page.tsx`
(list-view wrapper), `notebooks/[notebookId]/page.tsx` (interactive
`asChild` page-card Link).

## IconTile (`icon-tile.tsx`)

The pastel/semantic square behind notebook, stat and empty-state icons.

- `size`: literal pixel keys (`"28" | "30" | "36" | "40" | "44" | "48" |
  "52" | "56"`) — the real screens use distinct sizes, not a clean 5-step
  scale, so the key is the exact px value instead of an idealized
  sm/md/lg/xl/2xl. `"48"` was added for the Flashcards design preview's
  `DeckSummaryCard` header tile (studyplatform-flashcards-style.md §4).
- `radius`: `md(8px) | input(10px) | tile(14px) | xl(16px)` — independent of
  `size` (size 36 ships with both `md` and `input` radius on different screens).
- `tone`: notebook pastel pairs (`purple | pink | green | yellow | orange |
  blue | mint`, matching `NotebookColor`) plus semantic tones (`primary |
  neutral | success | warning | error | info`).

`notebookToneFromColor(color)` (in `_components/notebook-swatches.ts`) maps a
`NotebookColor | null` straight onto an `IconTile` tone, falling back to
`"purple"` for legacy notebooks without a stored color.

Used by: `notebook-card.tsx`, `notebook-list-row.tsx`, `home/stat-card.tsx`,
`home/ready-to-review.tsx`, `home/weak-topics.tsx`, `app/(app)/page.tsx`,
`notebooks/page.tsx`, `notebooks/[notebookId]/page.tsx`,
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
- `SectionTitle`: in-card section heading — 14px/600 by default; passing
  `action` switches it to 16px/600 with a right-aligned link/action row.

Used by: `home/home-header.tsx`, `notebooks/page.tsx`,
`notebooks/[notebookId]/page.tsx` (`SectionHeader`); `home/ready-to-review.tsx`,
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
pass `aria-label`, or `aria-labelledby` pointing at a visible label (StatCard
uses `useId` + the stat's label). Only a purely decorative bar may opt out with
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

Used by: `app/(app)/page.tsx` (zero-notebooks, `plain`), `notebooks/page.tsx`
(zero-notebooks, `dashed`), `notebooks/[notebookId]/page.tsx` (zero-pages,
`dashed`), `home/ready-to-review.tsx` (`success`), `home/weak-topics.tsx`
(`tinted`).

## Keycap (`keycap.tsx`)

The ⌘/H shortcut chip. Used by `nav-item.tsx` (once per key in a shortcut
array).

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
Button-composed call site (dialog actions, `CreateNotebookTrigger`'s pill,
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
  (Sidebar's size); the techniques panel passes `size={12}` to match its
  smaller reference chrome.
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

- `TechniqueCard` props: `icon`, `tone`, `name`, `description`, `disabled?`
  (default `true` — no technique is built yet), `className?`. `href`,
  `meta`, and `actionLabel` were removed: no card links anywhere anymore,
  there's no meta line, and the action's label is a fixed "Generar".
- Wired variant (Phase 3, Flashcards): pass `onGenerate` and the card becomes
  live — the button is enabled by default (`disabled` can still force it
  off, e.g. quota exhausted, without the "Disponible pronto" title, which is
  reserved for unwired cards), `pending` disables it, sets `aria-busy` and
  swaps the label to "Generando…", `generateTestId` tags the button and
  `children` render under it inside the card (the caller owns quota/notice/
  error copy). Without `onGenerate` the card behaves exactly as before.
- Anatomy: icon tile (`IconTile` size `"30"` — closest existing token to the
  reference's 32px — radius `"md"`) + name + description, then one
  full-width `Button` reading "Generar" with a leading `Sparkles` icon
  (12px, strokeWidth 2). The three buttons share every class
  (`w-full font-semibold text-[11.5px] hover:brightness-95`) except the
  technique's **soft pastel pair** (Phase 6 T5b, user decision 2026-10-06 —
  solid fills were too strong): yellow `bg-pastel-yellow` +
  `text-pastel-yellow-fg` (6.4:1), green `bg-pastel-mint` +
  `text-pastel-mint-fg` (6.8:1; chosen over `pastel-green-fg`, 4.6:1) and
  rose `bg-pastel-pink` + `text-pastel-pink-fg` (5.9:1) — every label meets
  WCAG AA at 11.5px; hover darkens the same pair (`brightness-95`), kept
  at `disabled:opacity-60` + `disabled:cursor-not-allowed` (explicit
  `disabled:` variants so they replace, not stack with, Button's own
  `disabled:opacity-50`) instead of going fully gray, so the panel still
  "reads colourful and alive" while every action is inert. Disabled cards
  also get `aria-disabled` and `title="Disponible pronto"`.
- `TechniqueIconStrip`: the collapsed-state 36x36 tinted tile (`IconTile`
  size `"36"` radius `"input"`) with a native `title` tooltip; `opacity-35`
  when `available` is false (default).
- `TechniqueTone`: `"yellow" | "green" | "rose"` (Flashcards / Recordación
  activa / Examen) — mapped onto the **existing** pastel `IconTile` tones
  `yellow` / `mint` / `pink`, the same pairs as the button, for the icon tile
  (tagged `data-part="technique-icon"`). No new token was needed.
- `TECHNIQUE_PAIR_CLASS` (Phase 7 T1): the pastel pair per `TechniqueTone`
  (`bg-pastel-yellow text-pastel-yellow-fg`, `bg-pastel-mint
  text-pastel-mint-fg`, `bg-pastel-pink text-pastel-pink-fg`), exported so
  `TechniqueChip` reuses exactly the panel's mapping; the button classes are
  derived from it (no visual change).

- `controls?` (Phase 5 T5): options of the action rendered between the
  description and the button. No card passes it since Phase 6 T5b v2:
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
need distinct hrefs.

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

Used by: `exams/_components/create-exam-dialog.tsx`.

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
page list — zero visual change on `/notebooks`.

- `value`: `"grid" | "list"`.
- `hrefFor`: `(view) => string` — builds each option's `Link` href, so the
  choice is server-rendered and persisted in that route's own `?view=` URL
  param (default grid) instead of client state.
- `className`: forwarded onto the root via `cn()`.
- Options (`aria-label` "Ver como cuadrícula"/"Ver como lista",
  `aria-current`) are fixed at two — grid/list is the only case both
  screens need — not a generic `options` prop.

Used by: `notebooks/page.tsx`, `notebooks/[notebookId]/page.tsx`.

## List-row molecules: NotebookListRow / PageListRow

`notebook-list-row.tsx` and `page-list-row.tsx` (`app/(app)/_components/`)
are the Notion/file-explorer-style rows a `ViewToggle`'s `list` option
renders inside one `Card`: a divider (`border-b border-border-subtle
last:border-b-0`), `hover:bg-hover`, an `IconTile` (size `28`, radius
`md`), a stretched-link title, a right-aligned muted meta column, a
`relative z-10` hover action (`NotebookCardActions` /
`ArchivePageButton`) so it stays clickable over the stretched link, and a
trailing muted `ChevronRight` (16/1.75). `PageListRow` reuses
`formatUpdatedAt` (`_components/format.ts`) for its "Actualizada {d MMM}"
column, the same formatter the page-card grid uses.

Used by: `notebooks/page.tsx` (`NotebookListRow`),
`notebooks/[notebookId]/page.tsx` (`PageListRow`).

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
Rows reuse the ReadyToReview divider pattern. Nothing due shows
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

### Submit confirmation — `SubmitConfirmDialog`

`ExamPlayer`'s "Entregar"/"Enviar examen" no longer submit directly: if any
question is unanswered, a confirm `Dialog` opens first ("¿Entregar el
examen?" / "Tienes {N} preguntas sin responder…", outline "Seguir
respondiendo" + rose "Entregar igual"); with everything answered, it
submits immediately as before. Built inline in `exam-player.tsx` with
Cogni's `Dialog` atom (not a separate `shared/ui` file — it's a single
call site with no reuse elsewhere, same reasoning as the plain-element
buttons documented under Button above). `data-testid=
"submit-confirm-dialog"`.

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
  Flashcards/Active recall/Exámenes), `radius=[4,4,0,0]` on the top
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

Calendar event chip (Phase 7 T1, calendar look decision 2026-10-12; the
Untitled UI month calendar's event chips): one study technique of one page,
coloured with the techniques panel's pastel pair — Flashcards yellow,
Recordación activa green, Examen rose (`TECHNIQUE_PAIR_CLASS`).

- Props: `tone` (`TechniqueTone`), `label`, `meta?` (trailing lighter detail,
  tagged `data-part="meta"`: the due count on "Hoy"; a count or time on the
  month/week grid in T2), `href?` (renders a `next/link` that opens the
  technique's session; without it a `span`), plus any HTML attribute
  (`aria-label`, `data-testid`, `className` merged via `cn()`).
- Anatomy: `rounded-md border border-current/15 px-2 py-1 text-xs
  font-semibold`, label truncates, meta `font-medium tabular-nums
  opacity-80`. Linked chips add `hover:brightness-95` and the focus ring.
- `data-slot="technique-chip"`, `data-tone={tone}`.

Used by: `calendario/_components/today-list.tsx`.

## DateBadge (`date-badge.tsx`)

Calendar card date badge (Phase 7 T1, the reference's "JAN / 10" tile): a
56px-wide bordered tile with the abbreviated Spanish month in capitals
(`OCT`, neutral-50 band, 10.5px semibold muted) over the day number (18px
bold).

- Props: `date`, `timeZone?` (IANA zone the day is read in; omitted, the
  runtime zone, like the rest of the shell), `className?` and span attributes.
- The visible parts are `aria-hidden`; an `sr-only <time datetime="YYYY-MM-DD">`
  carries the long date ("lunes, 12 de octubre").
- `data-slot="date-badge"`, parts `data-part="month"` / `"day"`.

Used by: `calendario/page.tsx`.

## SegmentedTabs (`segmented-tabs.tsx`)

Page-level segmented tabs (Phase 7 T1, the reference's "All events / Shared
/ …" row): same container as `ViewToggle`/`PeriodFilter` (`rounded-input
border bg-neutral-100 p-1`), text items `px-3 py-1.5 text-[13px]
font-semibold`, the active one `bg-card text-fg shadow-xs`.

- Props: `aria-label` (names the `<nav>`), `items` (`{ value, label, href }`
  or `{ value, label, disabled: true, hint }`), `value`, `className?`.
- Linked items are server-rendered `next/link`s (the view lives in the URL);
  the active one gets `aria-current="page"`. A disabled item is a `span`
  with `aria-disabled="true"`, `title={hint}` and `opacity-60`.
- `data-slot="segmented-tabs"`.

Used by: `calendario/page.tsx` ("Hoy" / "Semana" / "Mes"; Semana and Mes are
disabled "Próximamente" items until T2).
