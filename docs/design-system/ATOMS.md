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
anatomy).

- `TechniqueCard`: icon tile (`IconTile` size `"30"` — closest existing
  token to the reference's 32px — radius `"md"`) + name + description, a
  muted meta line, and a disabled action `Button` + `Pill` "pronto". The
  button stays the technique's tone color at `disabled:opacity-50` (Button's
  own disabled state) rather than going fully gray, so the panel still
  "reads colourful and alive" while every action is inert (no technique is
  built yet).
- `TechniqueIconStrip`: the collapsed-state 36x36 tinted tile (`IconTile`
  size `"36"` radius `"input"`) with a native `title` tooltip; `opacity-35`
  when `available` is false (default).
- `TechniqueTone`: `"primary" | "green" | "pink"` — mapped onto **existing**
  `IconTile`/`Pill` tones, not new ones. `primary` (violet) already matches
  the reference's flashcards brand color; `green`/`pink` already match its
  active-recall/exam hex pairs almost exactly (`pastel-pink-fg` is an exact
  match for the reference's exam color). No new tone was needed.
- `href?: string` (Flashcards design preview, 2026-09-24): when set,
  `TechniqueCard` renders an enabled `Button asChild` + `Link` in place of
  the disabled button + "pronto" `Pill`, for a technique whose screens now
  exist. Only the Flashcards entry (`techniques.ts`) sets it, to `/flashcards`;
  Active recall/Exámenes are untouched and stay disabled.

Used by: `techniques-panel.tsx`.

**Preview gate.** The "Técnicas" panel advertises flashcards, active recall
and exams, which are sample-data previews until their routes land. The page
route (`pages/[pageId]/page.tsx`) computes `designPreviewsEnabled()` on the
server and only renders `TechniquesPanel` when it is true, so production
shows no panel and the layout's `display: contents` slot adds no space.

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

<<<<<<< HEAD
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
=======
## Flashcards design preview (2026-09-24)

Six new atoms for the `/flashcards` design-preview screens (user decision:
"solo vamos a construir esas pantallas para validar el diseño" — sample
data only, no backend). Style source:
`studyplatform-flashcards-style.md` (StudyPlatform's built flashcards
screens) plus `docs/design-system/screenshots/flashcard.png`/`flashcard2.png`
for the session mockup. `Pill` and `IconTile`'s existing `success`/
`warning`/`error` tones already covered everything the report needed — no
new `Pill` tones were required (only the `IconTile` `"48"` size above).

### DeckSummaryCard (`deck-summary-card.tsx`)

Hub grid item (one per notebook that has decks): a pastel-toned header
(`HEADER_BG`, keyed by `NotebookColor` — always that notebook's own color)
with a translucent `IconTile` (`size="48"`, `bg-white/[55%]` override) and a
red due-count badge, then a body with the notebook title and a
due/al-día meta line (`text-error-600`/`text-success-600`).

- `href`, `tone: NotebookColor`, `title`, `cardCount`, `dueCount`.

Used by: `flashcards/page.tsx` (hub).

### DeckCard (`deck-card.tsx`)

Deck grid item (one per deck on a notebook's `/flashcards/[notebookId]`
list): a fixed 200px-tall link card with a cycling `DeckTone` border (13%
alpha) and icon tile (14% alpha), a due/al-día status `Pill`, a centered
two-line-clamped label and a footer card count.

- `DeckTone`: `"warning" | "info" | "success" | "orange" | "pink"` — the
  report's amber/blue/green/orange/pink `DECK_COLORS` cycle, mapped onto
  existing warning/info/success/pastel-orange/pastel-pink tokens instead of
  new hex literals. Assigned by position in the notebook's deck list.
- `href`, `tone`, `label`, `cardCount`, `dueCount`.

Used by: `flashcards/[notebookId]/page.tsx`.

### StatDots (`stat-dots.tsx`)

The session header's live rating tally: 4 fixed-order dot+count pairs
(again `error-500`, hard `warning-500`, good `success-500`, easy
`primary-600`).

- `counts: { again, hard, good, easy }` (numbers).

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

The session-complete panel: 🎉 + "¡Sesión completada!" + a 4-cell
Again/Hard/Good/Easy stats grid (Spanish sub-labels — Otra vez/Difícil/
Bien/Fácil, both here and on `RatingButton`) + a "Próxima revisión" panel +
"Volver al mazo"/"Repasar de nuevo →" actions (`Button` outline/default).

A **plain fixed overlay**, not Cogni's Radix `Dialog` (`dialog.tsx`):
`DialogContent` always renders its own hardcoded `DialogOverlay`
(`bg-black/10`, no blur, `sm:max-w-sm`) with no prop to reach the darker/
blurred overlay or the 520px panel the mockups call for, and editing the
shared `Dialog` atom was out of scope for this design-only pass — the
task's own fallback clause covers this case.

- `deckLabel`, `reviewedCount`, `nextReviewCount`, `stats: { again, hard,
  good, easy }`, `backHref`, `onRestart`.

Used by: `flashcards/_components/flashcard-player.tsx`.
>>>>>>> 8155767 (feat(flashcards): design preview of the hub, deck list and flip-card session with sample data)
