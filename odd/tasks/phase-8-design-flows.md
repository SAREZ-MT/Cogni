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

## Backlog — technique sections reform (user, 2026-10-18)
Parked for when the flashcards / active recall / exams sections are redesigned (not now; Active Recall has the Phase 6 UI freeze, so its changes need the user's explicit go-ahead at that time).
- [ ] TR-1 — No skipping in any technique (user rule): every question must be answered right or wrong so mastery and metrics stay meaningful. Today exams already comply; active recall has "Saltar" (`active-recall-player.tsx:171`, saved as "(sin respuesta)") and "Terminar" mid-session (`:272`); flashcards has "Terminar" mid-session (`flashcard-player.tsx:237`). Remove early "Terminar" (start = finish).
- [ ] TR-2 — Replace "Saltar" with an explicit "No la sé" answer recorded as incorrect (user liked this proposal): honest for metrics and never leaves the learner stuck.
- [ ] TR-3 — Exams hub "Repetir examen" copy: Home shows "Al día" once a session is finished that day (even if failed); the hub keeps the retake, but its button/text must convey "repeat when ready, ideally from tomorrow" instead of implying "now" (banner already hints "las preguntas falladas vencen mañana").
- [ ] TR-4 — Exams hub when a passed exam leaves questions due (e.g. 40 due, exam serves 30): the card says "Rendir examen", inviting a second exam the same day; revisit with the same criterion. Hub deliberately NOT aligned with Home's finished-exam rule (user decision 2026-10-18).


## Continuation branch (user, 2026-10-28)
- Phase 8 work continues on `feat/phase-8-hub`, made from `feat/landing-polish` 528dda9 (the stack is main → phase-8-design-flows → landing-v1 → legal-consent → landing-polish → phase-8-hub). The user chose to keep stacking (option B) so the app shows the new logo, /inicio and the legal notice while iterating.
- Next: the notebooks hub reform (H4), continuing after H4-T4 (6a41fa7, rebased as fd75456). Open follow-ups: the List view has no create control; SectionHeader advisory R3-001.
