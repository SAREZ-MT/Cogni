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

- `size`: literal pixel keys (`"28" | "30" | "36" | "40" | "44" | "52" |
  "56"`) — the real screens use 7 distinct sizes, not a clean 5-step scale,
  so the key is the exact px value instead of an idealized sm/md/lg/xl/2xl.
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

Thin rounded-pill track + fill. `value` (0-100, clamped), `fillClassName`
(e.g. `"gradient-streak"`). `data-slot="progress-bar"`/`"progress-fill"`
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
