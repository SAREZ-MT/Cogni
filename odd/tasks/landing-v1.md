# Landing v1 — coded landing from Pencil "Prototipo v1" (ODD feature document)

Branch: `feat/landing-v1` (from `main` fa754ef). Engram mirror: `odd/landing-v1/tasks`.

## Objective
Build the Cogni landing in code using the Pencil frame "Landing · Prototipo v1" (`qXiWu` in `docs/landing/cogni-landing.pen`) as the base structure, with all 12 sections. Improve it with the installed design skills and web inspiration, and add motion design. The result is a starting point for the user's live review, not the final design.

## Problem / why
The landing exists only as Pencil prototypes. The user wants to see it running in the browser, with motion, before deciding what to change.

## Scope
- A public route `/landing`, reachable without a session, so the dashboard at `/` stays where it is. Moving the landing to `/` is a separate, pending plan (`cogni-landing-routing-plan`).
- Sections, in v1 order: nav, hero E with motion, "Así funciona Cogni" video slot (the video comes later, made with brag), technique tabs with a fanned deck, pillars 01–05 (colour band plus feature block), science quote over the constellation, draggable forgetting curve, honest comparison, "Total $0" receipt, FAQ as a chat, closing that ends in Hoy, footer with the privacy and audience link.
- Landing-local visual identity: it does not use the app design system or the `src/shared/ui` atoms (decision in `docs/landing/descripcion.md`).

## Constraints
- Motion with `motion` 14 (already installed) and `three` for the constellation (reuse the login constellation where possible); no new heavy dependencies.
- Respect `prefers-reduced-motion`; animate only transform and opacity; animations start on entering the viewport.
- Fonts through `next/font/google` (self-hosted, so no visitor IPs reach Google).
- Example content stays generic. Never show study time. Use "oportunidades de mejora". No invented testimonials or numbers.
- No backend, schema or domain changes. The only shared-code change is adding `/landing` to the proxy's `OPEN_PATHS`.
- Ask before every push or PR, and run the full e2e suite before any PR.

## Toolkit and inputs every task must use (user, 2026-10-27)
The goal is a different, attractive landing that integrates everything built so far. Every writer receives this list.
- **Design skills** in `.claude/skills/`:
  - `design-taste-frontend`, with its real-browser inspector and look-and-fix loop;
  - `impeccable`, `ui-ux-pro-max`, `emil-design-eng`, `apple-design`;
  - `animate`, `animation-performance`, `find-animation-opportunities`, `improve-animations`;
  - `break-ui`.
- **Motion and 3D:**
  - `motion` 14 (Motion for React), following the T0 recipes;
  - `three`: reuse the login constellation `src/app/(public)/_components/constellation-canvas.tsx`, including its WebGL resilience fixes.
- **Visual assets:** Higgsfield skills (`higgsfield-generate` and the others) for images and image sequences (T1b).
- **Research and references:**
  - `docs/landing/` files: `descripcion.md`, `inspiracion-motion.md`, `investigacion-diseno.md`, `investigacion-herramientas.md`, `comparacion-competidores.md`;
  - the hero E prototype in `docs/landing/motion/`;
  - the user's per-site picks (memory `cogni-landing-references-feedback`): Brilliant's structure and mascot, NotebookLM's constellation quotes, StudyFetch's video and stacked tabs, RemNote's feature blocks, Knowt's colour band and route.
- **Design galleries for inspiration:** Awwwards, One Page Love, Godly, Land-book, Motion UI and 21st.dev. Use WebSearch and WebFetch, and REA plus the isolated debug Chrome on port 9222 to tear down how a page is built.
- **Pencil:** the prototype frames v1 (`qXiWu`, the base), v2 (`SWujF`) and v3 (`HkEzU`) as references; Context7 for current library docs.

## Delivery strategy
`ask-on-risk`. Forecast: about 1,500–2,500 authored lines, mostly presentational components. Over the ~400-line budget, so ask once for a chain strategy before the PR stage. Work-unit commits per task.

## Tasks
- [x] T0 — Web inspiration and motion research (route: delegated, read-only explorer; trigger: broad web research). Per-section recipes are in Engram `odd/landing-v1/motion-research`. Key choices: one shared reveal, one signature motion per section, no smooth-scroll library, MotionConfig `reducedMotion="user"`, and hidden pre-states in CSS if the CSP blocks inline style attributes.
- [ ] T1 — Route `/landing` with layout, fonts and landing tokens; proxy `OPEN_PATHS`; nav, hero E with typing/highlight/cards/dates motion, and the video slot (route: delegated writer; trigger: 2+ non-trivial files).
- [ ] T1b — Visual asset pass with Higgsfield (user, 2026-10-27: "estilo educativo, pero que impacte"; image generation authorized). Define one art direction from the T1 hero, then generate images and image sequences where a section needs visual support: pillar visuals, the "camino de siempre" vs Cogni comparison, the closing, and frames for scroll-driven sequences. Assets go to `public/landing/` as optimised webp/avif. Every asset must be generic: no real subjects, brands or people's likeness. Route: delegated, per-action.
- [ ] T2 — Techniques tabs with the sliding fanned deck, and pillars 01–05 with scroll motion (route: delegated writer).
- [ ] T3 — Science constellation, draggable curve, comparison, receipt, FAQ chat, closing in Hoy, footer (route: delegated writer).
- [ ] T5 — Make the landing the domain root (user, 2026-10-27; plan `cogni-landing-routing-plan`; route: delegated writer after T1, because both touch `src/proxy.ts`). No DNS change is needed.
  - Move the dashboard from `/` to `(app)/dashboard/page.tsx`.
  - Serve the landing at `/`, by moving the `(marketing)/landing` page to `(marketing)/page.tsx`, and add `"/"` to `OPEN_PATHS`.
  - Point every post-login and auth redirect (login, register, OAuth callback, reset password) to `/dashboard`.
  - Update links that point to `/`: `identity/actions.ts`, terminos, the logo/sidebar, the hero, `kpi-row`, about 6 e2e specs, and any `redirect("/")` or `href="/"` found by a search.
  - Signed-in visitors on `/`: default proposal is to redirect them to `/dashboard` (to confirm with the user).
  - Keep `/landing` as a redirect to `/`, or remove it.
  - Tests: proxy unit tests and the affected e2e specs.
- [ ] T4 — Visual QA in the browser against the Pencil frame, reduced motion, and a design-skill polish pass (route: delegated; per-action verification).

## Acceptance criteria
- `/landing` loads without a session on the running dev server, with all 12 sections in v1 order.
- Motion runs on scroll and on interaction, and is disabled or simplified under reduced motion.
- typecheck, Biome and dependency-cruiser are clean, and the tests for the touched proxy code pass.

## Checks
`pnpm typecheck`, `pnpm biome ci` (or the repo lint script), `pnpm depcruise`, Vitest for the proxy, plus a browser check of `/landing`.

## Progress / evidence
- 2026-10-27: branch created from main. A dev server is already running on :3000 (next-server 16.3.8). T0 research delegated.

- 2026-10-27: T1 implemented and NOT committed; awaiting the user's visual review. The `(marketing)` route group holds the layout, `landing.css` tokens, reveal, nav, hero, hero-editor and how-it-works. `/landing` is in `OPEN_PATHS`; the proxy test went RED then GREEN, 6/6. typecheck OK, depcruise 0. Biome fails only on the untracked `.taste-skill/direction.json`. Parent spot check: curl /landing 200, vitest proxy 6/6.
- Blocker found: `motion`, `three` and the login constellation exist only on `feat/phase-8-design-flows` (21 commits, not merged into main). On this branch they resolve from `node_modules` but are missing from `package.json` and the lockfile. A decision is pending: rebase onto phase 8, or add the dependencies here.

- 2026-10-27: the user chose option A. T1 was committed as b550e21 and rebased onto `feat/phase-8-design-flows` (6a41fa7), so `motion` and `three` are now in `package.json`. After the rebase: typecheck OK, proxy 6/6, `/landing` 200.
- RDD: high risk (proxy hot path), consent granted, reliability lens approved, acknowledged (lineage `review-c001bb75c0d57372`). The reviewed boundary is now b550e21.
- Non-blocking advisories, to address in T4:
  - R3-fonts-ready-race in `hero-editor.tsx:155-165`;
  - R3-landing-signed-in-unproved, which overlaps T5;
  - R3-reduced-motion-midrun-blank.
- [x] T1 done (route: delegated; commit b550e21). The user's visual review is still pending.

- 2026-10-27: T1b BLOCKED. The Higgsfield CLI returns `only_mcp_usage_on_trial_is_available` because the account is a trial (plus plan, 110 credits), and the Higgsfield MCP server is not connected in this session. No credits were spent. Two art directions are drafted: A, soft matte 3D clay; B, editorial paper-craft on deep violet. `cwebp` is available for the export. Waiting on the user: connect the Higgsfield MCP, or authorise another generator.

- 2026-10-27: T2 committed as f92d454. It adds the techniques deck (card-stack motion, tablist a11y, autoplay only while in view) and pillars 01–05 (scroll-linked band plus one micro-demo each, with a `PillarVisual` image slot). 7 RED→GREEN tests. Writer checks: typecheck OK, biome clean, depcruise 0, vitest 8/8. Parent spot check: vitest (marketing) 8/8, /landing 200, screenshots reviewed.
- RDD: medium (slice_budget_reached), consent granted, reliability lens approved, acknowledged (`review-1d0a445cf06ff291`). The boundary is now f92d454.
- Advisories for T4:
  - R3-card-swing-ignores-reduced-motion;
  - R3-focus-pause-untested;
  - R3-reduced-motion-demos-still-animate;
  - the hydration mismatch in T1's `how-it-works.tsx` under reduced motion (fix it with a CSS hold, as the pillar band does).
- Open: confirm the product behaviour behind "La IA prepara, tú decides" (review, edit, choose what stays).
- [x] T2 done (route: delegated; commit f92d454).
- 2026-10-27: Higgsfield MCP added at user scope (`https://mcp.higgsfield.ai/mcp`, config backup `~/.claude.json.higgsfield.backup`). It needs a Claude Code restart and `/mcp` OAuth before T1b can rerun.

## Redesign reset (user, 2026-10-27)
The user rejected the coded design (T1 hero and T2 sections). The whole landing is redesigned from scratch, while the TEXTS and information are kept. Commits b550e21 and f92d454 stay on the branch as the starting code, and their sections are replaced one by one. Method: live iteration on :3000, section by section, with the user reviewing each one.
- [ ] R1 — New hero inspired by the tryprofound.com "The rise of AI Search…" section (teardown in Engram `cogni/landing/profound-hero-reference`).
  - A pinned full-screen scroll scene on near-black. The h1 "Recuerda lo que estudias." comes first.
  - Then the sentence "Cogni es tu plataforma de estudio, donde aprender y recordar por fin van de la mano." sharpens word by word from blur, scrubbed by scroll.
  - Behind it, a constellation network grows from sparse dots to a dense web. Its nodes are elegant, high-quality, coloured STUDY icons: not social networks, and not literally PDFs or technique colours.
  - Then the subtitle "Cogni convierte tus apuntes en flashcards, exámenes y preguntas de recuperación activa, y te dice qué repasar cada día para que no se te olvide." and the CTAs.
  - Route: delegated writer.
  - 2026-10-27: R1 v1 implemented and NOT committed, awaiting the user's live review.
    - Files: `hero.tsx` (pinned scrub), `hero-timeline.ts` and `hero-network.ts` (pure), `hero-network-canvas.tsx` (Canvas 2D hairlines plus DOM Phosphor icons), and 21 tests. `hero-editor.tsx` is deleted.
    - New dependency: `@phosphor-icons/react` 2.1.10 (MIT), imported per path.
    - No vertical guide lines (user correction).
    - Checks: typecheck, biome, depcruise clean; vitest (marketing) 28/28 on the parent spot check; /landing 200; about 59 fps scrolling on a laptop.
    - Open: the hydration mismatch in `how-it-works.tsx` (old section, to be redesigned).
  - 2026-10-27: the user liked R1, and R1 v1 was committed as 78fb0f0.
  - R1 v2 is uncommitted, awaiting review. It applies the three user corrections:
    - One-way latch: the scene freezes once it completes, and the pin then collapses to one viewport with scroll compensation (0px measured jump).
    - Constant ambient motion: a continuous Canvas 2D loop with node drift, travelling signals, pulses, floating icons and pointer parallax.
    - Login violet nebula background, with `--lp-night` set to #0b0717.
    - It also fixes the how-it-works hydration mismatch.
  - Checks: vitest (marketing) 35/35 on the parent spot check; 60 fps idle and while scrolling; no console errors.
  - Design note: rewind still happens mid-scrub; the latch applies only once the scene is complete. Strict max(progress) is a one-line change if the user wants it.
  - 2026-10-27: R1 v2 committed as 2eeb033 (approved: "gran avance").
  - R1 v3 is uncommitted, awaiting review:
    - a cursor light replaces the parallax (offscreen radial-masked brighten, mouse only);
    - 170 twinkling, unconnected stars (80 on phones), dimmer over the copy;
    - drift doubled to 14px and about 50% faster;
    - denser web (6 nearest neighbours plus medium and long links, seeded separately so the approved layout is kept) with length alpha falloff;
    - more signals.
  - Checks: vitest (marketing) 41/41 on the parent spot check; 60 fps idle and scrolling.
  - 2026-10-27: R1 v3 committed as 052069d.
  - R1 v4 is uncommitted, awaiting review:
    - the cursor light is half as strong, with a 200px radius;
    - the whole web breathes (±4%, 8 s sine, spatial phase offset);
    - the icons are hidden for a test, behind `SHOW_ICONS = false` at `hero-network-canvas.tsx:149`.
  - Checks: vitest (marketing) 45/45 on the parent spot check; 60 fps.
  - 2026-10-27: R1 v5 is uncommitted, awaiting review.
    - Icons are back (`SHOW_ICONS = true`).
    - Focus pulse like Profound: each icon cycles 4–9 s, blurs up to 2.6px and dims to 0.78; about a third are blurred at any time.
    - Global breathing replaced by cluster-local breathing: icon clusters scale ±12% around their own centres, with independent 6–10 s phases, and sparse areas stay calm. The per-node drift dropped to 6px.
    - Profound teardown: everything, icons and blur included, is drawn on one canvas; nodes move about 10–30px. Ours moves about 5–20px; `CLUSTER_AMPLITUDE` can raise it.
    - Checks: vitest (marketing) 49/49 on the parent spot check; 60 fps.
  - 2026-10-27: the user asked for more motion; done inline. `CLUSTER_AMPLITUDE` 0.12 → 0.22 and `DRIFT_PX` 6 → 9 in `hero-network.ts`, then "un poco más": 0.3 and 12px. vitest (marketing) 49/49.
  - 2026-10-27, inline: the cursor light was softened again (lit 0.3 → 0.12, haze 0.035 → 0.015, icon brightness 0.35 → 0.15).
  - Icons on more nodes, as a test: 46 → 80 on desktop and 18 → 30 on phones. All 80 render, and idle runs at 61 fps.
  - Seen in the screenshot: one icon sits under the nav wordmark and one touches the "Ver cómo funciona" CTA. Exclude the nav band and the CTA zone if the user keeps 80.
  - The user chose 50 icons (20 on phones). Icons are now kept out of the nav band (y > 0.09) and the CTA row.
  - Signals slowed: `SIGNAL_MS` 1700 → 3400, `SIGNAL_EVERY_MS` 360 → 600.
  - vitest 49/49; 50 icons render at 61 fps idle; screenshot clean.
  - A stray screenshot accidentally written to `Cogni/hero-r1/` was moved to the scratchpad.
  - The user said icons clumped and some regions had none. Random selection was replaced by farthest-point sampling (`spreadEvenly`, aspect-corrected) in `hero-network.ts`.
    - 2 new tests: every region of a 4×3 grid outside the copy holds an icon, and the farthest candidate is picked first.
    - vitest 51/51, biome clean, 50 icons at 61 fps; screenshot shows even coverage.
  - The user asked for 10 more icons: desktop 50 → 60 (phones stay at 20). All 60 render at 61 fps idle; vitest 51/51.
- [x] R1 — Hero approved by the user ("así está bien"), final commit d812f58 (range 78fb0f0..d812f58; route delegated, then inline tweaks).
  - Checks: typecheck OK, biome clean, depcruise 0, vitest (marketing + hex + proxy) 58/58.
  - RDD: medium (slice_budget_reached), granted, reliability approved, acknowledged (`review-15e327f740167731`). The boundary is now d812f58.
  - Follow-ups (non-blocking):
    - R3-001 WARNING `hero.tsx:51-64`: the instant `scrollTo` at the collapse can cancel an in-flight smooth scroll, such as a nav anchor jump to #tecnicas, and leave the visitor midway. Fix before shipping.
    - R3-002: the reduced-motion network test must assert that icons exist.
    - R3-003: the stale "switched off" comment near `SHOW_ICONS`, and the untested default.
- 2026-10-27: the user picked dovetail.com as the design reference for the remaining sections. Teardown in Engram `cogni/landing/dovetail-reference`. Elements to bring over:
  - huge Inter 600 headlines where one keyword switches to a pixel font;
  - pixel-font stats and step numbers;
  - dithered 3D study objects inline in headlines (Higgsfield);
  - ASCII/character textures;
  - a single accent (Cogni violet);
  - a sticky 01–05 step scene.

  The user wants alternating dark and light sections joined continuously.
  - Pixel font: PP Mondwest is commercial, so a free Google font replaces it. The comparison (scratchpad `font-compare2.png`) shows **DotGothic16** is the closest, with a thin proportional pixel stroke and similar width; it has no serifs. The user asked for the free one that looks most similar, so DotGothic16 it is. REVISED: the user then said a pixel font is not needed, so the pixel font is dropped; the keyword swap uses Instrument Serif italic, as in the hero's "estudias." (user confirmed).
- [ ] R2 — "Así funciona Cogni" video section in Dovetail style, LIGHT, joined to the dark hero by a continuous transition.
  - Huge sans headline with one Instrument Serif italic keyword, and an inline image slot for a future Higgsfield object.
  - ASCII texture, violet accent, the video placeholder (brag later), and the 01–03 steps.
  - Also a FIXED navbar (no hide on scroll) whose theme follows `data-nav-theme`, and the R3-001 fix (the collapse must not cancel anchor scrolls).
  - Route: delegated writer (2026-10-27).
  - 2026-10-27: R2 v1 implemented and uncommitted, awaiting the user's live review.
    - `how-it-works.tsx` is rewritten: dusk band from hero to cream; Inter headline with "repaso" in serif italic; `headline-object.tsx` slot (`TODO(higgsfield)`, expects `public/landing/how-it-works-object.webp`); ASCII texture (`ascii-field.ts` and `ascii-texture.tsx`); video placeholder with scroll scale; steps 01–03.
    - The nav is always fixed and switches theme via `nav-theme.ts` and `data-nav-theme`.
    - R3-001 fixed with `shouldCollapsePin()`, which waits for 180 ms with no scroll before collapsing. Anchors from the nav and the CTA land on the section (top 80px).
    - Smooth anchor scroll added. Inter added via next/font (opsz).
    - Checks: typecheck, biome, depcruise clean; vitest 76/76 (writer) and 69/69 marketing (parent spot check); about 60 fps.
    - Open points: the "Así funciona Cogni" eyebrow (keep or drop?), the dusk glow saturation, and a grey-ish light nav over the dark video slot.
  - The user asked to replace the 0/1 and symbol texture with letters. `ASCII_GLYPHS` now holds the lowercase Spanish alphabet (a–z, ñ, á, é, í, ó, ú). vitest 69/69; the screenshot `r2/12-letters.png` shows letters.
  - The user reported a black line between the hero and the dusk band. Two causes: the hero veil's radial vignette darkened its bottom edge, and the dusk band opened with a 0–8% flat night plateau.
    - Fix: the veil now darkens only the sides and top, and the dusk ramps from the first pixel.
    - Pixel samples across the seam now rise monotonically from #0b0717, with no dip.
  - The "Así funciona Cogni" label is larger: 12px → 16px on phones and 20px from md.
  - biome ok, vitest 69/69.
  - The user still saw the seam at the hero's corners. Following their proposal, `.lp-dusk::before` continues the hero's side vignette into the dusk band, masked to fade out by 60% of its height.
    - Corner pixel samples now go continuously 9 → 8 → 12 across the seam; before, they jumped 9 → 11 at the seam.
    - biome ok, vitest 69/69.
- [x] R2 closed: commit 4cdb0e7 (the user moved on to Técnicas).
  - Checks: typecheck OK, depcruise 0, vitest 76/76.
  - RDD: medium (slice_budget_reached), granted, reliability approved, acknowledged (`review-72fc9b30cd4be612`). The boundary is now 4cdb0e7.
  - Advisories:
    - R3-ascii-alpha-zero-fallback: `Number(...)||0.2` ignores an alpha of 0.
    - R3-ascii-test-conditional-assert.
    - R3-hero-settle-wiring-untested: the collapsePin debounce wiring has no test.
- [ ] R3 — Técnicas in Dovetail style. DARK section entered through `.lp-dusk-out`, with seam samples at the corners. It keeps the deck interaction, texts and tests. Headline with a serif italic keyword plus an object slot (`public/landing/techniques-object.webp`), letter texture, refined dark cards. Route: delegated writer (2026-10-27).
  - 2026-10-27: R3 v1 implemented and uncommitted, awaiting the user's review.
    - Headline "Una técnica [cards object] para cada *momento*."
    - Dovetail tab row: 01–04, a hairline, and a violet line that fills over 5 s during autoplay.
    - Dark cards and mocks; the deck behaviour is unchanged.
    - `.lp-dusk-out` mirrors `.lp-dusk`, with shared side vignettes. Seam samples are flat at x=10, 720 and 1430.
    - 6 new tests (5 RED first). Checks: vitest 82/82 (writer) and 75/75 marketing (parent spot check); /landing 200; 60 fps.
    - The texture inside the cards was dropped (a canvas inside moving cards cost frames).
    - Open: a hard edge into the pillars, which belongs to the pillars redesign.
  - 2026-10-27: new user direction for R3 v2 (delegated):
    - Técnicas becomes a pinned HORIZONTAL scroll like superr.ai (sticky h-screen; the track translates linearly). An intro panel, then 4 large technique panels with a visual slot and the explanation.
    - Higgsfield slots in the style of the platform's `notebook-fan` illustrations: `public/landing/technique-{flashcards,recall,exams,ai}.webp`.
    - Platform technique colours (#fcd34d, #6ee7b7, #ef4444 plus violet), alternated, including the headline object tiles (`tone` prop).
    - Grounds below the hero become LIGHTER (no near-black); the hero stays untouched.
    - Each section gets its own touch while keeping the Dovetail design line.
  - 2026-10-27: R3 v2 implemented and uncommitted, awaiting review.
    - Layout: a 500vh pinned section on lilac #ece5fa. The track is 5 frames (intro plus 4 techniques), driven by useScroll/useTransform x.
    - New files: `techniques-scroll.ts` (pure progress mapping); `technique-art.tsx` (notebook-fan-style placeholders with `TODO(higgsfield)` paths `technique-*.webp`). `technique-mocks.tsx` was deleted.
    - Colours: the headline object has a `tone` prop (how-it-works yellow, techniques mint); exams use the platform red #ef4444.
    - Grounds: the cream → lilac band, no near-black below the hero; seams are flat at x=10, 720 and 1430.
    - Phones and reduced motion: the panels stack.
    - Checks: vitest 83/83 (writer) and 76/76 marketing (parent spot check); /landing 200; 59.7 fps scrubbing.
    - Open: text and visual halves pair up mid-slide because of the alternation, and the intro arrow cue loops.
  - 2026-10-28: R3 v2 committed as 9157074. R3 v3 (spacing) is uncommitted, awaiting review.
    - Unchanged: the hero → Así funciona `.lp-dusk` (the user corrected the brief; `git diff` shows no hunk on `.lp-dusk`).
    - Así funciona bottom padding halved.
    - Bands: `.lp-dusk-out` 306 → 126px; `.lp-tech-out` 216 → 90px.
    - Técnicas: 4500 → 3206px (70vh per slide); a compact intro frame (0.66 wide, so the first technique peeks in); a larger visual, min(680px, 70vh); mid-slide gap about 250px.
    - Seams flat. Checks: vitest 84/84 (writer) and 77/77 marketing (parent spot check); /landing 200; 59.7 fps.
  - 2026-10-28: spacing committed as 341af55 (the user called the design "muy bueno"). v4 is uncommitted, awaiting review.
    - Technique 04 "La IA prepara, tú decides" was replaced by "Tu acompañante de estudio": its texts moved verbatim from the old pillar 04, the lead line is "Cada sesión cierra con un siguiente paso.", it uses violet, and `companion-demo.tsx` and `play-once.ts` were extracted.
    - Pillars are now 4 (01–04). The new pillar 04 "Tu progreso" takes the old rose band and demo accents (AA checked).
    - `docs/landing/descripcion.md` gained the implemented route.
    - Checks: vitest 88/88 (writer) and 81/81 marketing (parent spot check); /landing 200.
    - Open: two reds coexist, rose #fb7185 in the pillars and platform red #ef4444 in Técnicas exams.
  - v4 committed as 2f0796a.
- [ ] C1 — Content depth (user, 2026-10-28): the copy is too generic, with no science, value or competitive differentiation. Brilliant's Koji section is the model.
  - Deep research comparing code, docs and research with the landing copy. Deliverable: `docs/landing/propuesta-contenido.md` (gap table, per-section value / science / mechanism / honest comparison, FAQ, science quotes, risks).
  - Route: delegated read-only research (it writes only that doc).
  - Next: the user reviews it, then the copy is applied section by section.
  - 2026-10-28: research done, `docs/landing/propuesta-contenido.md` written (330 lines).
    - Top claims:
      - one SM-2 engine for the 3 techniques;
      - reworded exam retakes;
      - AI grounded only in the notes;
      - calibration (self vs AI);
      - a free Hoy view.
    - FACTUAL ERRORS in the current copy (parent verified `sm2.ts:11,38-45` and `pillars.tsx:96`):
      - review intervals are 1, 6, then round(I·EF), i.e. today/+1/+6/+15/+38 with "Bien", not +1/+3/+7/+16;
      - the streak counts days with ≥1 review;
      - "dominio por técnica" does not exist (the product has accuracy per technique and mastery per page);
      - Word/PPT are not live on this base (`feat/document-import` has 48 commits not on main; PDF only, ≤20 MB);
      - the active-recall end-of-session AI summary does not exist;
      - the forgetting-curve "más de la mitad" claim is wrong.
    - Open product questions: the labels "Tus errores, explicados" and "Otra vez"; the static flashcard hints; whether to publish the AI limit numbers; the "en un minuto" claim; legal review of the privacy FAQ.
  - 2026-10-28, correction by the user: PDF, Word and PowerPoint import are LIVE on origin/main (PRs #106–#108). The local main was 75 commits behind.
    - feat/landing-v1 must be rebased onto the current origin/main before its PR.
  - Next (delegated):
    1. A marketing review of the proposal, plus a "Copy final propuesto" in the doc.
    2. A Pencil frame "Landing · Contenido propuesto v1" showing the final copy in the UNCHANGED coded design (hero excluded; it imports the live page via the pen browser with reduced motion emulated), with annotation cards for value, science, evidence and "Por confirmar".
    - No landing code changes until the user approves the copy.
  - 2026-10-28: the marketing review was added as `propuesta-contenido.md` §7 (the "Copy final propuesto"). The Pencil frame `sdVG8` "Landing · Contenido propuesto v1" exists, with every section rebuilt by hand and annotation notes.
    - The live import was impossible: at 12:29 the working tree was checked out to `docs/legal-framework` (made from origin/main ac3de00) outside this session, so /landing redirects to /login there.
    - The landing commits are safe on feat/landing-v1 at 2f0796a.
    - Marketing changes:
      - Así funciona: "en un minuto" became "sin armar nada a mano";
      - benefit-led points with the mechanism as proof;
      - exams lead with "nunca se repite igual";
      - the factual errors are fixed;
      - new sections: Ciencia (61% vs 40%), a 10-question FAQ, and the closing.
  - 2026-10-28, copy round 2 in Pencil:
    - Frames: `OHP8C` "Landing · Contenido propuesto v2", `s3aFN` science page, `k60K1C` credits, `pc04f` privacy shell.
    - Repetition audit (doc §8): SM-2 lives only in Pilar 02; "only from your page" only in the FAQ; the session summary only in Tu acompañante; Hoy only in Pilar 03.
    - FAQ cut to 5. Comparación honesta replaces Ciencia, with a 5-step Cogni route.
    - The doc's §9 holds the final v2 copy and §10 the page outlines.
    - Pending: legal privacy text; DOI checks; the Magnific link; the product label "Tus errores, explicados"; a live design check (needs the feat/landing-v1 checkout).
  - 2026-10-28: the user approved round 2 ("me gustó lo que hiciste") and asked to implement the remaining sections, the new pages and the legal pages (sourced from branch `docs/legal-framework`, 78e5df2, which stays local and unpushed).
- [x] C2 — Apply the approved v2 copy (`propuesta-contenido.md` §9) to the existing coded sections: Así funciona, Técnicas, Pilares. The design is unchanged and the factual fixes are included. Route: delegated writer (2+ non-trivial files). Commit 1.
  - 2026-10-28: committed as d257936. Route: delegated writer.
    - Así funciona: v2 headline and one v2 line under each step. Técnicas: v2 intro line, a "La ciencia detrás de cada técnica" link to /ciencia, v2 points for the four panels. Pilares: v2/§7.3 points; the curve demo marks +1/+6/+15 with the v2 note; the progress card says "Acierto por técnica".
    - Checks: `pnpm typecheck` clean; `vitest run "src/app/(marketing)" src/proxy.test.ts src/app/no-inline-hex.test.ts` 11 files / 93 tests passed; `biome check "src/app/(marketing)"` clean after one format fix; /landing 200 and the steps screenshot checked against `OHP8C`.
    - Note: node_modules was stale (left from the origin/main checkout, no @phosphor-icons); `pnpm install --frozen-lockfile` restored it without touching the lockfile.
- [x] R4 — The new landing sections in the Dovetail line, matching Pencil `OHP8C`: Comparación honesta (four pains vs the 5-step "camino Cogni"), FAQ (5 questions, accordion), the "Empieza hoy" closing, and a footer with links to Ciencia, Créditos and the legal pages. They replace the empty `#ciencia` and `#preguntas` placeholders. Route: delegated writer. Commit 2.
  - 2026-10-28: committed as bfa3649. Route: delegated writer.
    - New: `comparison.tsx` (#comparacion, paper, red exam headline object, route rail drawn step by step), `faq.tsx` (#preguntas, lilac, 5-item disclosure accordion, first open, grid-row transition), `closing.tsx` (#empieza, lilac → night bookend, CTA /register, headline settles from blur), `(marketing)/_components/site-footer.tsx` + `legal-docs.ts` (8 legal slugs + Créditos).
    - Nav: "Ciencia" → "Comparación" (#comparacion); nav and footer anchors now carry `/landing#…` so they work from the new pages. Pillar sections gained `scroll-mt-16` for the "↑" links.
    - Deviations: the closing ends near-black and the footer is night, as in `OHP8C` (the bookend transition the brief asked to keep), although the light-ground rule covers the other sections; the Comparación headline wraps to two lines at 1440 because of the added headline object; the footer Legal column lists all 8 documents plus Créditos instead of the frame's three; FAQ answer 3 is the §7.3 text with a `TODO(legal)` code note (no visible marker on the landing).
    - Checks: `pnpm typecheck` exit 0; vitest 15 files / 111 tests passed; `biome check "src/app/(marketing)"` clean; /landing 200; screenshots of #comparacion, #preguntas, #empieza and the footer compared with `OHP8C`; a 1px paper seam above the footer fixed with `-mt-px`.
- [x] P1 — Public pages `/ciencia` (Brilliant-style short page, Pencil `s3aFN`) and `/creditos` (Pencil `k60K1C`), in the proxy `OPEN_PATHS`. Route: delegated writer. Commit 3.
  - 2026-10-28: committed as fa6b6fc. Route: delegated writer.
    - `/ciencia` (`ciencia/page.tsx`, `_components/science-concepts.tsx`): lilac head with "Volver a Cogni", a yellow headline object and a 6-pill index; six alternating blocks (visual, idea, "Así lo usa Cogni", source) whose bars and curve fill on view; a close "Todo esto, en tus páginas." with Empieza gratis and Ver cómo funciona; shared footer.
    - `/creditos` (`creditos/page.tsx`, `_components/credits-list.tsx`): Ilustraciones (Designed by Magnific with two visible `PENDIENTE` marks: which illustrations, and the link), Tipografías (Inter · Instrument Serif · Manrope · JetBrains Mono · Caveat, Google Fonts, OFL 1.1), Íconos (Lucide ISC, Phosphor MIT).
    - Shared: `_components/page-header.tsx`, `_components/pending-mark.tsx`. Both pages have their own metadata and are exact-match `OPEN_PATHS` (proxy tests added, plus a prefix-rejection test).
    - Deviation: a headline object was added to the /ciencia headline (design line), not in `s3aFN`.
    - Checks: `pnpm typecheck` exit 0; vitest 17 files / 123 tests passed; `biome check` clean; /landing, /ciencia, /creditos all 200; screenshots of the /ciencia head, concept 04 and /creditos matched `s3aFN` / `k60K1C`.
  - 2026-10-28, scope change (user): footer Legal group reduced to Términos de uso → /legal/terminos, Privacidad → /legal/privacidad and Créditos; `legal-docs.ts` deleted; /legal not in the proxy. Committed as fd0b320 (route: delegated writer; typecheck exit 0, vitest 17 / 123 passed, biome clean, the three pages 200).
- [-] L1 — Public legal pages under `/legal/<slug>`, using the 8 footer documents from `docs/legal-framework:docs/legal/` (terms, data policy, privacy notice, cookies, acceptable use and AI, academic integrity, copyright, sub-processors). **Moved out of landing-v1 (user, 2026-10-28)**: legal pages become a separate feature after research into which documents deserve standalone pages. Nothing of L1 was started.
  - The content is copied verbatim into the repo and rendered from markdown.
  - `[PENDIENTE: …]` stays visible as a marked placeholder, under a "Borrador, pendiente de revisión legal" notice.
  - The existing `/terminos` gate is untouched.
  - Route: delegated writer. Commit 4.

## Next step
C2 → R4 → P1 done (d257936, bfa3649, fa6b6fc, fd0b320); L1 moved out. Next: an RDD assessment per commit and the user's visual review on localhost:3000.

### RDD (2026-10-28)
- A single candidate 4cdb0e7..fd0b320 (4183 lines) stopped with `lens_context_budget_exceeded`, and the user chose 3 slices. All 3 were granted, approved and acknowledged:
  - 4cdb0e7..2f0796a, lineage review-d04f0568ad0d188a. Advisories: R3-active-progress-untested, R3-default-tone-unstyled.
  - 2f0796a..bfa3649, lineage review-646cf37780dcf0ef. Advisories: R3-curve-review-days, R3-footer-unproved-routes, R3-route-anchor-targets.
  - bfa3649..fd0b320, lineage review-699d6c1973208fae. Advisories: R3-footer-dead-legal-links (expected until the legal feature ships), R3-legal-docs-deletion-consumers, R3-step-counter-off-by-one. The last one is a false positive: `step(length-1)` already prints the total.
- The reviewed boundary is now fd0b320.

## Polish pass (2026-10-28)

Branch `feat/landing-polish` from `feat/legal-consent` 3f316e9. Route: one delegated writer for P2–P6 (the parent delegated the whole pass; 2+ non-trivial files).

- [x] **P2 — FAQ from real visitor questions.** Eight questions replace the five v2 ones: ¿Qué archivos puedo importar?, ¿Cómo crea Cogni las tarjetas y las preguntas?, ¿Puedo confiar en lo que genera la IA?, ¿Sirve para cualquier materia?, ¿Cómo sabe Cogni qué repasar cada día?, ¿Cómo sé si estoy aprendiendo?, ¿Qué pasa con mis apuntes? (links `/legal/privacidad`), ¿Funciona en el celular?. The study-time question left (it was not a visitor question). Claims checked against `src/modules/ingestion/README.md` (PDF/DOCX/PPTX, 20 MB, no OCR, no .doc/.ppt), `src/modules/ai/application/prompts/*` (output always in Spanish), `src/modules/scheduling/README.md` (SM-2 due dates, Hoy by technique, due by local day), `src/modules/analytics` (dominio, repasos completados, racha) and `src/modules/study-engine/domain/session-feedback.ts` (strengths and improvement areas). Privacy answer follows `politica-de-tratamiento-de-datos.md` (summary, §5 "Lo que no hacemos", §6.2, §8.4, §9).
  - Competitor sources (fetched 2026-10-28): StudyFetch https://www.studyfetch.com (visible accordion plus FAQPage data: file types, any subject, "Can I trust the AI-generated study tools?", "Is my data private and secure?", "Does StudyFetch work on my phone?", "How does StudyFetch know what I need to study?", "How do I know if I'm actually learning?", cost); Knowt https://knowt.com (file types, subjects, study modes); RemNote https://www.remnote.com/pricing (plans, AI credits only); Brilliant help center https://brilliant.org/help-redirect/ ("Where can I use Brilliant?", "What subjects does Brilliant teach?", free vs Premium, delete account); Gemini Notebook (NotebookLM) https://support.google.com/notebooklm/answer/16269187 (mobile app, "My question wasn't answered", data privacy, file size limit, citations); Anki https://docs.ankiweb.net/llms.txt (FAQ index: "What spaced repetition algorithm does Anki use?", exam preparation, account removal). Quizlet (quizlet.com, help.quizlet.com) returned HTTP 403 and gave no questions.
  - Excluded by the earlier user decision: 18+ and cost. Cost appears on StudyFetch, RemNote, Brilliant and Knowt (4 of 6 reachable platforms), so it is flagged to the user rather than added.
