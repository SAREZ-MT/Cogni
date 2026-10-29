# Cogni — Design System

**Product:** Cogni — Plataforma Web de Estudio con IA  
**Version:** 1.0  
**Date:** 2026-04-20  

---

## Scope of this folder

> **This folder decides only how Cogni looks.** Colors, typography, spacing, radii, shadows, motion, icons, component appearance and UI copy tone. Nothing here defines features, modules, data, architecture, versions or phases. Product, scope and architecture live in `docs/documento-maestro.md`, and when anything in this folder seems to say otherwise, the master document wins.
>
> The reference screens in `ui_kits/app/` and `screenshots/` were drawn before the product was finalized. Some show ideas that are out of scope today. Use them for layout and style only.

**Tone:** Friendly but professional. Educational without being patronizing. Motivating without being pushy.  
**Language:** Spanish "tú" in every UI surface.

---

## CONTENT FUNDAMENTALS

### Copy Style
- **Tone:** Warm, encouraging, clear. Uses "tú" (informal Spanish).
- **Casing:** Sentence case for headings and buttons. Title Case only for brand name "Cogni".
- **CTAs:** Action-oriented verbs: "Comienza gratis", "Generar flashcards", "Ver respuesta"
- **Error messages:** Friendly and actionable: "El email ya está registrado. ¿Quieres iniciar sesión?"
- **Empty states:** Encouraging: "Aún no tienes cuadernos. Crea uno para empezar."
- **Emoji:** NOT used in UI. Reserved only for notebook icons chosen by the user.
- **Numbers:** Use digits (12 días, 45 tarjetas), not spelled out.

### Examples
- Hero: "Estudia de forma inteligente, no más difícil"
- Subheading: "Flashcards con repetición espaciada, Active Recall y exámenes de práctica — todo potenciado por IA"
- Button: "Comenzar ahora"
- Empty state: "No hay tarjetas pendientes para hoy. ¡Buen trabajo!"

---

## VISUAL FOUNDATIONS

*Based on Aceagency/Techerly reference designs provided by the user.*

### Color System
- **Primary:** Violet (#8B5CF6 / #7C3AED) — used for active sidebar items, accent buttons, focus rings
- **Primary variants:** Light (#F5F3FF), Medium (#C4B5FD), Dark (#6D28D9)
- **Neutrals:** Warm gray/stone scale — NOT cool slate. Background (#F5F3EF), borders (#E5E2DC), text (#1C1917)
- **Pastel event palette:** Soft pink (#FDDEE6), green (#D5F5E3), yellow (#FEF3C7), purple (#E9E0FD), orange (#FFE4D6), blue (#DBEAFE), mint (#D1FAE5) — used for event blocks, tag chips, category indicators
- **Semantic:** Success (Emerald #10B981), Warning (Amber #F59E0B), Error (Red #EF4444), Info (Blue #3B82F6)
- **Primary buttons:** Black/near-black (#1C1917) — NOT violet. Violet is for accent buttons only.
- **Dark mode:** Deep navy (#1A1B2E) background, dark card (#2A2B42)

### Typography
- **Font family:** "DM Sans" (Google Fonts) — clean, geometric, professional
- **Mono:** "JetBrains Mono" — for code blocks in editor
- **Scale:** 14px base body, headings 20-36px
- **Weights:** 400 (body), 500 (labels/nav), 600 (subheadings), 700 (headings/display)
- **Section labels:** 11px, weight 500, uppercase, muted color (#A8A29E)
- **Editor density (Notion-like):** `.editor-content` keeps the type scale above (no new tokens) but sits tight: 1.5 line height and 2px of padding above and below each text block (~4px between neighbours), lists and task items with no extra margins, and the room above headings instead (h1 2rem, h2 1.5rem, h3 1.25rem). Quotes are a 3px ink bar with upright ink text; callouts are a soft tint of their pastel with ink text and a kind-coloured icon.

### Layout & Structure (from reference)
- **Outer background:** Warm gray (#F5F3EF) — the "canvas" behind the content
- **Content area:** White, with LARGE border-radius (20px) — sits within the warm gray canvas
- **Sidebar:** White, fixed left, with grouped sections labeled in small muted uppercase
- **Sidebar collapsed:** Icons only (64px wide), with tooltip labels
- **Top bar:** Inside content area, breadcrumbs left, action icons right (bell, chat, search)
- **Collapse button:** Chevron in circle on sidebar edge

### Spacing
- **Base unit:** 4px
- **Scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- **Content padding:** 32px
- **Card padding:** 20px default
- **Sidebar width:** 240px expanded, 64px collapsed

### Borders & Radius
- **Content area:** 20px radius (very rounded, signature of this style)
- **Cards:** 16px radius, 1px warm gray border (#E5E2DC)
- **Buttons:** 10-12px radius, pill (9999px) for some CTAs
- **Inputs:** 10px radius
- **Avatars:** Full circle (9999px)
- **Sidebar items:** 10px radius for hover/active background
- **Border color:** Warm gray (#E5E2DC light, #EDEAE4 subtle)
- **Editor (exception):** the page editor uses square, professional corners — `--radius-editor` (3px) — on its surfaces and blocks: bubble and table toolbars, slash menu, block menu, colour and highlighter popovers, callouts, code blocks, tables, images, mentions, inline code and highlights. Shared atoms keep their app-wide radius; the editor opts in with the `editor-surface` class (`src/app/globals.css`).
- **Editor content (H7):** highlights are a marker-pen stroke in the highlighter colours (`--color-highlighter-*`, the -300 step, ink text on top, uneven edges, `box-decoration-break: clone`); callouts use the landing pillar band hues at the -200 step (idea yellow, note violet, warning rose) with an italic label by kind; code blocks sit on neutral grey (`--color-code-block`); tables are the one rounded editor block (`--radius-table`, 8px) with tabular figures and right-aligned numeric cells; H1/H2/H3 step down in size, weight, tracking and space above. The "Texto" menu offers Inter, Bitter, JetBrains Mono (self-hosted via `next/font`) and Arial, Times New Roman, Georgia, Verdana (system stacks) at 14/16/18/22/28px.

### Shadows
- **Very subtle** — almost no visible shadows in the reference
- xs: `0 1px 2px rgba(0,0,0,0.04)` — inputs
- sm: `0 1px 3px rgba(0,0,0,0.06)` — cards
- md: `0 4px 12px rgba(0,0,0,0.08)` — dropdowns
- lg: `0 8px 24px rgba(0,0,0,0.1)` — modals
- The main content area has subtle depth against the warm bg, primarily via border + slight shadow

### Backgrounds
- Warm gray canvas — NO pure white or cool gray for the outer shell
- Cards and content: pure white
- No gradients on surfaces
- No full-bleed images in app
- Progress bars may use multi-color gradients (red→amber for goals)

### Animation & Transitions
- **Duration:** 150ms (micro), 200ms (default), 300ms (panels), 500ms (flashcard flip)
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` default
- **Flashcard flip:** 3D perspective transform, 500ms
- **Hover:** Background color shift (neutral-50 → neutral-100)
- **Press:** Subtle scale(0.98) on buttons

### Hover & Press States
- **Sidebar items:** Background shifts to neutral-50, text darkens
- **Active sidebar:** Light violet background (#F5F3FF), violet text (#6D28D9)
- **Buttons:** Background darkens slightly
- **Cards:** Border color shifts warmer
- **Links:** Underline on hover

### Cards (from reference)
- White background, 1px warm border (#E5E2DC), 16px radius
- NO colored left-border accents
- Pastel icon circles (28px, rounded 8px) with category colors
- Progress bars below stats with distinct colors per metric

### Imagery
- No stock photos in app
- User avatars: circular with fallback to colored initials (2-letter abbreviation)
- Notebook icons: user-chosen emoji

---

## ICONOGRAPHY

### Approach
- **Icon set:** Lucide Icons (CDN) — consistent with shadcn/ui ecosystem
- **CDN:** `https://unpkg.com/lucide-static@latest/font/lucide.min.css`
- **Style:** 24px default, 1.5px stroke weight, rounded line caps
- **Sizes:** 16px (inline/compact), 20px (buttons/nav), 24px (default), 32px (feature highlights)
- **Color:** Inherits text color (currentColor)
- **No emoji in UI.** No hand-drawn SVGs. No custom icon font.
- Notebook icons are user-chosen emoji stored as text, displayed in 20px within sidebar items.

### Key Icons Used
- Home: `home`
- Dashboard: `bar-chart-3`
- Schedule: `calendar`
- Flashcards: `layers`
- Active Recall: `brain`
- Exams: `file-check`
- Search: `search`
- Settings: `settings`
- User: `circle-user`
- Add: `plus`
- Delete: `trash-2`
- Edit: `pencil`
- Streak/Fire: `flame`
- Check: `check`
- Close: `x`
- Menu: `menu`
- Chevron: `chevron-right`, `chevron-down`
- Google: Custom SVG (brand logo)

---

## FILE INDEX

```
docs/design-system/
├── README.md                    ← This file (visual foundations only)
├── colors_and_type.css          ← CSS custom properties (tokens)
├── assets/
│   └── logo-placeholder.svg
├── preview/                     ← 13 component preview HTMLs
├── screenshots/                 ← Reference screenshots (style only)
└── ui_kits/app/                 ← 10 full-screen reference HTMLs (style only)

Agent skill: .agents/skills/cogni-design/SKILL.md
Product and architecture: docs/documento-maestro.md
```
