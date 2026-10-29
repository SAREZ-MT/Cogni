# Phase 8 — Design and screen flows (ODD feature document)

Branch: `feat/phase-8-design-flows` (from `main` 96ed7cd). Engram mirror: `odd/phase-8-design-flows/tasks`.

## Objective
Master doc §13 "Fase 8": improve UI/UX and navigation of the built screens, consistent with `docs/design-system/` and the `src/shared/ui` atoms. No backend logic changes.

## Method (user rule, 2026-10-15)
Live iteration: `pnpm dev` running, screen by screen starting with login, visual and navigation changes reviewed by the user in the browser after each step. Pendings mapped on 2026-10-15 are parked for later (memory `cogni-phase-8-method-and-backlog`).

## Constraints
- No domain, use case, infrastructure, schema or migration changes.
- Atoms-first: visual primitives go through `src/shared/ui` + `ATOMS.md`.
- Respect `prefers-reduced-motion`; CSP allows inline styles (`style-src 'unsafe-inline'`).
- Full Playwright suite before any PR; ask before every push/PR.

## Tasks
- [ ] L1 — Login: product-themed visual for the left half (Three.js + Motion), the 5 polish items (mobile brand, "o" divider, Google icon, readable terms note, distinct sign-up link), Motion UX, polished with impeccable; kokonutui as component reference. Route: delegated (multi-file, new deps `motion`, `three`).

## Progress / evidence
- 2026-10-15: branch created; dev server on :3000; login baseline screenshots taken.
- 2026-10-15: L1 v1 implemented (uncommitted, awaiting user visual review). typecheck clean, biome ci 0 errors, depcruise 0 violations, Vitest 578/578 in (public)+identity+shared/ui. Deps: motion 14.2.0, three 0.186.1, @types/three 0.186.0. New atoms TextDivider, GoogleIcon, TextLink, BrandMark, SubmitButton; ATOMS.md (docs/design-system/ATOMS.md) entries pending.
- 2026-10-15: L1 v2 (uncommitted, awaiting review): new "synapse C" brand mark (BrandMark/BrandGlyph single source, sidebar Logo wraps it, docs/design-system/assets/logo.svg); richer constellation (depth/fog, glow halos, fat gradient lines, travelling technique-colour signals, dust, nebula, pointer parallax); ATOMS.md entries added. typecheck/biome/depcruise clean, Vitest 1303/1303 (src/app + identity + shared/ui). Follow-up: favicons still placeholder.
- 2026-10-15: bug — canvas blank in the user's Chrome after many reloads (WebGL context leak: no forceContextLoss, unreleased support probe). Fixed + context lost/restored resilience, `data-canvas-state` (loading|ready|lost|unavailable|disabled). Tests: constellation-canvas.test.tsx (10, 7 RED first), tests/e2e/auth-showcase.spec.ts (20 reloads, forced loss/restore, no context growth). Vitest 1314/1314; Playwright auth-showcase + auth 12/12 twice; parent spot check vitest (public) 27/27.
- 2026-10-15: real root cause of the blank panel: alpha-0 additive canvas discarded by the user's Chrome compositing. Fix: opaque black clear + `mix-blend-screen` on the canvas host. User confirmed lines visible live. Vitest (public) 27/27.
- 2026-10-15: cards v3–v5 (AI description card bottom-left, practice exam card, history flashcard, pastel rating colours from rating-button.tsx), stronger form fields (neutral-300 border, focus ring) on neutral-100 bg. User approved L1.
- 2026-10-15: L1 committed: 62091e6 feat(ui) atoms + brand mark, 5e76ff2 feat(auth) showcase. Pre-commit: typecheck OK, biome ci 0, depcruise 0, Vitest 3871/3871. RDD: high (hot_path auth), consent granted, 4 lenses approved, acknowledged (lineage review-7caa70caa16de95d); reviewed boundary → 5e76ff2. Advisories (non-blocking, later): auth-stack form hidden until hydration (R3/R4 WARNING), e2e corner sample may overlap a fragment (WARNING), constellation tuning constants, SubmitButton Omit comment, SubmitButton formStatus untested.

- [x] L1 — Login (route: delegated; commits 62091e6, 5e76ff2).
- [ ] L2 — Register screen (live iteration; route: inline). v1 uncommitted, awaiting user review: password hint "Mínimo 8 caracteres" (aria-describedby, also on reset), show/hide password toggle in AuthField (login too), TermsNotice `variant="sign-up"` copy, product subtitle. RED 5 observed → GREEN; Vitest identity + (public) 182/182, tsc OK, biome clean.

- 2026-10-15: L2 scope grew. The user wants a legally compliant sign-up and authorized backend changes for registration only.
  - Age policy: 18+ only.
  - Legal research is in `odd/logs/marco-legal-borrador.md`, a thesis "Marco legal" draft.
  - PAUSED until the professor confirms who the data controller is (Engram #978, topic `odd/phase-8-design-flows/register-legal`).
  - Decided: ask for a display name, not a unique @username. It fills `profiles.display_name` and is used for greetings.

- [ ] H1 — Home, simple pass (user, 2026-10-16). Phone layout is deferred.
  - Remove the inert topbar Share and Bell buttons (pending #9).
  - Rename the user-facing labels:
    - "Active recall" → "Recordación activa" (pending #2; ADR 0008 decision 14);
    - "Dashboard" → "Progreso".
  - Routes, identifiers and module names stay unchanged.
  - Route: delegated writer. About 68 label hits across src/app, src/shared/ui and tests.

## Next step
L1, then the user picks the next screen.

- 2026-10-16: H1 v1 is uncommitted, awaiting the user's review.
  - Topbar now shows only the breadcrumb and the user menu; labels read "Recordación activa" and "Progreso".
  - Writer evidence: RED 20 failed, then GREEN; tsc OK; biome ci 0 errors; Vitest src/app + src/shared/ui 1177/1177.
  - Parent checks:
    - Vitest (app)/_components 114/114.
    - Playwright dashboard + active-recall-hub + shell-empty-state: 15 passed, 2 failed.
  - shell-empty-state "split panel" failed because it expected the old neutral-50 form background (L1 drift). Fixed to rgb(245, 243, 239); now passes.
  - active-recall-hub:219 asserts an exact live AI score ("IA 5 / 5") and got 4/5. That is model nondeterminism and predates this change, so it is a backlog item.
- 2026-10-16: H1 also highlights the active technique in the sidebar with its own colour. NavEntry/NavItem take `tone`; the colours reuse TECHNIQUE_PAIR_CLASS (pastel yellow, mint and pink). RED 3 → GREEN; Vitest (app)/_components 118/118; tsc OK; biome clean. Uncommitted, awaiting review.
- 2026-10-16: H1 app canvas changed to the dry gray #E8E8E8 (first #E0E0E0, then lightened at the user's request). New token `--color-gray-dry`; `--bg-app` points to it. `neutral-150` stays as border-subtle. Also updated: the docs colors_and_type.css bg-app and the e2e canvas assertion rgb(232,232,232), which passes. no-inline-hex test passes. Uncommitted.
- 2026-10-16: the dry gray now replaces the warm one everywhere it was used. `--color-neutral-150` is #e8e8e8 (was #edeae4) and `--color-gray-dry` is removed. `--bg-app` and `--bg-hover` both point to neutral-150. 5 direct `hover:bg-neutral-50/100` classes became `hover:bg-hover`. Docs colors_and_type.css updated to match. Vitest app + shared/ui + notebooks/ui + identity/ui 1282/1282; biome clean.
- 2026-10-16: grey text changed to soft blacks. `--fg-secondary` is #404040 (was #78716c) and `--fg-muted` is #575757 (was #a8a29e, about 2.5:1 on white, below AA). New `--fg-placeholder` #8c8c8c for the 6 input placeholder classes and the editor empty-block placeholder. Docs updated. Vitest src 3867/3867, tsc OK, biome clean.
- 2026-10-16 commits: 2a5ce1d feat(shell) topbar+labels+tones, 1e42352 style(theme) dry gray + soft-black text, b68b543 feat(auth) sign-up form clarity. RDD 5e76ff2..b68b543 high (hot_path), 4 lenses APPROVED, acknowledged (review-aaa5fc620098cc7f). Reviewed boundary -> b68b543. Advisories (non-blocking): shell-empty-state panel colour unexplained (:245), sidebar tone test does not assert active state (sidebar.test.tsx:103-115), nav-item tone hover duplication, terms-notice duplicated markup, globals.css token ordering.

## H2 — Home: guided tour, empty state, redesigned home (user, 2026-10-17)
Spec: `docs/new_design_fase_8/inicio-tour-y-empty-state.md` (UI only; existing readers; no backend).
- [x] H2-T1 — Install Driver.js 1.x; spike on a hard load; zero CSP violations, no 'unsafe-inline'. Stop and tell the user if it fails. Route: inline.
- [x] H2-T2 — Tour: steps module, should-launch logic (0 notebooks + no `cogni.tour.v1`, try/catch), ProductTour + useProductTour in the (app) layout, `data-tour` anchors, `cogni-tour` theme CSS, custom "Omitir", a11y, mobile, "Ver recorrido de Cogni" row in /configuracion, e2e fixture marks the tour seen. Route: delegated writer.
- [x] H2-T3 — Home empty state (0 notebooks) per the reference capture + §2.3, with a loading skeleton. Route: delegated writer.
- [ ] H2-T4 — Tour e2e spec (appears, Ahora no persists, Esc, step 5 opens creation, Ver recorrido relaunches). Route: delegated.
- [x] H2-T5 — Redesigned home with notebooks (user spec 2026-10-18, refs docs/new_design_fase_8: capture 10.37.53, Uxcel Web 22, capture 12.28.40, illustration 9306407.jpg). Supersedes the 2026-10-17 streak pill. Route: delegated writer (2+ non-trivial files).
  - [x] H2-T5a — Backend read: weak topics = pages with lowest accuracy in active recall + exams over the last 30 days (user authorized 2026-10-18). TDD on the domain/application read.
  - [x] H2-T5b — Hero card: "Hola de nuevo, {nombre}" + motivational line; review-based day streak card bottom-left (count + 7-day dots); illustration on the right.
  - [x] H2-T5c — Three technique count cards (flashcards yellow, recall green, exams rose) = items due today; click → /flashcards, /active-recall, /exams; empty state.
  - [x] H2-T5d — "Para repasar hoy" rows (one per page×technique): page title black on top, notebook name below in secondary style, "Repasar" button → direct technique URL (today-rows TECHNIQUES); empty state.
  - [x] H2-T5e — Weak topics vertical column on the LEFT spanning from the cards to the rows; empty state. Remove old stat cards/placeholders no longer used.
  - [x] H2-T5f — Technique cards show TODAY'S PROGRESS instead of a due count (user-approved 2026-10-18): progress ("{done} de {total}" + ring with %), "Al día", "Sin repasos hoy" + next review ("mañana" / "el lunes 20" / "Nada agendado"), "Aún no generas", unknown. Compact card (~110px). New read-only scheduling read getTechniqueOverview (items per technique + next due from tomorrow, no migration); done today reuses the streak's analytics metrics. New atom ProgressRing. Route: delegated (writer trigger: 2+ non-trivial files).
  - [x] H2-T5g — Reviews are due per LOCAL DAY (user decision 2026-10-18: "no hay necesidad de calcular los repasos por hora… la persona tiene todo el día para repasar"): an item is due today while `due_at < startOfTomorrow(profile zone)`, not `due_at <= now`. Home counts, calendar Hoy, hubs, dashboard KPI and the practice sessions use the same bound; client-reachable actions read the zone server-side. No SM-2 math or migration change. Route: delegated (writer trigger: 2+ non-trivial files). Due reads changed: scheduling `listDueToday` (Home rows/cards via `getDueToday`, calendar Hoy, /flashcards, exams hub), study-engine `listDue` (flashcard session start, recall + exam hubs), `gradeFlashcard` ITEM_NOT_DUE, `recordExamReviews`/`recordRecallReviews` wasDue, active-recall `composeRecallQuestions`, exams `composeExam`/`composeRetake` due group, analytics `listPageProgress` itemsDue (dashboard "Repasos pendientes"/"vencidos"). Unchanged: study-engine `computeMastery` itemsDue (nightly snapshot, no zone), `getTechniqueOverview` (already bound at tomorrow), calendar Mes/Semana (already per local day).
  - [x] H2-T5h — "Continúa donde lo dejaste" on the populated Home, below "Para repasar hoy": up to 4 recent pages (`getHomeOverview().recentPages`) as compact link cards to `/notebooks/{nb}/pages/{id}` (title or "Sin título", notebook dot + name, "Editada {hace…}"), 2 columns from lg; empty line "Aún no abriste ninguna página.". New atom PageLinkCard (ATOMS.md). Route: delegated (writer trigger: 2+ non-trivial files).
  - [x] H2-T5i — Technique cards count study UNITS, not items (user decision 2026-10-18: "si la persona tiene 3 exámenes pendientes por repasar hoy, que la tarjeta diga 0 de 3 repasos hechos hoy"). Unit = page × technique (one "Para repasar hoy" row). pendingUnits = pages with ≥1 item of the technique due today; doneUnits = pages with a review log of the technique today (profile zone local day) and nothing of it still due (partial page = pending only). Scheduling `getTechniqueOverview` returns both; analytics metrics no longer drive the cards (streak only). No migration, no SM-2 change. Route: delegated (writer trigger: 2+ non-trivial files).
  - [x] H2-T5j — Home layout reorder (user decision 2026-10-18): hero full width; left column = technique cards, "Continúa donde lo dejaste", "Temas débiles"; 320px right column = "Para repasar hoy" from the cards' top. One CSS grid (right item spans 4 rows, last row 1fr); below lg DOM order = cards, Para repasar hoy, Continúa, Temas débiles. ReviewRow gains `layout="stacked"` (title up to 2 lines, pill + smaller button on their own line); Temas débiles uses a 2-column list from sm and a compact one-row empty state. Route: delegated (writer trigger: 2+ non-trivial files).
- [x] H2-T6 — Review fixes (8) + exams done on a completed session (user-approved 2026-10-18, independent review of ec42299..982665f). Fixes: tour steps 2–4 block the highlighted element; step 5 Atrás/ArrowLeft go back with an extra Terminar button and no aria-modal; getTechniqueOverviewAction reads the profile zone server-side (no input); Repasar hoy list room for focus rings + lg:overflow-hidden; hero image fetchPriority=high instead of deprecated priority; next-review copy adds the month 7+ days ahead or in another month; shared cutoff table for analytics vs scheduling startOfTomorrowIn. Product: an exam session completed today (profile zone) closes that page's exam for the day (cards doneUnits, Home/Hoy rows hide it; exams hub and exam sessions unchanged). Route: delegated (writer trigger: 2+ non-trivial files).
Delivery: ask-on-risk; forecast ~1,200 authored lines, so it will need a chain strategy before the PR.
- 2026-10-17: H2-T1 done. driver.js 1.10.1 installed; API has overlayClickBehavior, skipMissingElement, onDoneClick, onPopoverRender. Library writes only element.style.prop. Hard-load Playwright spike on / with a temporary mount: popover rendered, 0 console errors, 0 CSP violations; spike removed. Finding: the spec assumes a nonce style-src, but security-headers.ts already ships style-src 'self' 'unsafe-inline', so no CSP change is needed. Commit goes with T2 (dependency + first use). H2-T2+T3 delegated to one writer.
- 2026-10-17: H2-T2+T3 written (delegated). Writer: Vitest src 3894/3894, tsc clean, biome clean, e2e shell-empty-state 14/14 + auth/terms 11/11; hard-load console clean. Parent spot check: tsc clean; screenshots step1/3/5 + empty-1440 reviewed. Open: no loading skeleton ((app)/loading.tsx made notFound() return 200; Home already awaits data server-side, revisit in T5); 390px shell has no responsive layout (pre-existing, phone deferred). Uncommitted, awaiting user's browser review.
- 2026-10-17: user feedback — after the first notebook, go to that notebook (to create its first page), not back to Home. CreateNotebookTrigger gains `openAfterCreate` (router.push /notebooks/<id> instead of refresh); Home empty state sets it, so the tour's step 5 path does too. Other triggers (Home header, grids, /notebooks) unchanged. RED 1 → GREEN; vitest notebooks/ui + home + page 110/110 + empty state 7/7; tsc, biome clean; browser: lands on /notebooks/<id> with 'Crea tu primer página' empty state. Uncommitted.
- 2026-10-17: user approved the first-run tour flow. New request: polish the Home empty state with the login tools (Motion, kokonutui reference, impeccable). Parent decision: no Three.js here (3D would compete with the single CTA). Route: delegated writer (multi-file visual).
- 2026-10-17: empty state v2 (delegated). New atoms TechniqueFan, DotBackdrop, RevealGroup/RevealItem (motion/react, reduced-motion safe, no residual transform); FeaturePreviewCard bg-card; dots per box 3/0/2; h1 32px. RED 4 → GREEN; writer: vitest src 3904/3904, tsc 0, biome clean, e2e shell-empty-state 14/14, console clean. Parent: screenshots empty-v2-1440 and tour step 5 reviewed; home tests re-run. Uncommitted, awaiting user review.
- 2026-10-17: empty state v3 per user ('fondo estático que le dé cuerpo'). StudyBackdrop atom replaces DotBackdrop: static corner wash in technique pastels + violet, 28px paper grid fading toward centre, 6 study objects on edges (≥1280px), aria-hidden, pointer-events none, covers the whole content card. Writer: vitest src 3908/3908, tsc 0, biome clean, e2e shell-empty-state 14/14. Parent: screenshot empty-v3-1440 reviewed; home + backdrop tests re-run. Uncommitted, awaiting user review.
- 2026-10-17: user kept only grid + gradients, radiating from the centre to the edges. StudyBackdrop: study objects removed; wash = violet core at centre + mint/yellow/pink blooms just around it + wide primary-50 halo; grid masked visible in the middle, gone at edges (opacity .6). RED 2 → GREEN (inline). ATOMS.md updated. Screenshot empty-v4b-1440 reviewed.
- 2026-10-17: user rejected the colour wash. Now: no colours, no corner greeting on the empty state (overrides spec §2.1 item 1; HomeEmptyState takes no props), grid only — SVG graph paper centred, lines stroke-ink-placeholder/55, radial mask strongest in the centre fading to the edges, 16 fixed cells filled neutral-150 kept clear of the hero text. RED 3 → GREEN (inline). ATOMS.md updated. Screenshot empty-v5b-1440 reviewed.
- 2026-10-17: TechniqueFan v2 (delegated, refs kokonutui Card Stack, ReUI empty states, shadcn Empty, impeccable README). Three white mini technique cards with hairline border + 2-layer shadow, pastel icon chip and content hints (flashcard front + Ver respuesta pill; recall prompt + answer box; exam options with one chosen); front mini notebook (violet spine, ring holes, + chip) replaces the BookPlus tile. Motion: stack→fan once, spring no bounce ≤0.5s, instant under reduced motion. API now technique keys, client atom, no center slot. RED 7 → GREEN; writer: vitest src 3914/3914, tsc 0, biome clean, e2e shell-empty-state 14/14. Parent: fan-v2 screenshots reviewed, fan + home tests and tsc re-run. Uncommitted.
- 2026-10-17: removed the ⌘ H keycaps from the Inicio sidebar row (no handler existed; Keycap atom kept, ATOMS.md notes no entry uses it). Tour step 2 copy (user): 'Crea un cuaderno por materia. Dentro crea páginas para tus notas e importa tus PDFs.' RED 2 → GREEN; vitest (app) 733/733, tsc 0, biome clean. User liked the fan v2; asked not to commit yet.
- 2026-10-17: sidebar section labels: last section renamed 'Configuración' → 'General' (item stays 'Configuración'). Labels restyled per impeccable typeset (distinguish role by weight, tone and space, not size alone; sentence case kept per the earlier design/shell-look rule): 12px semibold text-fg, tracking .01em, pt-5 pb-1.5 (was 11px medium fg-muted pt-3.5 pb-1). RED 1 → GREEN; screenshot sidebar-labels.png reviewed.
- 2026-10-17: copy 'Ver recorrido' → 'Ver tutorial' (empty-state link) and 'Ver recorrido de Cogni' → 'Ver tutorial de Cogni' (Configuración row), tests updated. vitest (app), biome, e2e shell-empty-state re-run.
- 2026-10-18: H2-T5 v1 written (delegated writer, uncommitted, awaiting the user's browser review). T5a: analytics `rankWeakTopics` (domain) + `getWeakTopics` (application) + `getHomeWeakTopics({ now })` read; it reuses the existing AnswerOutcomeReader (finished exam_answers, recall_answers with status done) and PageProgressReader (live pages + notebook colour). No new query and no migration. A page is weak with ≥3 answers in the last 30 days and <70% correct (exam is_correct, recall AI score ≥3); the read returns up to 5, worst first. T5b–e: HomeHero (greeting, motivational line, StreakWeek from getDashboardTechniqueMetrics over the last 7 local days, illustration public/illustrations/home-welcome.webp). TechniqueCounts: 3 cards from scheduling `sumDueByKind`; they stay visible at 0 with a muted number. ReviewToday rows come from `toReviewRows` (today-rows TECHNIQUES hrefs). The WeakTopics column sits on the left. New atoms: TechniqueCountCard, StreakWeek, ReviewRow (ATOMS.md). Removed: HomeHeader, StatCard, StreakDots, ReadyToReview, NotebookGrid, RecentPages and their tests. RED observed for weak-topics, get-weak-topics, sumDueByKind, toReviewRows and streak-week-days, then GREEN. Vitest src 3924/3924, tsc 0, biome clean, depcruise 0. e2e shell-empty-state + calendar-today: 16 passed, 1 failed. calendar-today:101 still asserts the removed `due-today-stat` card and was outside the writer's edit surface. Screenshots home-t5-1440, home-t5-900 and home-t5-due-1440 reviewed.
- 2026-10-18: parent fixed tests/e2e/calendar-today.spec.ts Home assertion (per-technique card + direct Repasar link): 3/3; removed unused NEUTRAL_DOT_CLASS; tsc clean. Awaiting user browser review.
- 2026-10-18: H2-T5 v2 (delegated, uncommitted, awaiting the user's review). User correction: Temas débiles moved to the RIGHT column (320px, spans the main column), with the cards and the "Para repasar hoy" rows in the main column. Personality pass, following the impeccable reference in "Operate" mode (restraint, one authored moment):
  - Hero: faint primary-50 wash; the illustration sits on the StudyBackdrop graph paper (mix-blend-multiply); a date line ("Domingo 18 de octubre") sits next to the motivational line, not above the h1, because impeccable bans eyebrows. The illustration is shown only from lg up.
  - StreakWeek: now a client atom with a Flame tile, a ringed today dot, and studied dots that settle in one by one; the helper copy changes with streak length (home-copy.ts).
  - TechniqueCountCard: faint technique-pastel wash, IconTile 48, and PopNumber (new atom; it always renders the final value). Zero counts show in fg-placeholder.
  - ReviewRow: `badge` slot, used for a technique-tone "N pendientes" pill, plus a hover lift; the section heading shows a total pill.
  - Weak topics: two-level severity colours (<40% error, 40–69% warning) and an IconTile composition as the empty state.
  - RevealGroup entrance over the hero, the counts, the rows and the weak column.
  All motion runs once, ≤0.5s, and only its transitions change under reduced motion. kokonutui (bento/widget grid) was used as reference only. RED → GREEN for home-copy. New tests: weak-topics severity and PopNumber. Vitest src 3933/3933, tsc 0, biome clean, depcruise 0; e2e shell-empty-state + calendar-today 17/17. Screenshots home-t5b-empty-1440, home-t5b-due-1440 and home-t5b-due-900 reviewed.
- 2026-10-18: removed StudyBackdrop grid behind the hero illustration (user request); app vitest 732/732, biome clean.
- 2026-10-18: gradients reworked into radial glows (globals.css @utility home-hero-glow: violet top-left + pink behind illustration; technique-glow-* from the icon corner with a soft two-stop falloff); ATOMS updated; biome + vitest green; screenshot home-glow-1440.png.
- 2026-10-18: H2-T5 streak v3 (delegated, uncommitted). StreakWeek redesigned on the same data contract (streakDays, days, helper). References: Duolingo lit flame + week bar, habit check-in pills, GitHub streak chain.
  - Flame tile: dormant grey at 0; lit with a streak (warning-100 → pastel-orange) and flickers once.
  - Big 28px streak number with "días seguidos".
  - The week is a chain: reviewed days are amber circles with a check, consecutive days are joined by a bar, and today without a review is a dashed target ring that pulses twice and stops.
  - Milestone hint (`milestoneHint`: 7 / 30 / 100). When lit, the card gets a warm wash and glow.
  - No new tokens (warning-* + pastel-orange). Motion runs once; only its transitions change under reduced motion.
  RED 4 → GREEN. Vitest src 3936/3936, tsc 0, biome clean (page.test.tsx re-formatted after the coordinator's copy edit). e2e shell-empty-state + calendar-today 17/17. Screenshots home-streak-{0,3,6}-1440 / -block were taken with a fresh user and seedReviews (streaks 0, 3 and 6) and reviewed; the hero keeps its height (~320px at streak 0).
- 2026-10-18: tour step 1 shows public/illustrations/tour-welcome.webp (from docs/new_design_fase_8/6851481.jpg, cropped, 880px, 31 KB) above the title; e2e shell-empty-state green.
- 2026-10-18: tour step 3 copy → "Tus notas, convertidas en práctica" / "Cada página puede transformarse en técnicas de estudio con IA. Practica lo que escribiste y refuerza lo que aprendes." (user picked option 2); tour tests 16/16.
- 2026-10-18: step 3 text refined → "Cada página se convierte en técnicas de estudio con IA. Aquí encuentras todo lo que generes, listo para practicar." (says what the highlighted Técnicas section holds); tour tests green.

- 2026-10-18: tour copy review applied — step 3 "Desde cada página generas técnicas de estudio con IA…", step 4 retitled "Tus repasos y tu avance" and now mentions Progreso (anchor unchanged: Calendario). Tour vitest 17/17, biome clean.
- 2026-10-18: step 4 now highlights Progreso + Calendario together — sidebar NavGroup wrapper `data-tour="avance"`, step id `calendario` renamed `avance`. app vitest 734/734, tsc + biome clean, screenshot checked.
- 2026-10-18: H2-T5f written (delegated, uncommitted, awaiting the user's review). Scheduling: domain `TechniqueOverview` + port `TechniqueOverviewReader`, `startOfDayIn` (DST-aware first instant of a local day) in calendar.ts, use case `getTechniqueOverview` (bound = start of tomorrow in the profile zone), Drizzle adapter (one query grouped by kind: `count(*)` + `min(due_at) filter (where due_at >= bound)`, same live-item filters as the due-today reader), server read `getTechniqueOverview({ timeZone, now })` and Server Action `getTechniqueOverviewAction({ timeZone })` (system clock only, like listCalendarDaysAction; never takes `now` from the client). In-memory fake + shared contract; DB contract `tests/db/drizzle-technique-overview-reader.contract.test.ts` uses a fresh owner pair per test. Home: `readReviewMetrics` returns the streak plus today's reviews per technique (flashcards→flashcard, recall→recall_question, exam→exam_question) from the same analytics call; the overview read runs in parallel and a typed or thrown failure degrades only the cards that need it. Helper `home/technique-progress.ts` builds state + copy + aria label. Card v2 (TechniqueCountCard) ~112px tall (v1 ~125px); ProgressRing atom; ATOMS.md + scheduling README updated. e2e calendar-today Home block now matches `/^Flashcards: \d+ de \d+ repasos hechos hoy$/` with total ≥2. RED observed (7 new/changed test files, then 5 page tests) → GREEN. Vitest src 3977/3977, tsc 0, biome clean, depcruise 0 violations, test:db overview + due-today contracts 11/11 against cogni-dev. e2e not run (parent). Known gap: items due later today (after now, before midnight) are neither pending nor "next review", so a card can say "Próximo repaso: mañana" while one comes due tonight.
- 2026-10-18: T5f card layout fix — label row (tile 30 + full label + chevron) above value/sub + ring, so "Recordación activa" no longer truncates; ~118px (v1 ~125px). vitest src 3977/3977, tsc + biome clean, e2e calendar-today + shell-empty-state 17/17.
- 2026-10-18: H2-T5g + H2-T5h written (delegated, uncommitted, awaiting the user's review). T5g: `startOfTomorrowIn(now, zone)` in scheduling calendar.ts (and a binary-search twin in analytics local-day.ts, the domain may not import scheduling); ports now take a `dueBefore` bound with strict `<` (DueTodayReader, StudyItemRepository.listDue, PageProgressReader); study-engine `DueCutoff = (now) => Date` + `isDueBefore`, injected into startFlashcardSession, gradeFlashcard, start/plan/evaluate recall, start exam/retake, completeExamSession; `dueBefore` added to recordExamReviews/recordRecallReviews inputs. Scheduling `getDueToday({ timeZone, now })` (Home, calendar Hoy) and `getCurrentDueCutoff()` (technique Server Actions; resolved in the request and passed to the `after()` recall evaluation); `listDueTodayAction()` reads the profile zone server-side; `SchedulingServerApi.listDueToday(ownerId, { timeZone })`. Closes the T5f gap (items due later today are now pending). T5h: `home/continue-reading.tsx` + atom `PageLinkCard`. RED observed for scheduling (9 tests), study-engine (5), exams composition, analytics (6), Home/calendar pages (10) and Home recent pages (2), then GREEN; active-recall tests and the PageLinkCard/ContinueReading tests were written with the code (no separate RED run). Vitest src 4010/4010, tsc 0, biome clean, depcruise 0 violations, test:db 11 files (due-today, technique-overview, record-exam/recall-reviews, study UoW, exam-session, exam-retake, recall-session, recall-evaluation, analytics readers, study-engine repositories) 109/109 against cogni-dev. e2e not run (parent). Docs outside the edit surface still say `due_at <= now`: docs/adr/0008 §11, 02-SAD.md:758/764, 03-DATA-API.md:1436, 04-ADR.md:523.
- 2026-10-18: full e2e triage (delegated debugger): 13 failures, no source regression found. Root cause: the reused dev server on :3000 (`next dev`, pid 6127) runs without AI_PROVIDER_MODE, so the env default `live` applies (src/shared/config/env.schema.ts:48) and real providers answer instead of the fake one that playwright.config.ts only injects when it starts its own server. Evidence in the log: exam rows hold real Gemini stems (no "Pregunta N:"), flashcard feedback is real prose instead of "Resumen de ejemplo", the `[falla-ia-una-vez]` marker never fails (banner success instead of error), live generation counts differ (20 vs 11 cards) or are slow (recall row missing after 30 s). active-recall-hub:100 failed on a notebook-card navigation timeout and passed on rerun (1.4 m), so dev-compile timing. 12 AI-dependent specs need a rerun against a fake-mode server (restart the dev server with AI_PROVIDER_MODE=fake). No specs or source changed. Vitest src 4010/4010, tsc 0, biome clean.
- 2026-10-18: full e2e 64/77 with 13 failures — 12 caused by a dev server without AI_PROVIDER_MODE=fake (live AI), 1 timing (active-recall-hub:100, passed on rerun). Rerun of the 12 with AI_PROVIDER_MODE=fake: 12/12 passed. No regression from T5f/T5g/T5h.
- 2026-10-18: H2-T5i + H2-T5j written (delegated, uncommitted, awaiting the user's review). T5i: scheduling port renamed to `TechniqueOverviewReader.readTechniqueSnapshot(ownerId, { reviewedFrom, dueBefore })` returning per kind `total`, `nextDueAt`, `duePageIds`, `reviewedPageIds`; domain `toTechniqueOverview` turns it into `pendingUnits`/`doneUnits` (done = reviewed pages minus due pages, distinct); `startOfTodayIn` in calendar.ts; `REVIEW_SESSION_KIND` (flashcard→flashcards, recall_question→recall, exam_question→exam). Drizzle adapter: item query gains `array_agg(distinct page_id::text) filter (where due_at < dueBefore)`, plus a distinct (session_kind, page) read over review_logs in [reviewedFrom, dueBefore) on live pages/notebooks. Home cards read only the overview (`technique-progress.ts` inputs `doneUnits`/`pendingUnits`); `readReviewMetrics` keeps the streak only. T5j: grid layout in page.tsx, ReviewRow `layout="stacked"`, ReviewToday stacked rows + compact empty state (pill always visible), WeakTopics 2-column list + compact empty row; ATOMS.md + scheduling README updated; e2e calendar-today Home block now expects total ≥1 and scopes the Repasar link to the "Para repasar hoy" region. RED observed: domain units (5) + startOfTodayIn (2) + use case (3), ReviewRow layout (2), Home page (5), WeakTopics layout (2), then GREEN; contract additions (4 new cases) written with the fake. Vitest src 4027/4027, tsc 0, biome clean, depcruise 0 violations, test:db technique-overview (9) + due-today contracts 15/15 against cogni-dev. e2e not run (parent). Note: the "Para repasar hoy" heading pill still sums ITEMS ("N repasos") while the cards count units.
- 2026-10-18: Para repasar hoy wrapped in a bordered card (content height, lg:self-start), item-total pill removed, technique on its own line in stacked rows (ReviewRow meta flex-wrap). Screenshot checked.
- 2026-10-18: H2-T5k — Para repasar hoy rows: ReviewRow layout "list" (borderless list item inside the card, icon + page title + compact outline Repasar that fills on row hover; meta/badge dropped, info kept in aria-label). Technique cards secondary text fg-muted → fg-secondary, ring % → fg. Screenshot checked.
- 2026-10-18: H2-T5l — review column restyled: heading "Hoy toca repasar", unit-count line, streak footer, h-full to the end of the left column; ReviewRow layout "tile" (technique-coloured 1.5px outline + left pastel wash, title + Repasar with arrow, no icon). Route: inline (one already-understood component pair + tests). Screenshot checked.
- 2026-10-18: H2-T5m — review tiles per user reference (round technique icon, bold 13.5px title over notebook, thin technique outline, Repasar); footer message removed; right column now absolute inside a 3-row grid cell so it ends exactly at Temas débiles (bottoms measured equal, 911.5px); IconTile radius "full" added. vitest src 4027/4027, tsc + biome clean, e2e calendar-today + shell-empty-state 17/17; narrow width stacks normally.
- 2026-10-18: H2-T5n — review tiles: neutral border, whole tile is the link with a chevron (no Repasar button), heading back to "Para repasar hoy" with a descriptive subtitle, tiles on a grey neutral-50 panel filling the card. Screenshot checked.
- 2026-10-18: H2-T5o — review section heading "Repasar hoy" (22px bold primary-600 uppercase), subtitle about scheduled reviews still pending today, grey panel removed, tiles wider padding. Screenshot checked.
- 2026-10-18: "Repasar hoy" heading back to sentence case (uppercase dropped after review), still 22px bold primary-600.
- 2026-10-18: visible "Tu progreso de hoy" heading over the technique cards (was sr-only "… por técnica"); cards move down ~40px. vitest src 4028/4028.
- 2026-10-18: H2-T5p — Continúa donde lo dejaste polish: notebook shown as a soft pastel chip (NOTEBOOK_CHIP_CLASSES) instead of dot + text, a bit more padding; icons tried and dropped at user request. Screenshot checked.
- 2026-10-18: Continúa donde lo dejaste — notebook chip neutral (bg-neutral-100, no notebook colour; NOTEBOOK_CHIP_CLASSES removed), "Editada…" pinned bottom-right (PageLinkCard trailing self-end). vitest src 4029/4029.
- 2026-10-18: H2-T5q — PageLinkCard restyled after kokonutui Widget Grid (no icons): notebook chip header, 15px title, Editada bottom-right, layered lift shadow on hover; ~106px tall. Screenshot checked.
- 2026-10-18: H2-T5r — ForgettingCurve backdrop (Motion) on Continúa donde lo dejaste cards: Ebbinghaus curve + "now" marker by hours since edit; chosen over 7 other studies (scratchpad bg/). PageLinkCard backdrop slot. Screenshot checked.
- 2026-10-18: H2-T5s — Continúa donde lo dejaste cards drop the visible notebook (kept in aria-label); PageLinkCard meta optional; curve band starts at 48%. Screenshot checked.
- 2026-10-18: curve now starts near the top-left corner (band 8%–95%), title nudged right (pl-7 via PageLinkCard titleClassName). Screenshot checked.
- 2026-10-18: H2 committed on feat/phase-8-design-flows after user approval ("ya puedes commitear"): ec42299 feat(shell) product tour (T2), ac06da8 feat(scheduling) per-day due bound + technique overview read (T5g, T5f/T5i data), 4adc878 feat(analytics) weak topics read + per-day pending counts (T5a, T5g), 982665f feat(home) empty + populated Home (T3, T5b–T5s). Checks before commit: vitest src 4039/4039, tsc, biome, depcruise clean; e2e calendar-today + shell-empty-state 17/17; full e2e earlier 64 + 13 reruns green with AI_PROVIDER_MODE=fake. T5e note: weak topics ended in the left column (user moved it). Pending: H2-T4 tour e2e spec; full Playwright suite + delivery strategy (branch far over ~400 lines: ask stacked-to-main vs feature-branch-chain) before any PR; RDD assess from base b68b543.
- 2026-10-18: H2-T6 written (delegated, uncommitted). RED observed then GREEN for: product-tour.test.tsx (4 of 6 new), scheduling technique-overview action (2), review-today.test.tsx (2), home-hero.test.tsx (1), technique-progress month cases (2; the UTC-vs-zone 'mañana' case already passed), domain toTotals completed exams (2), list-due-today (2), due-today-read getDueToday (1). Written with the code (no separate RED run): contract cases (2 due-today + 2 overview, fake implemented in the same step), shared cutoff table tests/unit/fixtures/local-day-cutoffs.ts (pins existing agreement, 20 cases incl. Santiago/Havana/Madrid DST and Apia 2011), Home page composition test. Vitest src 4103/4103, tsc 0, biome clean, depcruise 0 violations, test:db due-today + technique-overview + due-in-range contracts 31/31 against cogni-dev. e2e not run (parent).
- 2026-10-18: Independent review (4 read-only agents, one per H2 commit; native RDD STATUS blocked by the intended-untracked selection format): no blockers/majors. 8 minor fixes + exam-done-on-finished-session applied (H2-T6) and committed; step 5 popover widened after a screenshot showed "Crear cuaderno" truncated. vitest src 4104/4104, tsc, biome, depcruise clean; test:db 31/31 (writer); e2e calendar-today + shell-empty-state + exams-hub + exams-session 21/21; tour step 5 checked in browser (ArrowLeft → step 4, Terminar closes).

## H3 — Calendar reform (user, 2026-10-19)
Refs: scratchpad mockups opcion-a.png + hoy-lista.png (user chose both), docs/new_design_fase_8 captures 7.30.47 (week KPIs), 7.47.31 (Hoy list), 10.03.53 (Mes upcoming list). Keep the current structure (page title, tabs above the card, card header with date badge + nav, Lun–Dom week, month grid lines). No drawings, no technique names on week/month chips (colour is enough). Tools: Motion where it fits, Bklit UI chart (https://bklit.com/docs/components) for the weekly progress card; no three.js in the grid.
- [x] H3-T1 — Scheduling: `CalendarDayPage` gains `notebookTitle` (chip subline + Mes list). TDD on the reader/domain. Route: inline (one read path + tests).
- [x] H3-T2 — Semana: 2 cards above the grid — "Repasos esta semana" (units page×technique + technique dots) and "Progreso de la semana" (Bklit stacked bar chart of completed reviews per day per technique, `getDashboardTechniqueMetrics().daily`). No "Para hoy" / "Día más cargado". Day cells: big number only (no "N repasos"), today = violet square + faint violet column, empty days striped. Chips: technique pastel + left accent bar, page title + notebook subline. Route: inline with screenshot iteration.
- [x] H3-T3 — Mes: same chip/today treatment, compact; right column "Próximos repasos" list (left colour bar, page title, technique-free subline: notebook · date), from today within the shown month. Route: inline.
- [x] H3-T4 — Hoy: one row per page×technique (toReviewRows): waiting-since column ("Desde ayer · 1 día esperando" / "Desde hoy · Programado hoy", from page earliestDueAt), technique colour bar, page title, pills (technique, notebook, amount "8 tarjetas"/"4 preguntas"), "Repasar" + chevron, whole row a link; header "N repasos para hoy"; helper line + "X de Y hechos hoy" pill (getTechniqueOverview). Route: inline.
Delivery: same branch; chain strategy still to ask before the PR.
- 2026-10-19: H3-T1 done (delegated writer), commit 7fd1bfb. RED 3 → GREEN; vitest scheduling+calendario 182/182, tsc 0, biome clean, DB contract due-in-range 12/12. Parent spot check calendar.test 50/50. User chose an own Bklit-style bar atom (Motion, no new deps) over installing Bklit (57 files, 11 deps).
- 2026-10-19: H3-T2..T4 written (delegated writer) incl. two user feedback rounds: one date expression in the card header (DateBadge + title, no numeric range; week title = range); compact Semana metric cards moved to the page header right of title+tabs; progress card = per-technique bars (items: done = analytics completed this week, pending = still due this week) with % inside, labels 'N Técnica' in the technique -fg; pastel accent tokens --color-technique-{yellow,mint,pink}-accent (contrast ≥4.7:1). Writer: vitest src 4148/4148, tsc 0, biome clean, depcruise 0, e2e calendar-today + calendar-month-week 6/6. Parent reviewed impl-semana/mes/hoy screenshots. Uncommitted, awaiting the user's browser review. RDD: 7fd1bfb assessed medium, under_budget (pending in slice).
- 2026-10-19: H3-T2..T4 rounds 3–11 (delegated writer aab0eac + parent inline fixes), final design superseding the task lines above:
  - **Header:** DateBadge xl (follows the viewed day) left of the gradient h1 + glass-violet tabs; period text + bare chevrons centred on the tabs row; Semana "Semana X" overline (ISO week of month); Mes "Octubre 2026"; no middle "Hoy" button (tabs return to the current period).
  - **Semana:** "Lun 19" headers, full-height columns, soft violet today column, one "Progreso de la semana" card with TechniqueRing ×3.
  - **Chips:** no fill, black text, accent bar, grey hairline, 4px corners; exam accent solid #ef4444.
  - **Hoy:** `?date=` day navigation (past clamped to today), later days list scheduled reviews ("Programado"); IllustratedEmptyState with calendar-empty.webp (grey background keyed out), illustration-backdrop blob and empty-state-glow.
  - **Mes:** selectable days (`?view=mes&date=`), right panel = selected day's reviews + "Próximos repasos" for day+1..day+7 (no dates), fixed 60px CalendarReviewCard with violet hover, pill under the title; header slot left empty.
  - **Rejected by the user:** 3D three.js header scenes, the graduate illustration, Mes header cards (metric and non-metric), Semana cell backgrounds and big numbers.
  - **Parent fix:** Semana drew an empty side column (`aside={null}`); RED test in calendar-period.test, fixed in page.tsx + CalendarPeriod (`aside == null`).
  - **Verification before commit:** vitest src 4195/4195, tsc 0, biome clean, depcruise 0; e2e calendar-today 4/4, calendar-month-week 6/6, settings-timezone passed in the writer's last full run (12/12 across the three specs).
- 2026-10-19: Committed as 0b50b17. RDD START refused with `lens_context_budget_exceeded` (63 files, 5201 lines vs base 239841f). With the user's approval, split losslessly into 5 work-unit commits (backup ref `backup/h3-calendar-0b50b17`; `git diff backup..HEAD` = 0 lines):
  - a5c9b8b ui restyle (grid, chips, tabs, badge, nav, globals.css, ATOMS.md)
  - 74b0b61 ui review atoms + illustrated empty state
  - afb16c8 calendario view models
  - df7d815 calendario components
  - bea5ba5 page wiring + e2e

  Intermediate commits are not individually buildable (the atom API changes land before their consumers); the branch tip is the verified state. Reviewing slice by slice from a detached HEAD at each commit.
- 2026-10-19: RDD on all 5 slices, each medium / slice_budget_reached, consent granted by the user, one reliability lens each:

  | Slice | Range | Lineage | Outcome |
  |---|---|---|---|
  | 1 | 239841f..a5c9b8b (includes 7fd1bfb) | review-6213cab4d3c434e7 | approved, acknowledged |
  | 2 | a5c9b8b..74b0b61 | review-29d29db68b1467f1 | approved, acknowledged |
  | 3 | 74b0b61..afb16c8 | review-2ed4e616490b19b9 | approved, acknowledged |
  | 4 | afb16c8..df7d815 | review-9cdf46f1304a0bd8 | approved, acknowledged |
  | 5 | df7d815..bea5ba5 | review-71cb1bb8df5d32c9 | approved, acknowledged |

  The reviewed boundary is now bea5ba5. The branch was restored to feat/phase-8-design-flows at bea5ba5, identical to the backup.

## H3 follow-ups (non-blocking review advisories)

- [ ] H3-F1 DaySelectLink: ignore `event.repeat` on Space and test it (no repeated navigations).
- [ ] H3-F2 TechniqueRing: guard non-finite `done`/`total` (no "NaN%") and clamp the spoken % like the visible one.
- [ ] H3-F3 TodayReviewRow: a discriminated union on `scheduled`, so due rows require the waiting texts.
- [ ] H3-F4 Tests: exercise the reduced-motion branches (IllustratedEmptyState, SegmentedTabs) and the typed `{ ok: false }` path of `readOptional`.
- [ ] H3-F5 weekTechniqueProgress: only count `daily` entries inside the shown week.
- [ ] H3-F6 CalendarPeriod: skip the aside for any falsy node (not only null/undefined); use `useId` for the MonthDayPanel/WeekSummary aria ids; key the rings by technique, not tone.
- [ ] H3-F7 The e2e header-position guard uses exact equality; consider a ±1px tolerance if it flakes.

Slice-artefact advisories (CalendarNav/TodayList callers "not migrated") are resolved by the later slices; no action.

## H4 — Notebooks hub reform (user, 2026-10-20)

- [x] **H4-T1** — notebooks hub empty state (user-approved mockup `nb/a.html`).
  - Route: delegated direct (writer trigger: atom + page + tests + docs).
  - Approved copy: header "Cuadernos" without the "Biblioteca" eyebrow (both
    states); empty description "Aún no tienes cuadernos"; title "Todas tus
    materias, en un solo lugar"; message "Crea un cuaderno para cada materia
    o tema que estudies. Ahí se juntan tus apuntes, los que escribes y los
    que importas desde PDF, para que todo quede ordenado y a mano cuando lo
    necesites."; steps "Crea un cuaderno por materia" / "Escribe o importa
    tus apuntes" / "Repasa con las técnicas"; CTA "Crear mi primer cuaderno".
  - Built: `IllustratedEmptyState` gained `backdrop={false}` (plain variant,
    560px art, no glow/blob/mask) and `steps` (numbered `<ol>` pills);
    calendar default unchanged. `CreateNotebookTrigger` gained a `cta`
    variant (violet pill, soft violet shadow, no plus, same dialog).
    `public/illustrations/notebooks-empty.webp` 1600×1067 q82, white
    background kept. ATOMS.md updated.
  - RED: 7 failing (atom plain/default/steps, page x3, trigger cta) → GREEN.
  - Checks: vitest src 455 files / 4202 tests pass; tsc clean; biome clean;
    depcruise no violations; `shell-empty-state.spec.ts` 15/15 pass (new
    hub scenario). Screenshots `scratchpad/nb/real-1440.png`, `real-390.png`.
    Note: at 390px the app shell keeps its 240px sidebar (no mobile shell
    yet; pre-existing, out of scope).
  - Commit: `568648c`.
- [x] **H4-T2** — hub empty state: keyed illustration, paper background, entrance motion.
  - Route: delegated direct (writer trigger: atom options + page + css + image + tests + docs).
  - Thesis: Motion cascade + dotted-paper background + violet aura (via the
    calendar's glow and blob). Scope changes by the user 2026-10-20: the
    approved Three.js floating-sheets layer (`nb/b.html`) was built then
    dropped for performance; a framed rounded card on a violet aura was
    then dropped too ("no visible rectangle, like the calendar").
  - Built: `IllustratedEmptyState` loses the plain variant (`backdrop`,
    no other user) and gains `artSize="sm"` (400px), `entrance="cascade"`
    (art → title → message → steps 0.06s apart → action, 0.32s
    `cubic-bezier(0.16,1,0.3,1)`, ≤0.7s; reduced motion: duration 0 only)
    and `paper` (`dotted-paper` @utility: primary-200 dots, 22px grid,
    radial mask, ::before z -1). Calendar keeps the defaults (block
    entrance, 480px). Illustration re-keyed from `8598890.jpg` (border
    flood fill over min(RGB) ≥ 240, soft de-fringed matte, outer 5%
    feathered) as `notebooks-empty-v2.webp` (renamed: the dev image
    optimizer kept serving the stale opaque version). ATOMS.md updated.
    Dotted paper kept: calm with the glow.
  - RED: scene 3 + atom 4 + page 1 (3D/framed iterations), then 6 failing
    for the final API against the T1 atom → GREEN 12/12.
  - Checks: vitest src 455 files / 4206 tests pass; tsc clean; biome
    clean; depcruise no violations; e2e shell-empty-state + calendar-today
    19/19 pass; impeccable detect: only a pre-existing side-tab finding at
    globals.css:369 (2026-09-23, not this task). Screenshots
    `scratchpad/nb/t2-1440.png` (title, steps and CTA above the fold),
    `t2-1024.png`, `t2-390.png` (pre-existing 240px sidebar at 390),
    `t2-cal.png` (calendar unchanged).
  - Commit: `22c8bbf`.
- [x] **H4-T3** — hub empty state: CSS notebook fan replaces the illustration.
  - Route: delegated direct (writer trigger: new atom + atom API + page +
    tests + docs + asset removal).
  - Decision (user 2026-10-20): the raster illustration is replaced by a
    CSS hero of three fanned notebooks, option D palette 1 "Técnicas vivas"
    (`nb/opts3.html?o=1`, `pal-1.png`).
  - Built: new atom `NotebookFan` (Historia amber / Biología emerald at
    ±9deg ±150px behind an upright violet "Nueva materia" with a
    flashcards-accent ribbon; page-edge layers, spine, notched ribbon,
    lucide tiles; aria-hidden; container-query stepped scale so it never
    overflows). `TechniqueFan`'s `fanPose`/`fanStack` take an optional
    `FanShape` and `NotebookFan` reuses them with `fanTransition`.
    `IllustratedEmptyState` props are a union: `image` (calendar, unchanged)
    or `art` (no blob, no img); `artSize` removed with its last user.
    `empty-image.ts` and `notebooks-empty-v2.webp` removed (`git rm`).
    Glow and dotted paper kept (calm behind the fan). ATOMS.md updated.
  - RED: notebook-fan suite failed to resolve the module; 3 atom hub tests
    (`image` undefined with `art`) and 1 page test (img still present)
    failing → GREEN.
  - Checks: vitest src 456 files / 4210 tests pass; tsc clean; biome
    clean; depcruise no violations; e2e shell-empty-state + calendar-today
    19/19 pass (first run had 1 flaky `moves to the next day` URL wait,
    passed alone and in a full rerun); impeccable detect `[]`. Screenshots
    `scratchpad/nb/t3-1440.png` (CTA bottom 731 < 900), `t3-1024.png`,
    `t3-390.png` (no horizontal scroll; pre-existing 240px sidebar),
    `t3-cal.png` (calendar unchanged).
  - Commit: `620ef43`.
- [x] **H4-T4** — hub header: violet notebook badge, gradient title, no header create button.
  - Route: delegated direct (writer trigger: atom extraction + header atom +
    page + e2e helpers + docs).
  - Decision (user 2026-10-20, mockup `nb/hdr.png` with two corrections):
    remove the header "+ Nuevo cuaderno" pill in all states (creation via
    the empty-state CTA and the grid tile); left of the title a violet
    notebook badge only, no "+" on it; 32px bold tight `text-gradient-brand`
    h1; subtitle "Tus materias, organizadas" · count.
  - Built: new atom `NotebookCover` (`lg` fills its parent, `sm` 58×70
    badge; default violet palette + flashcards ribbon) extracted from
    `NotebookFan`, whose three books now render it (fan unchanged visually).
    `SectionHeader`: `description` accepts a string list joined by
    `primary-300` dots; `leadingClassName` overrides the icon row gap.
    `CreateNotebookTrigger` `pill` variant removed with its last user
    (`variant` now required); the grid tile now stretches to its cell (it
    shrank to its content under the old `items-start`). e2e
    `createNotebook` helper clicks the one create control present (grid
    tile or empty-state CTA). ATOMS.md updated.
  - RED: notebook-cover suite failed to resolve the module; 2 SectionHeader,
    1 NotebookFan, 5 page tests failing; later 1 trigger tile-stretch test
    → GREEN.
  - Checks: vitest src 457 files / 4220 tests pass; tsc clean; biome
    clean; depcruise no violations; impeccable detect `[]`. e2e: the 27
    specs using `helpers/notebooks` or `/notebooks` (64 tests, 1 worker):
    53 pass, 11 fail; `--last-failed` rerun 8/11 pass, 3 still fail
    (active-recall-hub "lists a finished session…" and active-recall-session
    "answers, skips…": evaluation stays "pending"; exams-feedback
    "explains a failed exam…": answer reveal never shows). All 3 fail
    after notebook creation succeeded, in AI evaluation/exam paths; the
    first run also had 5 `AuthRetryableFetchError` Supabase network
    errors. Base check (parent, 2026-10-20) on `620ef43`: the two
    active-recall specs fail identically (pre-existing, not caused by
    H4-T4); exams-feedback passed on base and then passed on `6a41fa7`
    when rerun alone (4.6m) → flaky, not a regression. Task closed. Screenshots `scratchpad/nb/t4-empty-1440.png`,
    `t4-grid-1440.png` (3 notebooks, stretched tile), `t4-empty-390.png`.
  - Commit: `6a41fa7`.
  - Follow-up: List view has no create control since the header button was
    removed (user decision 2026-10-20); revisit in the hub list reform.
    Closed by H4-T6: the hub has no list view anymore.
  - Follow-up: active-recall-hub.spec.ts:100 and active-recall-session.spec.ts:89
    fail on base too (evaluation stays "pending"); investigate before the
    next PR's full e2e run.
- 2026-10-27: RDD on the H4 slice `bea5ba5..6a41fa7` (568648c, 22c8bbf,
  620ef43, 6a41fa7; 17 files, 1488 lines): medium / slice_budget_reached,
  consent granted by the user ("corre la revisión"), untracked scope
  exclude, one reliability lens → APPROVED, acknowledged
  (review-1fc9d60cf28e484d). Reviewed boundary → `6a41fa7`.
  - Advisory R3-001 (non-blocking): `SectionHeader` treats any array
    `description` (ReactNode allows JSX arrays) as the dot list and keys
    parts by value (duplicate strings collide). Fix later: type it as
    `string | readonly string[]` or key by index, plus a test.
- [x] **H4-T5** — hub grid: each notebook as a notebook cover (user, 2026-10-28).
  - Route: delegated writer (writer trigger: new atom + page + trigger +
    tests + docs).
  - Request: replace the grid card with a "ficha" in the empty state's
    visual line, a reusable atom. Corrections the same day: no icon on the
    cover; the page count in the top-left corner as plain meta text (no
    badge, glyph or tile); the bottom row only the date and the kebab.
  - Built: new atom `NotebookCoverCard` (a large `NotebookCover` tinted by
    the notebook's pastel colour in the fan's 200 → 400 language, violet
    when null; content laid over the decorative cover; stretched title link;
    hover lift 4px + −0.6deg, press 0.98, none under reduced motion;
    container query below 150px). `notebooks/page.tsx` composes it with
    `NotebookCardActions`; grid `minmax(min(100%,180px),1fr)`. The
    `CreateNotebookTrigger` tile takes the book proportion and radius.
    ATOMS.md updated.
  - RED: notebook-cover-card suite failed to resolve the module; page test
    "presents each notebook in the grid as a notebook cover" failed; then
    the corrected layout tests failed against the first layout → GREEN.
  - Checks: tsc clean; biome clean on the changed files; vitest
    src/shared/ui + src/modules/notebooks + notebooks route + no-inline-hex
    129 files / 946 tests pass; depcruise no violations. e2e
    shell-empty-state + notebooks-acceptance: 20/21, the acceptance
    recolor step read the old IconTile `bg-pastel-*` class → spec now reads
    the card's `data-tone`; notebooks-acceptance rerun 6/6 pass.
    Screenshots in the session scratchpad `hub-cards/` (`before-*`,
    `after-*`).
  - Final checks (after the review round): tsc clean; biome clean on the
    7 changed source files; vitest scoped suites 129 files / 947 tests
    pass; depcruise no violations; e2e notebooks-acceptance +
    shell-empty-state 21/21 pass. Screenshots `hub-cards/after-grid-1440.png`
    (4 per row), `after-grid-1024.png` (3 per row), `after-grid-390.png`
    (pre-existing 240px sidebar: narrow fallback), `after-grid-hover-1440.png`,
    `after-tile-hover-1440.png`.
  - Commit: `02d064a`.
  - Follow-up (user "más grandes" 2026-10-28): grid min 210 → 290px (3 per
    row at 1440, 2 at 1024, 1 at 390 with the pre-existing sidebar); a
    280px container step scales the cover type (title 20px, meta 13px) and
    the create tile (56px disc, 18px label). Screenshots re-taken
    (`after-grid-1440.png`, `after-grid-1024.png`, `after-grid-390.png`,
    `after-tile-hover-1440.png`).
  - Follow-up (user "un poco menos, 5 por fila" 2026-10-28, supersedes 3
    per row): `auto-fill` replaced by explicit container-query columns on
    the grid (`@container/grid`: 1 → 2 @300 → 3 @540 → 4 @680 → 5 @960,
    never more): 5 at 1440 (~203px covers), 5 larger at 1920 (~290px, the
    280px type step applies), 4 at 1024, 1 at 390 (pre-existing sidebar).
    Container queries rather than viewport breakpoints because the
    sidebar eats the viewport. RED: page grid test failed on the
    `auto-fill` grid → GREEN. Screenshots `after-grid-1440.png`,
    `after-grid-1920.png`, `after-grid-1024.png`, `after-grid-390.png`.
    Checks: vitest scoped 129 files / 947 tests pass; tsc clean; biome
    clean; e2e notebooks-acceptance + shell-empty-state 21/21 pass.
    Commit: `4400843`.
  - Decision (user 2026-10-28, closed): the bottom-row date stays the
    last update (`formatTimeAgo(updatedAt)`); `HomeNotebookSummary` has no
    `createdAt` and no backend change is made.
  - Review round (user 2026-10-28): covers bigger (grid min 180 → 210px:
    4 per row at 1440, 3 at 1024; page count and date visible at both);
    "Nuevo cuaderno" tile redesigned as a violet-tinted cover (dashed
    `primary-300` border, `primary-600` plus disc, violet label + hint
    "Crea un cuaderno para una materia", hover lift + tint, narrow
    fallback below 150px). RED: the new tile test failed against the grey
    dashed tile → GREEN.
  - Impact: `src/app/(app)/_components/notebook-card.tsx` is now unused
    (outside this task's edit surface; delete in a follow-up). The list
    view (`notebook-list-row.tsx`) is unchanged and still has no create
    control.
- [x] **H4-T6** — hub keeps only the cover grid: grid/list view option removed (user, 2026-10-29).
  - Route: delegated writer (writer trigger: page + page test + e2e helper
    + ATOMS.md + a deletion).
  - Built: `notebooks/page.tsx` drops `ViewToggle`, the `searchParams`
    `?view=` handling and the list branch (`Card` + `NotebookListRow`); the
    page takes no props, so `?view=list` / `?view=grid` simply render the
    grid. `ViewToggle` stays (the notebook detail page still uses it).
    e2e `createNotebook` opens `/notebooks` instead of `/notebooks?view=grid`.
    ATOMS.md: Card, IconTile, ViewToggle, NotebookCoverCard and the
    list-row "Used by" lines updated.
  - Deleted: `src/app/(app)/_components/notebook-card.tsx` (no importer
    since H4-T5: rg and CodeGraph show no caller; it had no test).
  - RED: new page test "renders no view toggle and the cover grid" failed
    3/3 (toggle links present) → GREEN 12/12.
  - Checks: tsc clean; biome clean on the 4 changed code files; vitest
    scoped 210 files / 1681 tests: 1680 pass, 1 fail
    (`inicio/page.test.tsx` "tells done, idle and never-generated
    techniques apart"), fails identically on the base, pre-existing;
    depcruise no violations; curl `/notebooks?view=list` without session
    → 307 to `/login`. e2e notebooks-acceptance + shell-empty-state 21/21
    pass (4.1m); the other ~17 specs that use `createNotebook` were not run
    (left for the pre-PR full suite).
  - Closes the H4-T4 follow-up "List view has no create control": there
    is no list view anymore.
  - Follow-up: `src/app/(app)/_components/notebook-list-row.tsx` has no
    user now (outside this task's edit surface; delete next, plus the
    comments in `modules/notebooks/ui/notebook-card-actions.tsx` and
    `_components/notebook-swatches.ts`, `page-list-row.tsx` that name the
    removed files).

## H5 — notebook detail reform (user, 2026-10-29)

- [x] **H5-T1** — notebook page: pages header and paper-sheet page cards (step 1 of the reform).
  - Route: delegated writer (writer trigger: two new atoms + page + tests +
    ATOMS.md).
  - Request: the hub's H4-T4 header line and H4-T5 card family on
    `notebooks/[notebookId]/page.tsx`. Out of scope: the zero-pages empty
    state (step 2), the grid/list `ViewToggle` (unchanged, pending a user
    question) and the editor.
  - Built: new atom `PageSheet` (decorative paper sheet: two stacked sheets,
    a white face with a folded corner, an index tab and a margin rule in
    the notebook's colour; `lg` is ruled paper, `sm` the 58×70 header badge
    with three short rules) and `PageSheetCard` (an `aspect-[4/5]` article,
    stretched title link, title 15px on 22px rules and `line-clamp-4`,
    bottom row date + actions, optional top-corner `meta`, hover lift 4px +
    0.4deg, press 0.98, none under reduced motion, a narrow fallback below
    150px, "Actualizada" prefix only from 190px so the date never
    truncates). Header: `PageSheet sm` badge tinted by the notebook's colour
    (violet when null), 32px `text-gradient-brand` title, meta "Cuaderno ·
    N páginas" (the uppercase eyebrow folded into the dot line); breadcrumb,
    `BackLink` and "Nueva página" kept. Grid: the hub's `@container/grid`
    columns capped at 5. The archive button is now always visible on each
    sheet (it was opacity-0 until hover, invisible to keyboard focus).
    ATOMS.md updated (PageSheet, PageSheetCard, Card/IconTile/SectionHeader/
    PageListRow lines).
  - RED: page-sheet and page-sheet-card suites failed to resolve the
    modules; 3 route tests (header badge + gradient title, sheet cards,
    capped grid) failed → GREEN. The route fixture's colour changed from an
    old hex to `green` (a real `NotebookColor`).
  - Checks: tsc clean; biome clean on the 6 changed source files; vitest
    src/shared/ui + src/modules/notebooks + (app) + no-inline-hex 212 files /
    1698 tests: 1697 pass, 1 fail (`inicio/page.test.tsx` "tells done, idle
    and never-generated techniques apart", pre-existing); depcruise no
    violations. Screenshots in the session scratchpad `notebook-detail/`
    (`before-*`, `after-1440.png` 5 per row, `after-1024.png` 4 per row,
    `after-390.png` narrow fallback with the pre-existing 240px sidebar,
    `after-hover-1440.png`, `after-violet-1440.png`, `after-list-1440.png`).
    e2e notebooks-acceptance + flashcards-generation 7/7 pass (3.0m).
  - Commit: `4dc9f19`.
  - Open: the list view's `PageListRow` (flat violet icon rows) no longer
    matches the sheets; the notebook's emoji `icon` is no longer shown in
    this header (the sidebar still shows it; the hub covers dropped it in
    H4-T5); the optional `meta` slot is unused until a product decision.

- [x] **H5-T2** — create control first and fixed in both grids; list rows as paper strips (user, 2026-10-29).
  - Route: delegated writer (writer trigger: three new atoms + two pages +
    list row + tests + ATOMS.md + e2e helper).
  - Request: "Nuevo cuaderno" first in the hub grid; a sheet-shaped "Nueva
    página" tile first in the notebook grid, the header button removed (one
    create control, like the hub); keep the list view (user decision) but
    restyle `PageListRow` as paper strips with a create row first. "Fijo" =
    first item, not sticky.
  - Built (commit 1): hub `CreateNotebookTrigger` tile moved before the
    covers. New atoms `PageSheetCreateTile` (sheet-sized violet dashed tile,
    plus disc, "Nueva página" / "Escribe o importa un apunte", hover lift
    4px) and `PageStripCreateRow` (the same as a 56px strip), each inside
    the same `createPage` server-action form the header button used; the
    header has no button. Decision: while a notebook has no pages the
    empty state holds the old "Nueva página" button as its `action` (the
    only create control there; step 2 redesigns that state).
  - Built (commit 2): new atom `PageStripRow` (white strip, hairline border,
    left index tab and margin rule in the notebook's colour via the shared
    `PAGE_SHEET_TONES`, title on a `neutral-100` ruled baseline, muted date
    with "Actualizada" from 360px, archive always visible, hover lift 1px;
    below 240px only title + actions). `PageListRow` composes it with the
    notebook's `tone`; the list drops its `Card`, `IconTile` and chevron.
    e2e `createPageAndOpen` unchanged (the tile keeps the accessible name
    "Nueva página"); its comment updated.
  - RED: hub "create tile first" and 4 notebook-page tests (no header
    button, tile first, item counts) failed → GREEN; then 6 strip /
    list-row tests failed to resolve or matched the old row → GREEN.
  - Checks: tsc clean; biome clean on the changed files; vitest
    src/shared/ui + src/modules/notebooks + (app) + no-inline-hex 214 files /
    1713 tests: 1712 pass, 1 fail (`inicio/page.test.tsx`, pre-existing);
    depcruise no violations. Screenshots in the session scratchpad
    `notebook-detail/` (`t2before-*`, `t2after-*`: hub 1440 + hover, grid
    and list at 1440 / 1024 / 390, card, strip and create hovers). One
    iteration: strip text moved onto its baseline; narrow fallbacks added
    for the 390 pre-existing sidebar.
    e2e notebooks-acceptance + shell-empty-state + slash-command +
    editor-a11y + image-upload + flashcards-manual 30/30 pass (7.3m); the
    other specs using `createPageAndOpen` were not run (pre-PR full suite).
  - Commits: `6e69fef` (create first), `54ec518` (paper strips).

- [x] **H5-T3** — "Nueva página" asks how to create the page and opens it right away (user, 2026-10-29).
  - Route: delegated writer (writer trigger: dialog composition + atom +
    page + tests + e2e helper + ATOMS.md).
  - Request: land in the new page's editor after creating it; every "Nueva
    página" opens a modal with "Página en blanco" and "Importar un
    documento" (PDF/DOCX/PPTX) reusing the existing import flow.
  - Built: `createPage` (the route's inline Server Action) now `redirect`s
    to `/notebooks/{id}/pages/{newId}`; `notebooks/actions.ts` already
    returned the created `Page`, so NO backend file changed. New
    `_components/new-page-dialog.tsx` (route composition: notebooks cannot
    import ingestion) on the `Dialog` atom: two option cards; blank submits
    the action ("Creando página…" while pending); import closes the dialog
    and calls the existing `DocumentImportProvider.start` (its hidden
    picker `accept` = .pdf,.docx,.pptx + mimes, 20 MB check, progress
    banner and errors unchanged; it already `router.push`es to the new
    page once the import job starts, so no change there), disabled while
    another import runs. New atom `FileFormatBadge`. The grid tile, list
    row and empty-state CTA are triggers (`type="button"`). No sidebar
    entry point: the sidebar no longer mounts the page tree (design pass
    2), so `sidebar-tree-client`'s create page was left unchanged. No
    ingestion file changed (deep imports of its UI hooks from the app
    layer, as `notebook-actions.tsx` does).
  - RED: 3 route tests (header create count/type, redirect) and the
    dialog suite (module missing) failed → GREEN.
  - Checks: tsc clean; biome clean; vitest shared/ui + notebooks +
    ingestion + (app) + no-inline-hex 2630 tests: 2629 pass, 1 fail
    (`inicio` pre-existing); depcruise no violations. e2e helper
    `createPageAndOpen` picks "Página en blanco" and asserts the editor
    URL; notebooks-acceptance + slash-command + editor-a11y + image-upload
    + flashcards-manual + exams-hub: 15 pass, 2 fail (exams-hub
    "offers its retake" and "marks a passed page…", also failing when
    rerun alone): page creation and the editor work; they fail in
    `takeExam`, whose stem is real AI text ("¿Qué componente…") instead
    of the fake provider's "Pregunta N:" — the reused dev server on :3000
    is not running with the e2e fake AI env. Environmental, not this task.
    Screenshots `t3after-dialog-1440.png`, `-dialog-focus-1440.png`,
    `-dialog-390.png`, `-editor-1440.png` (lands in the editor).
  - Commit: `920be62`.
- [x] **H5-T4** — the empty notebook: a fan of sheets and one clear first step (user, 2026-10-29).
  - Route: delegated writer (new atom + page + tests + ATOMS.md).
  - Built: new atom `PageSheetFan` (three `PageSheet`s in the notebook's
    colour fanned with the `TechniqueFan` helpers, "Tu primera página" with
    a caret on the front sheet, container-query scale steps). The zero-pages
    state is now an `IllustratedEmptyState` (cascade, dotted paper):
    "Tu cuaderno está listo para su primera página" / "Escribe tus apuntes
    desde cero o importa un PDF, Word o PowerPoint. Luego podrás
    repasarlos con las técnicas de estudio." and the hub's violet pill
    "Nueva página" (opens the H5-T3 dialog, which holds the import
    option). Header meta "Cuaderno · Sin páginas todavía".
  - RED: 2 route tests (fan + CTA, header meta) failed → GREEN. The fan's
    own test was written right after the atom (not before).
  - Checks: tsc clean; biome clean; vitest scoped 1726 tests: 1725 pass, 1
    fail (`inicio` pre-existing); depcruise no violations. One iteration:
    front-sheet text resized to fit beside the fold; smaller scale steps
    for the 390 pre-existing sidebar. Screenshots `t4before-empty-1440.png`,
    `t4before-empty-390.png` (the old copy), `t4after-empty-1440.png`,
    `t4after-empty-blue-1440.png`, `t4after-empty-1024.png`,
    `t4after-empty-390.png`. e2e notebooks-acceptance + shell-empty-state +
    slash-command 24/24 pass (4.8m; every new notebook starts empty, so
    the CTA → dialog → blank path is exercised).
  - Commit: `b16efa3`.

## H6 — editor polish (user, 2026-10-29)
Scope (binding, user 2026-10-29): only E1–E7 below. Rejected: page icon/cover, full width, find in page, drag files, move-block shortcuts, toggle/YouTube/equation in the slash menu, tier C. No new node types; CSP unchanged, no new origins.
Route: delegated writer (one bounded writer for all seven items; 2+ non-trivial files per item). Screenshots: `scratchpad/editor-polish/before/` and `scratchpad/editor-polish/after/` (1440 and 390).
- [x] **H6-E1** — bubble toolbar hidden on a new page. Cause: a new page is stored as `{type:"doc",content:[]}`; ProseMirror finds no text position, starts with an AllSelection, which grows over the filled-in paragraph and is not empty. Fix: `withEditableStart` (editable-start.ts) hands Tiptap one empty paragraph (initial content and reconciled content). RED unit (AllSelection) + RED e2e (`editor-polish.spec.ts`) → GREEN. Commit `a766958`.
- [x] **H6-E5** — `>` + space opens a toggle (existing `details`, top-level paragraphs only), `"`/`“` + space opens a quote; StarterKit's own `>` quote rule dropped (`withoutQuoteChevron`). RED 3 unit → GREEN; e2e added. Commit `1acc1b0`.
- [x] **H6-E6** — one-click highlighting: toolbar highlighter chip in the last colour, chevron → six palette colours + "Quitar resaltado", Mod+Shift+H (replaces the extension's colourless default). Last colour in localStorage (`cogni.editor.highlight.v1`) with in-memory fallback. Existing highlight mark only. StudyFetch research: no public docs found on its highlighter; pattern follows common selection-toolbar highlighters. RED unit (8 + 3) → GREEN; e2e added. Commit `d5454c1`.
- [x] **H6-E2/E3** — Notion density (2px block padding, no list/task margins, more room above headings), quote = 3px ink bar + upright ink text, callout = soft pastel tint + ink text + kind-coloured icon; `--radius-editor` (3px) on editor blocks and floating surfaces. Shared atoms unchanged: editor surfaces opt in with `editor-surface` (unlayered rule in globals.css; the Command atom's `rounded-xl!` overridden per call site). Design-system README + colors_and_type.css document it. RED callout test → GREEN. One visual iteration (table cells, slash menu radius). Commit `0bad98c`.
- [x] **H6-E4** — code-block language: native select → hover/focus label at top-right opening a radio menu (keyboard: Tab + Enter/arrows). `code-block-language` test id kept, value in `data-language`; docx e2e updated. RED → GREEN. Commit `35e1cbc`.
- [x] **H6-E7** — breadcrumb: 15px, current page medium ink, chevron separators, 32px hover targets with underline, truncation + title, container query keeps only parent + current under 32rem. RED 4 → GREEN (the narrow-topbar test was written after the code). Commit `2c1b216`.
- Checks (2026-10-29): `pnpm typecheck` clean; biome on the 28 changed files clean; vitest editor + shared/ui + (app) + no-inline-hex 1832 tests: 1831 pass, 1 fail (`inicio` pre-existing); depcruise no violations; e2e editor-polish + slash-command + editor-a11y + image-upload + docx-import 14/14 pass (4.4m).
- Open: at 390 the app shell (sidebar does not collapse) leaves the topbar ~70px, so the breadcrumb cannot show a useful label at that width — a shell responsiveness issue, not the breadcrumb's. RDD not run by this writer.

## H7 — editor polish round 2 (user, 2026-10-29)
Scope (binding, user 2026-10-29): items 1–8 below only. Rejected again: page icon/cover, full width, find in page, drag files, move-block shortcuts, YouTube in the slash menu. CSP unchanged, no new origins; Inter and Bitter self-hosted via `next/font` (no preload).
Route: delegated writer (one bounded writer; 2+ non-trivial files per item). Screenshots (1440): `scratchpad/editor-polish-2/before/` and `scratchpad/editor-polish-2/after/`. StudyFetch research: public pages only, no sign-in; the notes editor appears only as a video/lazy demo, so its highlighter could not be inspected — the marker look follows the brief.
- [x] **H7-1** — highlights as a marker-pen stroke: `--color-highlighter-*` (-300 steps, AA with ink), uneven radii, left-to-right ink gradient, `box-decoration-break: clone`; swatches/chip use the same tokens; mark and stored colours unchanged. RED (`highlight.test.tsx`) → GREEN. Commit `e17722b` (+ band tweak `70fcc34`).
- [x] **H7-2** — callouts in the pillar band hues at -200 (idea yellow, note violet, warning rose) with an italic, non-editable label by kind (Idea clave / Nota / Cuidado); content, plain text and catalogue untouched. RED (`callout.test.tsx`, 4) → GREEN. Commit `2a7cdaa`.
- [x] **H7-3/5/6** — code block on neutral grey `--color-code-block`; H1/H2/H3 scale (32/24/19px, 700/650/600, tracking −0.03/−0.02/−0.01em, more space above); tables: `--radius-table` 8px frame (corner cells clipped), inner hairlines, quiet header, 6×12 padding, tabular-nums, numeric cells right-aligned by a view decoration (`numeric-cells.ts`, no attribute). RED code-block assertion → GREEN; numeric-cells tests written with the code. Commit `03327d9`.
- [x] **H7-4** — "Texto" menu in the bubble toolbar (Notion/Docs-like placement next to "Convertir en"): 7 families, sizes Pequeño 14 / Normal 16 (unset) / Mediano 18 / Grande 22 / Muy grande 28, through the already-registered `@tiptap/extension-text-style` 3.31.3 FontFamily/FontSize (MIT; no new package). Offered values in the catalogue (`EDITOR_FONT_FAMILIES`, `EDITOR_FONT_SIZES`); stored stacks are mapped to the next/font faces in globals.css. RED catalogue tests → GREEN; plain-text test added. Commit `3727276`.
- [x] **H7-7** — formulas: slash "Ecuación" / "Ecuación en línea", `$…$` input rule (prices and `$ x $` excluded), click or Enter on a formula reopens it; floating LaTeX input with live KaTeX preview, strips pasted delimiters, empty = removed (never stored empty). KaTeX CSS/fonts bundled. RED (`math-editing.test.ts` import failure) → GREEN; editor and slash tests. Commit `7d01356`.
- [x] **H7-8** — undo/redo arrows beside the autosave status (meta row), disabled when unavailable, tooltips ⌘Z / ⇧⌘Z, `aria-keyshortcuts`, focus back to the editor. Tests written first, run after the code. Commit `d4677a1`.
- [x] **Fix found on the way** — the first click on any toolbar dropdown ("Convertir en", "Alineación", new "Texto") removed the BubbleMenu (Radix cancels pointerdown, so BubbleMenu never saw its mousedown) and the menu lost its anchor; the toolbar re-dispatches mousedown. RED unit (verified failing without the fix) → GREEN; e2e. Commit `e9fcd3f`. E2e `editor-polish-2.spec.ts` `c2037b1`.
- Checks (2026-10-29): `pnpm typecheck` clean; biome on the 34 changed files clean; vitest editor + notebooks + shared + (app) + no-inline-hex 2357 tests: 2356 pass, 1 fail (`inicio` pre-existing); depcruise no violations; e2e editor-polish + slash-command + editor-a11y + image-upload + docx-import + editor-polish-2 17/17 pass (5.2m); no console/CSP errors on the editor page (`after/console-errors.json` empty), CSP header unchanged (`font-src 'self'`).
- [x] **H7 follow-up (user, 2026-10-29)** — user approved H7 except two items, redone after `scratchpad/refs/callout-ref.png` and `highlight-ref.png`. Route: delegated writer.
  - Callouts: light tint + 1px same-hue border + 14px frame (`--radius-callout`), outlined icon in the strong step, text in the deep step (AA: 8.7–10:1; icons 3.5–5.2:1), inline code as a subtle chip; the italic label stays unstored and now floats inline at the start of the text ("*Idea clave* · …"). RED (`callout.test.tsx`) → GREEN.
  - Highlights: back to soft pastels (ink ≥ 13.7:1), full text-height band keeping the hand-drawn edges, fades, overrun and clone. Picker = the reference's five circular swatches (green, blue, pink, purple, yellow) with same-hue borders, a divider and a circle-slash "Quitar resaltado"; one-click button and Mod+Shift+H unchanged. Stored values unchanged (same palette names), so no catalogue change; orange and mint still render for existing pages. RED (`quick-highlight.test.ts`, `quick-highlighter.test.tsx`) → GREEN.
  - Commits `a744684` (callouts), `664212c` (highlights + design-system docs). Checks: typecheck clean; biome on the 8 changed files clean; vitest scope 2356/2357 (`inicio` pre-existing); e2e editor specs + editor-polish-2 17/17 (5.1m); no console/CSP errors.
  - Screenshots: `scratchpad/editor-polish-2/after-3/` (one iteration from `after-2/`: the inline label float was one line too tall).
- Open: numeric column headers stay left-aligned (only cells holding a number align right); the selected-cell overlay is square on the rounded corner cells. RDD not run by this writer.

## H8 — editor final polish (user, 2026-10-29)
Scope (binding, user 2026-10-29): items 1–6 below only. Rejected again: page icon/cover, full width, find in page, drag files, move-block shortcuts, YouTube in the slash menu. CSP unchanged, no new origins.
Route: delegated writer (one bounded writer; 2+ non-trivial files per item group). Screenshots (1440): `scratchpad/editor-polish-3/before/` and `scratchpad/editor-polish-3/after/`.
- [x] **H8-6** — code pasted into a code block keeps line breaks, indentation and blank lines: a `handlePaste` plugin (`extensions/code-block-paste.ts`) inserts text/plain literally; an HTML-only payload (`<div>` per line, `<pre>`, `<br>`, `&nbsp;`) is rebuilt line by line. Only a selection inside one code block is handled; the language (and colouring) is untouched; paste rules do not run. RED (HTML-only paste collapsed into one line; 5 failing) → GREEN 9/9. Commit `5fdbfca`.
- [x] **H8-5** — callouts "Importante" (blue, `CircleAlert`) and "Consejo" (green, `CircleCheck`) in the outlined H7 style with the inline italic label; `callout.kind` enum gains `important` and `tip` (catalogue + slash items "Callout importante" / "Callout de consejo"); tokens `--color-callout-important-*` / `--color-callout-tip-*` (text 9.5:1 and 8.7:1, icons 4.8:1). Plain text is kind-agnostic (test added). `documento-maestro.md` §3.2 only lists idea/nota/advertencia as minimum; no clashing terms. RED 7 → GREEN. Commit `f2de5dc`.
- [x] **H8-1** — slash menu: 15rem wide, up to 26rem tall; labels and descriptions shown in full and wrapping; icons are the bare glyph (toned "@" rows keep their tinted tile); groups, keyboard navigation, filtering and `editor-surface` unchanged. RED 2 → GREEN. Commit `04bd977`.
- [x] **H8-2/3/4** — toolbar: "Texto" keeps only the font family ("Fuente"); a size menu next to it shows the current size in px (14/16/18/22/28, same options) with the label in its accessible name; the bold glyph is drawn at stroke 2.75; "Color de texto" is an "A" over a bar in the current colour, its popover now only text colours (circular bordered swatches, divider, circle-slash "Quitar color"; the duplicate highlight row was removed, highlighting lives in the highlighter); tooltips on the highlighter ("Resaltar · ⇧⌘H"), its chevron ("Colores de resaltado"), "Color de texto", "Fuente" and "Tamaño"; shortcuts print as macOS symbols. RED 9 → GREEN. e2e editor-polish-2 and notebooks-acceptance moved to the new controls. Commit `754986c`.
- [x] e2e `editor-polish-3.spec.ts` (paste plain+HTML with reload, HTML-only paste, both callouts from "/", size menu) 4/4. Commit `259ab6b`.
- Visual iteration (one): size menu widened so "Muy grande" stays on one line; text swatches enlarged to the highlighter's 24px.
- Checks (2026-10-29): `pnpm typecheck` clean; biome on the 20 changed code files clean; vitest editor + notebooks + shared + (app) + no-inline-hex 2381 tests: 2380 pass, 1 fail (`inicio` pre-existing); depcruise no violations; e2e editor-polish + editor-polish-2 + editor-polish-3 + slash-command + editor-a11y + image-upload + docx-import 21/21 (20 in the suite run, 7.2m; the slash-command callout test timed out in notebook setup, `openNotebook` link wait, and passed 3/3 on rerun); no console/CSP errors on the editor page (`after/console-errors.json` empty).
- Open: the size trigger shows the px value ("16") rather than the word, to keep the toolbar width stable; the text-colour palette keeps all seven colours (orange and mint included). RDD not run by this writer.

## H9 — techniques panel (user, 2026-10-29)
Scope (binding, user 2026-10-29): the page editor's "Técnicas de estudio" panel lacked presence. Simplify the tiles, explain the "Generado en esta página" empty state, light overall polish; width (264) and collapse unchanged. Players untouched (Phase 6 freeze).
Route: delegated writer (one bounded writer; 2+ non-trivial files: `technique-card.tsx`, `techniques-panel.tsx`). Screenshots (1440): `scratchpad/techniques-panel/before/` and `scratchpad/techniques-panel/after-2/` (empty + one flashcards row, seeded by DB insert; no AI generation).
- [x] **H9-T1** — tiles are icon + name + "Te quedan N generaciones hoy" (new `meta` slot under the name) + "Generar"; descriptions removed (`TechniqueDefinition.description` and `TechniqueCard.description` gone). Each tile is tinted in its technique colour (`bg-pastel-*/55`, `border-pastel-*-fg/18`), white icon tile with the -fg glyph, 13px bold name, a white 32px "Generar" with the -fg label (AA on white) and pastel hover. Notices/errors stay under the button; disabled, limit, pending and the exam dialog path unchanged. Empty state: `TechniqueStack` glyph (new atom, three fanned pastel tiles) + "Aquí verás todo lo que generes" / "Las flashcards, preguntas y exámenes que crees a partir de esta página aparecerán en esta sección para que los practiques." Header: violet `Sparkles`, 13px bold title, same subtitle. ATOMS.md updated. RED 9 → GREEN. Commit `88b5f07`.
- Visual iteration (one): the stack glyph's side tiles fanned wider (they hid behind the front tile).
- Checks (2026-10-29): `pnpm typecheck` clean; biome on the 6 changed code files clean; vitest notebooks + shared/ui + no-inline-hex 697/697; `pnpm depcruise` no violations. e2e NOT run: every panel spec clicks "Generar" and the dev server on 3000 runs without `AI_PROVIDER_MODE` (schema default `live`), and Playwright reuses it, so the specs would call real AI. `techniques-panel-generated.spec.ts` updated to the new empty copy; other specs only assert unchanged test ids and the unchanged remaining copy.
- Open: run the panel e2e specs against a fake-AI server (restart the server with `AI_PROVIDER_MODE=fake`). RDD not run by the writer.
- [x] **H9-T2** (user feedback on T1, 2026-10-29) — T1's flat pastel tiles rejected. Tiles now reuse Home's "Tu progreso de hoy" look (`TechniqueCountCard`'s globals.css `technique-glow-*`, exported as `TECHNIQUE_GLOW_CLASS`): white `rounded-xl` card, pastel 36px icon tile + one-line 15px semibold name in one row, a 36px pastel-pair "Generar" below, "Te quedan N generaciones hoy" under the button (the `meta` slot from T1 removed). Panel title 17px bold (was 13), panel 280px (was 264; the editor keeps ample room at 1440), collapsed width 56 with 40px icon tiles (was 36), tooltips kept. Empty state: white card with `TECHNIQUE_TRIO_GLOW_CLASS` (new, the three pastels faded from three corners), title kept, body "Empieza con una técnica de arriba." (one line). ATOMS.md updated. RED 9 → GREEN. Commit `eeb8de8`. Route: delegated writer (same writer; 2 non-trivial files). Screenshots: `scratchpad/techniques-panel/t2-before/` and `scratchpad/techniques-panel/t2-after-2/` (expanded empty, with one row, collapsed); `t2-after/` was the first pass, at 264px, where the subtitle wrapped.
- Checks H9-T2 (2026-10-29): `pnpm typecheck` clean; biome on the 4 changed code files clean; vitest notebooks + shared/ui + no-inline-hex 697/697; `pnpm depcruise` no violations; e2e not run (same reason as T1: live-AI dev server on 3000).
- [x] **H9-T3** (user approved the H9-T3 preview `scratchpad/techniques-panel/t3-mock/compare.png`, main proposal, body variant A, 2026-10-29) — tile radius 16 → 12px (size unchanged, H9-T2 fade kept); icons are a new `PixelTile` atom (`src/shared/ui/pixel-tile.tsx`, the landing dither ported app-side, 2px cells, crisp Lucide glyph): 36px on the tiles, 48px on the collapsed rail with their tooltips; "Generar" outlined (`border-[1.5px]`, transparent) with the label in the technique ink and new outline tokens `--color-technique-flashcards-outline` #b45309 / recall = success-600 / exam = rose-600, filled with the pastel on hover (measured: text 6.72 / 7.21 / 6.65:1, border 4.76 / 3.54 / 4.25:1, hover text 6.37 / 6.78 / 5.88:1); pixel-tile colours in globals.css `.pixel-tile[data-tone]` (+ `--color-pixel-rose-dark/-light/-shadow`, `--color-pixel-paper`); empty state a plain neutral card (no icon, no colour) with "Empieza con una técnica de arriba."; toggle 36px in the expanded header and 48px when collapsed, same column as the rail tiles (rail 64px), `title` = aria-label. `TechniqueStack` and `TECHNIQUE_TRIO_GLOW_CLASS` removed. ATOMS.md updated (PixelTile section). RED 7 (+ pixel-tile suite) → GREEN. Commit `9a52946`. Route: delegated writer (same writer; 3 non-trivial files + CSS). Screenshots: before = `scratchpad/techniques-panel/t2-after-2/`, after = `scratchpad/techniques-panel/t3-after/` (empty, items, items + hover on Recordación activa, collapsed); compared with the mock, no deviation needed a fix (the iteration pass changed nothing).
- Checks H9-T3 (2026-10-29): `pnpm typecheck` clean; biome on the 7 changed files clean; vitest notebooks + shared/ui + no-inline-hex 702/702; `pnpm depcruise` no violations; collapsed toggle and the three tiles centred on the same x (1400) at 48px; e2e not run (live-AI dev server on 3000, as in T1/T2).

## H10 — technique empty states (user, 2026-10-29)
Scope (binding, user 2026-10-29): the empty states of `/flashcards`, `/active-recall` and `/exams`, in the H4-T1..T3 / H5-T4 pattern, all at once. Explicit go-ahead past the Phase 6 Active Recall UI freeze for this empty state only; players and session screens untouched. Generic example content only.
Route: delegated writer (2+ non-trivial files: new atoms + three hub pages + tests + ATOMS.md). Screenshots (fresh user, deleted afterwards): `scratchpad/technique-empty/before/`, `after-1/` (first pass), `after/` (final), each `{flashcards,active-recall,exams}-{1440,390}.png`.
- [x] **H10-T1** — new atoms `TechniqueEmptyArt` (`technique`: flashcards yellow fan with a `PixelTile` and "¿Qué es…?" + "Toca para voltear"; recall mint stack with "Pregunta abierta", "¿Cómo lo explicarías?" and an answer line "Explícalo con tus palabras…" with a blinking caret; exams pink stacked sheets with "Opción A/B/C", B chosen) on the shared `TechniqueFan` helpers and the `PageSheetFan` stage, and `EmptyStateCta` (the H4/H5 violet pill as a link, wraps instead of clipping). Each hub's `EmptyState` became an `IllustratedEmptyState` (cascade, dotted paper): "Tus primeras flashcards te esperan" / "Genera tarjetas desde cualquier página de tus cuadernos y repásalas aquí."; "Practica explicando con tus palabras" / "Genera preguntas abiertas desde una página de tus cuadernos y respóndelas aquí."; "Pon a prueba lo que sabes" / "Genera un examen desde una página o con «Crear examen»."; CTA "Ir a mis cuadernos" → `/notebooks` on all three. Load errors keep their message under the same headline. Headers unchanged. ATOMS.md updated.
  - CTA decisions: `CreateExamDialog` without notebooks only says "Aún no tienes cuadernos. Crea uno para empezar.", so the exams CTA is "Ir a mis cuadernos" and "Crear examen" stays in the header. Manual flashcards exist only on an existing deck's page, so flashcards also points to the notebooks. Active recall's "Nueva sesión" is rendered only when a page has questions, so the empty hub shows none (asserted by the existing unit test).
  - RED: 6 hub tests + 2 atom suites (module not found) → GREEN 44/44.
  - Visual iteration (one): landscape cards enlarged (flashcards 220×148, recall 228×152) to match the exam sheet's weight; CTA wraps at the 390 pre-existing sidebar instead of clipping; exam message shortened.
  - Checks (2026-10-29): `pnpm typecheck` clean; biome on the 14 changed code files clean; vitest `(app)` + shared/ui + no-inline-hex 1446 tests: 1445 pass, 1 fail (`inicio` pre-existing); `pnpm depcruise` no violations; e2e `shell-empty-state.spec.ts` 16/16 (new fresh-owner scenario for the three hubs). Not run (need AI generation; the dev server on 3000 runs live AI): `active-recall-hub`, `exams-hub`, `exams-create` — copy assertions updated only.
  - Commit: `2734110`.
- Open: at 390 the pre-existing 240px sidebar squeezes the column (headline and message wrap word by word; "Crear examen" in the header is off-screen). The notebook views (`/flashcards/[id]`, `/active-recall/[id]`, `/exams/[id]`) keep their plain `EmptyState`. RDD not run by the writer.

## H11 — technique hubs: empty states v2 and creating from the section (user, 2026-10-29)
Scope (binding, user 2026-10-29): implement the approved v2 empty-state mock (`scratchpad/technique-empty/v2-mock/`) in `/flashcards`, `/active-recall` and `/exams`, and let each hub create its technique through a "pick a page" dialog (every item table has `page_id NOT NULL`). No backend, schema or new use cases: the existing Server Actions are reused. Players untouched.
Route: delegated writer (2+ non-trivial files: atoms, three hubs, dialogs, tests, CSS). Screenshots (fresh users, deleted afterwards): `scratchpad/technique-empty/h11/part1/` (empty states, first pass and the CTA fix) and `scratchpad/technique-empty/h11/after/` (final: `{route}-empty-{1440,390}`, `{route}-modal-{no-notebooks,no-pages,page-selected}`, `flashcards-modal-manual`, `*-modal-page-selected-390`, `flashcards-deck-new-card`, `{route}-one-item-{1440,390}`; recall session and exam question seeded by DB insert, the flashcard through "Crear a mano"; no AI).
- [x] **H11-T1** (part 1, visual) — `TechniqueHubHeader` (48px `PixelTile` + eyebrow + 32px technique-gradient title, 26px on phones, counts) on all three hubs, empty or not. `TechniqueEmptyArt` rewritten as the mock (server component, `.tea-*` CSS in globals.css, container-query `zoom` steps): flashcards straight deck (4 cards behind, 7px right / 8px up, pale → amber, front "Pregunta", "1 / 12", generic question, "Toca para voltear", dots); recall speech bubble + ruled sheet ("De memoria, sin mirar tu apunte", Caveat handwriting with a blinking caret, "24 palabras", self-rating chips); exams clean sheet (header, tilted 8/10, 10-step strip, A–D with B chosen). Technique tokens `--color-technique-{flashcards,recall,exam}-{glow,glow-soft,dot,ink,ink-deep,cta,cta-fg,cta-edge,cta-shadow}`; `[data-technique-theme]` re-points `text-gradient-brand`, `empty-state-glow` and `dotted-paper` (violet fallback) and `EmptyStateCta tone="technique"`. Caveat self-hosted in the root layout as `--font-handwriting`, not preloaded, used only by `.tea-hand`. Caret still under reduced motion (CSS). ATOMS.md updated. RED 8 + header suite → GREEN. Commit `d6002b1`.
  - Visual iteration (one): the technique CTA rendered near-black (the Button's `bg-primary` won the cascade over the `technique-cta` utility); fill/ink moved to `bg-(--theme-cta) text-(--theme-cta-fg)` so tailwind-merge drops the Button's, `technique-cta` keeps edge + shadow. After that the three 1440 shots match the mock.
- [x] **H11-T2** (part 2, flow) — `PagePicker` (shared/ui; notebook then page; "Crear un cuaderno" → `/notebooks` without notebooks, "Crear una página" → `/notebooks/{id}` for a notebook without pages, load error on null) now also drives `CreateExamDialog`, which gains `trigger: "button" | "cta" | "tile"` and is no longer a dead end without notebooks. `TechniqueCreateTile` (dashed violet, `DeckSummaryCard`-sized) is the first, fixed item of each hub grid. `CreateFromPageDialog` (`flashcards/_components`, also used by the recall hub): flashcards "Generar con IA" (`generateFlashcardsAction`, then the deck `/flashcards/{nb}/{page}`, where the panel's row also goes) or "Crear a mano" (`/flashcards/{nb}/{page}?nueva=1`; the deck route already renders for a page with 0 cards, and `NewFlashcardDialog initialOpen` opens at once and drops the flag with `router.replace`); recall "Generar con IA" only (`generateRecallQuestionsAction`, then `/active-recall/{nb}/{page}`). Panel copy reused (AI_PAGE_EMPTY plus an "Abrir la página" link, limit, session, no new content as a notice); "Te quedan N generaciones hoy" from `getGenerationStatusAction` (`_lib/remaining-generations.ts`, unknown → null), AI path disabled at 0, "Crear a mano" still allowed. CTA copy: "Crear mis primeras flashcards", "Generar mis primeras preguntas", "Crear mi primer examen"; empty-state messages updated to match. `maxDuration` on the hubs that now host the actions (flashcards 120, recall 300, exams 120, as their page routes). `ChoiceGroup` gains `tone="amber"`. ATOMS.md updated. RED 11 + 3 suites → GREEN. Commit `d3b5975`.
  - Size: the commit is about 1,850 changed lines, two thirds tests; the dialog, picker, tile and three hub rewires are one behaviour (create from the section), so it was not split artificially.
  - Recall manual creation does NOT exist (documento-maestro: recall questions are AI-generated), so the recall dialog has no "Crear a mano" path, by design.
- Checks (2026-10-29): `pnpm typecheck` clean; biome on the 25 changed code files + globals.css clean; vitest `(app)` + shared/ui + modules/flashcards + modules/notebooks + no-inline-hex 1923 tests: 1922 pass, 1 fail (`inicio` "tells done, idle and never-generated techniques apart", pre-existing); `pnpm depcruise` no violations; e2e `shell-empty-state.spec.ts` + new `technique-hubs-create.spec.ts` 18/18 (2.5m; modal from each empty hub with no notebooks, no pages and a page chosen; "Crear a mano" creates a first card and the grid shows the tile first). Not run (live AI on the reused dev server): `exams-create`, `active-recall-hub`, `exams-hub` (copy assertion updated in `exams-create` only; the other two only assert unchanged headlines).
- Open: `?nueva=1` is dropped about 1s after the deck mounts on the dev server; a card saved before that leaves the flag in the URL, so a manual reload would reopen "Nueva tarjeta" (harmless). The 390 squeeze from the pre-existing 240px sidebar remains (H10 open item). RDD not run by the writer.

## H12 — AI-only creation dialogs and polishing every form dialog (user, 2026-10-29)
Scope (binding, user 2026-10-29): the hub creation dialogs (`CreateFromPageDialog` flashcards/recall, `CreateExamDialog`) offer only notebook, page and "Generar"; manual creation elsewhere stays. Polish every form dialog (selects, inputs, option rows, confirms) on shared atoms.
Route: delegated writer (2+ non-trivial files: atoms, a dozen dialogs, unit and e2e specs, ATOMS.md). Screenshots at 1440 (fresh users, deleted afterwards): `scratchpad/dialogs/before/`, `iter1/`, `iter2/`, `after/` (`shoot.mjs`; seeded by DB insert, no AI).
- [x] **H12-T1** — AI-only hub dialogs: "Crear a mano" and "Crear mis preguntas" removed; `?nueva=1` auto-open removed from the deck route and `NewFlashcardDialog` (`initialOpen` gone); `ChoiceGroup` deleted (no other user); hub empty-state copy no longer promises manual creation (flashcards "…y la IA crea tarjetas para repasarlas aquí.", exams "…y la IA crea un examen de opción múltiple desde su texto."). Limits, empty-page error + "Abrir la página", no-notebooks/no-pages CTAs and the exam count 10–30 kept. RED 2 → GREEN. e2e `technique-hubs-create` (first card now via the deck's "Nueva tarjeta") and `exams-manual-questions` (questions screen opened by URL) updated. Commit `b392cf3`.
- [x] **H12-T2** — atoms: `Select` (Radix Select from `radix-ui`, nothing installed; keyboard via Radix), `FieldLabel`, `FormMessage`, `GenerationsLeft`; `Dialog` shell (20px radius, p-6, header `icon` slot, separated footer band, "Cerrar"); `Button` `brand` (violet) and `technique` (`--theme-cta*`) variants; `CountStepper size="field"` with hint. `PagePicker` on `Select`. Technique dialogs (create flashcards, generate recall questions, create exam, exam count) tagged `data-technique-theme`, 48px `PixelTile` header, technique-coloured "Generar". Test helpers `select.testing.ts` and `tests/e2e/helpers/select.ts` replace `selectOption`. RED 9 → GREEN. Commit `9b8d972`.
  - Visual iteration (one): the Select check used `--theme-ink`, but the listbox is portalled outside the theme and rendered violet in the exams dialog; switched to neutral ink.
- [x] **H12-T3** — remaining dialogs: Nuevo/Renombrar cuaderno (description, `FieldLabel` + 44px `Input`, `brand` primary), Apariencia (description, 40px swatches, `aria-pressed` + check), Nueva página (shell's spacing), Nueva tarjeta (flashcards theme), question form (exams theme, bordered answer rows with a rose tint on the correct one), archive/retire confirms (`FormMessage`, destructive kept). RED 5 → GREEN. Commit `34c6d50`.
  - Visual iteration: question form description shortened (orphan line) and answer input padding reduced.
- Checks (2026-10-29): `pnpm typecheck` clean; biome on the changed files clean; vitest `(app)` + shared/ui + modules + no-inline-hex 4844 tests: 4843 pass, 1 fail (`inicio` "tells done, idle and never-generated techniques apart", pre-existing); `pnpm depcruise` no violations; e2e `technique-hubs-create` + `exams-manual-questions` + `shell-empty-state` 19/19 passed (3.7m). Not run (live AI): `exams-create`, `incremental-generation` (only their select steps and copy changed).
- Remaining manual-creation entry points (for the user to decide later): flashcards deck `/flashcards/{nb}/{page}` "Nueva tarjeta" (header and empty state) and per-card "Archivar"; exam questions screen `/exams/{nb}/{page}/preguntas` "Nueva pregunta", "Editar", "Retirar", reached from `ExamPageCard`, exam start "Ver preguntas" and results "Editar preguntas". Recall has no manual creation.
- Open: for a page with no exam questions, `/exams/{nb}/{page}/preguntas` (and `/exams/{nb}/{page}`) is now reachable only by typing the URL (no UI link lists a page without questions); nothing added, per the user. Dialog triggers outside dialogs ("Crear examen" header button, "Nueva tarjeta", "Nueva pregunta") keep the dark default button. RDD not run by the writer.

## H13 — content creation is AI only (user, 2026-10-29)
Scope (binding, user 2026-10-29): remove the remaining manual creation entry points (deck "Nueva tarjeta", questions screen "Nueva pregunta"); keep managing AI items ("Archivar" cards, "Editar"/"Retirar" questions); no backend, no schema change; existing manual rows keep working. Added mid-task: drop "Crear examen" from the exams hub header and, on `/exams/[notebookId]`, replace the header button with the hubs' CTA + first fixed tile.
Route: delegated writer (2+ non-trivial files across flashcards, exams, shared/ui, e2e and docs).
- [x] **H13-T1** — flashcards: "Nueva tarjeta" gone from the deck header and empty state; `NewFlashcardDialog` + test deleted; `createFlashcardAction` removed (actions tests reseed archive cases in the fakes). Empty deck: "Genera un mazo desde la página…" + `EmptyStateCta` "Generar desde la página" → `/notebooks/{nb}/pages/{page}`. Last-card refusal now "Genera más desde la página antes de archivar esta." e2e: `flashcards-manual` → `flashcards-deck` (absence + archive), `flashcards-review`, `-due-today`, `-session-feedback`, `technique-hubs-create` seed cards with the new `tests/e2e/helpers/flashcards.ts`. Kept: `createManualFlashcard` (the `DrizzleDeckUnitOfWork` db tests drive lock/positions through it), `MAX_FLASHCARD_SIDE_LENGTH`, `origin: "manual"`. RED 2 → GREEN. Commit `22d406a`.
- [x] **H13-T2** — exams: "Nueva pregunta" gone; `QuestionFormDialog` is edit only (no `mode`, "Editar pregunta"/"Guardar cambios"); `createExamQuestionAction` removed (actions tests seed through the use case); empty state links "Generar desde la página"; minimum note "Genera {n} más con IA desde la página…"; header leaves out "0 manuales". e2e `exams-manual-questions` → `exams-questions` (seeded via `tests/e2e/helpers/exam-questions.ts`, origin manual; absence, edit, retire). Kept: `createExamQuestion` (db tests unit-of-work/session/retake and actions.test seed through it; `editExamQuestion` reuses `ExamQuestionContent`). RED 4 → GREEN. Commit `1ba4a72`.
- [x] **H13-T3** — exams headers: no "Crear examen" in the `/exams` header; `/exams/[notebookId]` gains the empty-state CTA (themed wrapper) and the grid's first tile, notebook preselected; `CreateExamDialog` loses the `"button"` trigger (default `"tile"`). e2e selectors updated in `exams-create` and `incremental-generation` (not run, live AI); `exams-questions` asserts tile and no header button on both screens. RED 4 → GREEN. Commit `a44f351`.
- Docs: master doc §3.3 flashcards and exams lines, the Phase 6 note (no "Crear mis preguntas", header moved); flashcards and exams READMEs; ATOMS.md (dialogs, question form, questions screen, create tile).
- Checks (2026-10-29): `pnpm typecheck` clean; biome on the 36 changed code files clean; full vitest 5270 tests: 5269 pass, 1 fail (`inicio` "tells done, idle and never-generated techniques apart", pre-existing); `pnpm depcruise` no violations; e2e `flashcards-deck`, `flashcards-review`, `flashcards-due-today`, `technique-hubs-create` 5/5; `exams-questions` + `shell-empty-state` 17/17; `exams-questions`, `exams-hub`, `technique-hubs-create`, `shell-empty-state` 19/19. Not run (AI): `flashcards-session-feedback`, `exams-create`, `incremental-generation`.
- Open: RDD not run by the writer.

## H14 — page content thresholds for AI generation (user, 2026-10-29)
Scope (binding, user 2026-10-29): 100 words minimum of page content for any technique, about 15 words per generated item; server authoritative, before the daily limiter; `AI_PAGE_EMPTY` kept for blank pages; no schema change; no real AI in e2e.
Route: delegated writer (kernel, three modules, notebooks read model, panel and hub UI, e2e, docs).
- [x] **H14-T1** — kernel `generation-capacity.ts`: `MIN_GENERATION_WORDS` 100, `WORDS_PER_ITEM` 15, `maxItemsForWords`, `requiredWordsFor`, `examCountsForWords` ({10..30} ≤ capacity, 150 words for 10), `RECALL_MIN_WORDS`/`EXAM_MIN_WORDS` 150, `flashcardCountForWords` (clamp 3..10; 100 words → 6), `PageTooShortError` (`AI_PAGE_TOO_SHORT`, `words`/`minWords`/`maxItems`). `page-paragraphs.consumedParagraphs`: fewer items than asked → only that share of the sent words is fingerprinted (via `paragraphsWithinWords`, first paragraph always once any item came back); no fingerprint model change. Flashcards `requestGeneration` + action mapping. RED (kernel module missing; action mapping 1) → GREEN. Commit `1b9f69c`.
- [x] **H14-T2** — exams `requestExamGeneration` + action mapping (counts carried on the action error, tracked as `empty`). RED 4 → GREEN. Commit `0e1baf2`.
- [x] **H14-T3** — recall `requestRecallGeneration` (150 words, before the peek) + action mapping; db test `recall-unit-of-work` text lengthened. RED 3 → GREEN. Commit `8d442c7`.
- [x] **H14-T4** — read model `listPagePickerTree` / `getPagePickerTree` (notebooks; words counted server side, no `plain_text` to the client); `loadCreateExamNotebooks` uses it; `PagePicker` `minWords` (100 flashcards, 150 recall and exams) disables short pages with "Muy poco contenido (N palabras): escribe al menos M" (`SelectItem` `hint`); `CreateExamDialog` stepper limited to the page's counts ("Esta página admite hasta N preguntas"); `AI_PAGE_TOO_SHORT` copy in both hub dialogs (`shared/ui/short-page-copy.ts`). RED 2+4+2+1 → GREEN. Commits `7724e05`, `style` follow-up.
- [x] **H14-T5** — panel: `page-words.ts` (window event + last count per page); `PageEditor` publishes the words on mount and after each successful save; the panel disables each "Generar" under its minimum with the hint, limits the exam dialog's counts, maps `AI_PAGE_TOO_SHORT` on the three cards. `page.tsx` was outside the edit surfaces, so `initialWords` is not passed (the editor's mount publish covers it). RED 5+1 → GREEN. Commit `28e577f`.
- [x] **H14-T6** — e2e: `technique-hubs-create` sees the empty page disabled in each hub's picker (100/150), then sets 200 words of `plain_text` (`helpers/page-text.ts`) and picks it; 13 fake-AI specs type a 156-word study filler after their sentences (`helpers/study-text.ts`). Commit `77c2f54`.
- Docs: master doc §8 note "Contenido mínimo para generar"; flashcards, exams, active-recall and notebooks READMEs.
- Checks (2026-10-29): `pnpm typecheck` clean; biome on the 55 changed code files clean; full vitest 5333 tests: 5332 pass, 1 fail (`inicio` "tells done, idle and never-generated techniques apart", pre-existing); `pnpm depcruise` no violations; db `recall-unit-of-work` 2/2; e2e `technique-hubs-create` 2/2. Not run (AI): the 13 padded generation specs.
- Open: flashcards' panel and hub send no count, so the server derives it (6 to 10 cards); the whole-page word count in the pickers is an approximation of the new paragraphs (a page already generated may show enabled and get `AI_PAGE_TOO_SHORT` or `NO_NEW_CONTENT` from the server). RDD not run by the writer.

## Backlog — technique sections reform (user, 2026-10-18)
Parked for when the flashcards / active recall / exams sections are redesigned (not now; Active Recall has the Phase 6 UI freeze, so its changes need the user's explicit go-ahead at that time).
- [ ] TR-1 — No skipping in any technique (user rule): every question must be answered right or wrong so mastery and metrics stay meaningful. Today exams already comply; active recall has "Saltar" (`active-recall-player.tsx:171`, saved as "(sin respuesta)") and "Terminar" mid-session (`:272`); flashcards has "Terminar" mid-session (`flashcard-player.tsx:237`). Remove early "Terminar" (start = finish).
- [ ] TR-2 — Replace "Saltar" with an explicit "No la sé" answer recorded as incorrect (user liked this proposal): honest for metrics and never leaves the learner stuck.
- [ ] TR-3 — Exams hub "Repetir examen" copy: Home shows "Al día" once a session is finished that day (even if failed); the hub keeps the retake, but its button/text must convey "repeat when ready, ideally from tomorrow" instead of implying "now" (banner already hints "las preguntas falladas vencen mañana").
- [ ] TR-4 — Exams hub when a passed exam leaves questions due (e.g. 40 due, exam serves 30): the card says "Rendir examen", inviting a second exam the same day; revisit with the same criterion. Hub deliberately NOT aligned with Home's finished-exam rule (user decision 2026-10-18).


## Continuation branch (user, 2026-10-28)
- Phase 8 work continues on `feat/phase-8-hub`, made from `feat/landing-polish` 528dda9 (the stack is main → phase-8-design-flows → landing-v1 → legal-consent → landing-polish → phase-8-hub). The user chose to keep stacking (option B) so the app shows the new logo, /inicio and the legal notice while iterating.
- Next: the notebooks hub reform (H4), continuing after H4-T4 (6a41fa7, rebased as fd75456). Open follow-ups: SectionHeader advisory R3-001; delete the unused `notebook-list-row.tsx` (H4-T6). The List view create-control follow-up closed with H4-T6.
- H4-T6 committed as `5d4dff8`. Follow-up (inline, parent): deleted the now-unused `notebook-list-row.tsx` and fixed the comments and ATOMS.md entries that still named the removed card and list row. Checks: typecheck clean; vitest notebooks + (app)/notebooks + (app)/_components 608/608; biome clean.

### RDD, hub + notebook + editor (2026-10-29)
- 292d8fb..124eecc reviewed in 6 slices, each granted, approved and acknowledged (1 reliability lens per slice):
  1. 292d8fb..8108b54 (hub covers, five per row, list removal). Advisories: R3-reduced-motion-transform-none, R3-tile-reduced-motion-transform-none.
  2. 8108b54..12a9fb0 (pages header, sheets, create first, paper strips). Advisories: R3-empty-state-create-untested, R3-unmapped-tone-crash (WARNING: check an unmapped notebook colour cannot crash the sheet tone lookup).
  3. 12a9fb0..35b72c4 (create dialog, open the editor, empty notebook). Advisories: R3-asChild-trigger-unproved, R3-busy-and-pending-untested, R3-busy-scoped-per-notebook.
  4. 35b72c4..3ab4a78 (H6). Advisories: R3-e2e-fixed-sleep, R3-mod-shift-h-fallthrough, R3-stale-stored-color.
  5. 3ab4a78..3727276 (H7 part 1). Advisories: R3-001, R3-002, R3-003.
  6. 3727276..124eecc (H7 part 2 and the follow-up). Advisories: R3-ime-enter, R3-pointerdown-mousedown-all, R3-stale-math-pos, R3-weak-callout-assert.
- The reviewed boundary is now 124eecc. All advisories are non-blocking follow-ups.

## H15 — long names in the page picker (user, 2026-10-29)
- [x] Long notebook or page names broke the create dialogs: the "Generar" button was pushed out. Fix in the shared atoms:
  - The `Select` trigger value and the option labels clip to one line, with the full text in a `title` tooltip.
  - The list is as wide as the trigger, capped at the viewport.
  - `DialogContent` uses `grid-cols-[minmax(0,1fr)]`, so no child can widen any dialog.
  - Route: inline (2 atoms). RED observed on the new select test, then GREEN.
  - Checks: vitest shared/ui + technique hubs 923/923; typecheck; biome.
  - Browser check with a 130-character page title and a long notebook name in the recall dialog: at 1440 the button sits inside the dialog (button right 919 < dialog right 944); at 390 likewise (349 < 374). No horizontal overflow. Screenshots in `scratchpad/longtitle/`.

## H16 — hub return flow (user bug report, 2026-10-29)
- [x] **Bug.** From the `/active-recall` empty state, generating questions opened the session (correct), but back or "Terminar" landed on `/active-recall/[notebookId]` saying "Sin sesiones todavía", and the hub showed its empty state again.
- [x] **Root cause.** `DrizzleRecallHubReader.listRecallPages` only returned pages with a finished session that held answers (inner join on `recall_answers`, `finished_at is not null`). Generation saves `recall_questions` and their study items only; a session row appears with the first saved answer and is listed only once finished. Questions from the hub, or a session left open, never reached the hub or the notebook view. The player's back target was hard-coded to the notebook view (`sessionsHref = /active-recall/${notebookId}`). Revalidation was fine (`revalidateActiveRecall` already runs after generation).
- [x] **H16-T1** — reader lists pages with an active (non-archived) recall question or a finished session with answers, in one page query plus one session query; pages without a finished session come back with `sessions: []`. Notebook view: such a page gets a `RecallPageCard` `practice` variant ("Sin sesiones terminadas", "Practicar →", opens the session). Hub: the notebook card shows ("0 sesiones · último dominio 0 %"). Read-only query change, no schema change. Route: inline. RED: db reader test (2 failing) and notebook view test (1 failing) → GREEN. Commit `06593ff`.
- [x] **H16-T2** — `shared/navigation/hub-return.ts` (`?desde=hub` marker, never a URL). The hub dialog pushes `/active-recall/…?desde=hub` and `/flashcards/…?repasar=1&desde=hub` (flashcards now starts the review at once). Recall route passes `backHref` to the player (back links and the results' "Volver a las sesiones" → `/active-recall`); flashcards `DeckReview` `fromHub` (back link "Flashcards" → `/flashcards`, player "Todos los mazos" → `/flashcards`, the marker survives dropping `?repasar=1`). Default targets unchanged. RED: route test and dialog tests (3 failing) → GREEN. E2E `technique-hub-return.spec.ts` (seeded rows, no AI). Master doc §3.3 updated. Commit `88a2660`.
- [x] **Exams.** Not affected by the data bug: `/exams` already lists pages with questions. The create dialog lands on `/exams/[notebookId]` (H13), not on the exam, and its back link already goes to `/exams`. Going straight into the exam would need the marker through start → player → results; left for the user's call.
- Checks: typecheck clean; biome clean; vitest 5343/5344 (known inicio failure); depcruise clean; db `drizzle-recall-hub-reader` 5/5; e2e `technique-hub-return` 2/2 against the dev server (no AI call).
- Open: `docs/design-system/ATOMS.md` needs the `RecallPageCard` `practice` variant (outside this task's edit surfaces). `active-recall-hub.spec.ts` (fake AI) not re-run: it needs a fake-AI server on port 3000.
