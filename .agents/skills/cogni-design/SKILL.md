---
name: cogni-design
description: Use when designing or implementing any UI for Cogni — pages, components, screens, editor blocks, study session players, calendar, dashboard, auth, app shell, or throwaway HTML mocks. Ensures visual consistency with the Cogni design system in docs/design-system/.
user-invocable: true
---

# Cogni Design System

## Overview

Cogni's brand: **warm-grey canvas + white surfaces + violet accent**, DM Sans typography, JetBrains Mono for code, very subtle shadows, generous radii (16–20px), Lucide icons at 1.5–1.75 stroke. UI copy is Spanish with "tú", sentence case, no emoji except user-chosen notebook icons.

Source of truth for visuals: `docs/design-system/` in this repository. Source of truth for product, architecture and phases: `docs/documento-maestro.md`. When the two disagree, the master document wins. The design system only decides how things look.

## When to Use

Any visual or UI work for Cogni:

- New routes or screens (App Router pages, marketing, auth flows)
- Components (cards, buttons, inputs, sidebar items, stat tiles, editor blocks, session players)
- Editor highlight colors and callout styles
- Throwaway HTML mocks for review
- Editing existing UI to match the brand

**Do NOT use for:** domain logic, server actions, database schema, AI routing, spaced repetition rules. Those belong to the codebase and the master document.

## How to Use This Skill

1. Read `docs/design-system/README.md` for visual foundations: tone, color system, typography, layout, spacing, radii, shadows, animation, iconography, copy style.
2. Reference `docs/design-system/colors_and_type.css` for drop-in CSS custom properties: color primitives, semantic tokens, typography, spacing, radii, shadows, transitions, layout vars (sidebar 240px, topbar 52px), dark-mode override.
3. Browse `docs/design-system/preview/` for 13 component preview HTMLs. Copy markup directly.
4. Browse `docs/design-system/ui_kits/app/` for 10 full-screen reference HTMLs. They are an aesthetic guide, not a contract. Some screens show features that are out of scope (schedule generator, achievements, search, workspaces); take only layout and style from them.
5. Never derive features, modules, data or phases from this folder. If a UI task needs a product decision, read `docs/documento-maestro.md` or ask.

## Core Tokens (Quick Reference)

| Token | Value |
|-------|-------|
| Canvas (outer bg) | `#EDEAE4` warm grey — never pure white, never cool slate |
| Sidebar bg | `#FAFAF8` |
| Card / content bg | `#FFFFFF` |
| Border (subtle) | `#EDEAE4` / (light) `#E5E2DC` |
| Text primary | `#1C1917` |
| Text muted | `#A8A29E` |
| Primary button | `#1C1917` near-black (NOT violet) |
| Accent (violet) | `#7C3AED` / `#8B5CF6`, light `#F5F3FF`, active text `#6D28D9` |
| Success / Warn / Error / Info | `#10B981` / `#F59E0B` / `#EF4444` / `#3B82F6` |
| Font | `"DM Sans"` body, `"JetBrains Mono"` code |
| Type scale | 14px base; 11px uppercase section labels; headings 20–36px |
| Radii | inputs 10px, buttons 10–12px, cards 16px, content area 20px, pill 9999px |
| Sidebar width | 240px expanded / 64px collapsed |
| Topbar height | 52px |
| Card padding | 20px (default) |
| Content padding | 32px |
| Shadow scale | xs `0 1px 2px rgba(0,0,0,.04)` → lg `0 8px 24px rgba(0,0,0,.1)` (very subtle) |
| Transition | 200ms `cubic-bezier(0.4, 0, 0.2, 1)` default; 500ms flashcard flip |

## Editor Highlight Palette

Text highlights and callouts in the editor use the pastel palette. Each has a `-fg` variant for accessible text on top of it:

| Name | Background | Foreground |
|------|-----------|------------|
| pink | `#FDDEE6` | `#9B2C4A` |
| green | `#D5F5E3` | `#1B7A43` |
| yellow | `#FEF3C7` | `#92400E` |
| purple | `#E9E0FD` | `#5B21B6` |
| orange | `#FFE4D6` | `#C2410C` |
| blue | `#DBEAFE` | `#1E40AF` |
| mint | `#D1FAE5` | `#065F46` |

Callout kinds map to colors: idea → yellow, note → blue, warning → orange.

## Signature Patterns

- **App shell:** warm-grey canvas behind a 20px-radius white content area; 240px white sidebar with 11px uppercase section labels; sticky topbar with `backdrop-filter: blur(12–16px)`.
- **Sidebar nav-item active state:** light violet bg `#F5F3FF` + violet-700 text `#6D28D9` + 10px radius.
- **Stat card:** white, 16px radius, 30px pastel icon-circle, 28px value + hint + thin progress bar.
- **Notebook card:** 44px icon (user-chosen emoji in pastel-bg square), `translateY(-2px)` on hover.
- **Flashcard:** 3D flip 0.55s, violet back face, 4 rating buttons (Otra vez red / Difícil amber / Bien green / Fácil violet) with pastel bg + 1.5px border.
- **Auth screens:** split-panel — dark `#1C1917` left with radial-gradient violet glows + warm `#FAFAF8` right form panel.
- **Study panel:** right sidebar next to the editor listing the three techniques with a "Generar" action each, NotebookLM style.

## Copy Rules

- Spanish "tú", sentence case for headings and buttons (Title Case only for "Cogni").
- CTAs use action verbs: "Comenzar ahora", "Generar flashcards", "Ver respuesta".
- Errors are friendly and actionable: "El email ya está registrado. ¿Quieres iniciar sesión?"
- Empty states encourage: "Aún no tienes cuadernos. Crea uno para empezar."
- Numbers as digits (12 días, 45 tarjetas).
- No emoji in UI except user-chosen notebook icons.

## Iconography

- **Lucide Icons** only. 1.5–1.75 stroke, rounded caps, `currentColor`.
- Sizes: 16px inline / 20px button-nav / 24px default / 32px feature.
- Common map: home, `bar-chart-3` dashboard, calendar schedule, layers flashcards, brain active recall, `file-check` exams, settings, `circle-user`, plus, `trash-2`, pencil, flame streak.

## Output Modes

- **Production code:** apply tokens via Tailwind + shadcn/ui. Map CSS custom properties from `colors_and_type.css` into `src/app/globals.css` using Tailwind `@theme`. Server components by default.
- **Throwaway artifact (HTML mock):** copy markup from `preview/` or `ui_kits/app/` and link `colors_and_type.css` directly.

## Red Flags

- Cool slate greys — wrong palette, use warm stones
- Pure white outer background — should be `#EDEAE4` warm canvas
- Violet primary buttons — primary buttons are near-black; violet is for accent
- Heavy or dramatic shadows — keep them very subtle
- Tight radii (4–8px) on cards — cards are 16px, content area 20px
- Emoji in UI other than notebook icons
- Title Case headings — sentence case only
- English copy in app surfaces — Spanish "tú"
- "StudyPlatform" anywhere — the product is Cogni
- "Workspace" anywhere — the concept is "cuaderno" (notebook)
- Features from the old inventory (achievements, Google Calendar, search) — out of scope
