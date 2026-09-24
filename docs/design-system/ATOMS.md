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
- `tone`: `neutral | muted` + the same pastel/semantic tones as `IconTile`.
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
- Anatomy: icon tile (`IconTile` size `"30"` — closest existing token to the
  reference's 32px — radius `"md"`) + name + description, then one
  full-width `Button` reading "Generar" with a leading `Sparkles` icon
  (12px, strokeWidth 2). The button is a **solid** tone-colored fill with
  white text (`bg-primary-600`/`bg-success-600`/`bg-pastel-pink-fg`, not the
  pastel `IconTile` pair) — matching studyplatform's `ActiveRecallCard`/
  `ExamCard` buttons (`#059669`/`#9B2C4A`, both exact token matches) — kept
  at `disabled:opacity-60` + `disabled:cursor-not-allowed` (explicit
  `disabled:` variants so they replace, not stack with, Button's own
  `disabled:opacity-50`) instead of going fully gray, so the panel still
  "reads colourful and alive" while every action is inert. Disabled cards
  also get `aria-disabled` and `title="Disponible pronto"`.
- `TechniqueIconStrip`: the collapsed-state 36x36 tinted tile (`IconTile`
  size `"36"` radius `"input"`) with a native `title` tooltip; `opacity-35`
  when `available` is false (default). Unchanged by this pass.
- `TechniqueTone`: `"primary" | "green" | "pink"` — mapped onto **existing**
  `IconTile` tones for the icon tile, and onto `primary-600`/`success-600`/
  `pastel-pink-fg` for the solid button fill. No new tone was needed.

Used by: `techniques-panel.tsx`.

**Preview gate.** The "Técnicas" panel advertises flashcards, active recall
and exams, which are sample-data previews until their routes land. The page
route (`pages/[pageId]/page.tsx`) computes `designPreviewsEnabled()` on the
server and only renders `TechniquesPanel` when it is true, so production
shows no panel and the layout's `display: contents` slot adds no space.

## StudyItemRow (`study-item-row.tsx`)

A single saved-study-item row inside the "Técnicas" panel (design/
shell-look, studyplatform `StudyPanel.tsx` "Mazos guardados" row anatomy):
a `bg-neutral-50`/`border-border-subtle` pill-radius (`rounded-[9px]`) row
with a 6px tone dot, an 11.5px/500 truncating label, a 10px muted detail
string, and a muted `ChevronRight` (10/2). The whole row is a `Link` —
clicking it goes straight to that item's study session.

- `href`, `label`, `detail` (free-form right-aligned text, e.g. "8 tarjetas
  · 5 pendientes"), `tone: "primary" | "green" | "pink"` (dot color —
  `primary-600`/`success-600`/`pastel-pink-fg`), `className?`.
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

- `label`, `items: StudyItemRowProps[]`, `className?`.

Used by: `techniques-panel.tsx`, once per technique (`Mazo de esta página` /
`Sesiones de Active Recall` / `Exámenes recientes`), below a "Generado en
esta página" title + a neutral `Pill` "Vista previa" (the section's data
comes from `flashcards/_data/sample.ts`'s `getSampleStudyItemsForPage()` —
fixed sample items, not filtered by the real page, since there's no backend
yet). The flashcards group is always at most one item: one page owns at most
one deck (product rule 2026-09-24), so "Mazo de esta página" never lists more
than the page's own deck.

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
- `href`, `tone`, `label`, `cardCount`, `dueCount`.

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
+ its AI-score breakdown, plus a "Repasar →" success `Pill`.

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
`retakePending`), the last attempt date, and a CTA that reads the page's
state ("Presentar examen" / "Repetir examen" / "Ver resultados").

- `href`, `pageTitle`, `questionCount`, `attempts`, `lastScore: number |
  null`, `retakePending`, `lastDate?`, `className?`.

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
  `explanationPending?` (default `true`), `className?`.
  `data-testid="exam-review-row"`.

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

`flashcards/_data/sample.ts`'s `getSampleStudyItemsForPage()` exam item now
points at the real preview (`/exams/biologia-celular/mitocondria`,
"Examen · 22 sept" / "10 preguntas · 60 % · repetir") instead of a
placeholder `#` href. The sidebar's "Exámenes" item is no longer disabled
(`sidebar.tsx`'s `TECNICAS_SECTION`, `href: "/exams"`,
`isActive: (path) => path.startsWith("/exams")`).
