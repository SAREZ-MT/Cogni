# Archive Report: Fase 1 — Cuadernos y editor

**Change**: phase-1-notebooks-editor
**Status**: Completo y archivado (con pendientes explícitos, ver más abajo)
**Fecha de archivado**: 2026-09-22
**Ruta de archivo**: `openspec/changes/archive/2026-09-22-phase-1-notebooks-editor/`

---

## Executive Summary

La Fase 1 de Cogni (`phase-1-notebooks-editor`) queda archivada con 124 de 133 tareas completas (93 %). El change entrega la primera superficie de producto: CRUD de cuadernos y páginas con jerarquía de dos niveles, sidebar con árbol, editor de bloques Tiptap con todos los bloques y marcas de §3.2, menú de comandos `/`, paleta de resaltado Cogni, autosave optimista con reconciliación de conflicto de `content_version`, y un pipeline de imágenes sobre Supabase Storage con permisos firmados y RLS por propietario. Los ocho follow-ups de cierre de la Fase 0 (migrate-in-build, FK de `profiles`, nonces de CSP, anclaje del proxy matcher, `userId` en sign-in, evento `user_signed_in`, manejo de `signOut`, resiliencia de `EnsureProfile`, semántica de upsert, redirect de apex) también quedan resueltos.

Quedan sin completar, por decisión explícita del usuario y por naturaleza de tarea de usuario: la Fase 7 completa (documentación — diagramas de archify, TSDoc, reconciliación de redacción de specs) y cuatro tareas `(usuario)` de configuración de dashboard (0.6, 0.7 mitad Vercel, 6.2 mitad `cogni-prod`, 6.4). Ninguna de estas ausencias bloquea el comportamiento entregado: el producto funciona de punta a punta en `cogni-dev` con evidencia local verde.

Entrega vía 12 ramas encadenadas (`stacked-to-main`, PR0–PR8b, más 4 PR de corrección post-review) fusionadas a `main`, seguidas de un cierre final (Fase 9) en la rama `chore/phase-1-close` (commit `6ca6d80`, sin fusionar aún — el usuario abre el PR manualmente). Todas las ramas de producto ya están fusionadas a `main` en el commit `aa4fc2c`.

---

## Artefactos archivados

| Artefacto | Estado | Detalle |
|---|---|---|
| `proposal.md` | Presente | Intención, decisiones de producto cerradas, alcance, 8 slices propuestos, riesgos, plan de reversión |
| `design.md` | Presente | Enfoque técnico, 16 decisiones de arquitectura, flujos de datos (autosave, subida de imagen), tabla de archivos, contratos, matriz de amenazas, 4 diagramas de archify especificados (no generados, ver Fase 7) |
| `exploration.md` | Presente | Insumo previo a la propuesta (Engram #41 según `proposal.md`) |
| `specs/` (7 dominios) | Presente | `notebooks`, `editor`, `page-assets` (nuevos, completos) + `design-tokens-and-shell`, `identity-auth`, `observability-and-delivery`, `project-tooling` (deltas) |
| `tasks.md` | Presente, sin reescribir | 133 tareas; 124 `[x]`, 9 `[ ]` (ver tabla de tareas pendientes) |
| `apply-progress.md` | Presente, sin reescribir | 12 batches de implementación con evidencia TDD, desviaciones de diseño, hallazgos e impacto en presupuesto de revisión por PR |

No existe `verify-report.md` para este change (verificación no ejecutada como fase separada; el propio `apply-progress.md` documenta gates verdes por PR y el cierre de Fase 9 documenta las gates finales). No existe `state.yaml`.

---

## Specs sincronizadas con `openspec/specs/`

| Dominio | Tipo de cambio | Resultado del diff / composición |
|---|---|---|
| `notebooks` | Nuevo (copia mecánica con `cp`) | `diff` vs. origen: **vacío** (byte-idéntico) |
| `editor` | Nuevo (copia mecánica con `cp`) | `diff` vs. origen: **vacío** (byte-idéntico) |
| `page-assets` | Nuevo (copia mecánica con `cp`) | `diff` vs. origen: **vacío** (byte-idéntico) |
| `design-tokens-and-shell` | Delta (MODIFIED ×2, REMOVED ×1, ADDED ×1) | Compuesto con `gentle-ai sdd-archive-compose` (exit 0); 8→8 Requirements (verificado por conteo) |
| `identity-auth` | Delta (MODIFIED ×4) | Compuesto con `gentle-ai sdd-archive-compose` (exit 0); 11→11 Requirements |
| `observability-and-delivery` | Delta (MODIFIED ×1, ADDED ×5) | Compuesto con `gentle-ai sdd-archive-compose` (exit 0); 10→15 Requirements |
| `project-tooling` | Delta (MODIFIED ×2) | Compuesto con `gentle-ai sdd-archive-compose` (exit 0); 8→8 Requirements |

Cada spec canónica resultante se verificó bien formada: un único `# ... Specification`, una única `## Purpose`, una única `## Requirements`, y bloques `### Requirement: ...` con sus escenarios (conteo exacto de encabezados confirmado con `rg -c` tras la composición). En las tres specs cuyo delta terminaba con su último Requirement MODIFIED al final del archivo (`identity-auth`, `observability-and-delivery`, `project-tooling`), la composición nativa unió ese bloque con el siguiente Requirement sin la línea en blanco separadora habitual (artefacto mecánico de la ausencia de línea en blanco final en el archivo delta origen); se restauró esa única línea en blanco en cada uno de los tres puntos exactos, sin tocar ningún encabezado, requisito, escenario ni orden — verificado de nuevo por conteo de `### Requirement:` antes y después (sin cambio).

### REMOVED destructivo (advertencia registrada por `openspec/config.yaml` `rules.archive`)

- **`design-tokens-and-shell` → "Shell sin funcionalidad de producto"** (Reason en el propio delta: "superado por `notebooks` y `editor`; el shell de esta fase aloja el árbol de cuadernos y páginas y el editor de bloques, dejando de mostrar únicamente un estado vacío." Migration: "`tests/e2e/shell-empty-state.spec.ts` se reescribe para verificar el árbol del sidebar en lugar del estado vacío." — cumplido, tarea 2.11).

Ningún otro Requirement fue removido en esta fase.

---

## Tareas: 124/133 (93 %)

| Fase | Tareas | Estado |
|---|---|---|
| 0 — migrate-in-build, FK `profiles` | 8 | 6/8 (`0.6`, `0.7` mitad Vercel pendientes, `(usuario)`) |
| 1 — schema y dominio/aplicación `notebooks` | 17 | 17/17 |
| 2 — infraestructura, Server Actions, sidebar, rutas | 13 | 13/13 |
| 3a — editor: dominio/aplicación sin Tiptap | 8 | 8/8 |
| 3b — editor: Tiptap base, menú `/` | 12 | 12/12 |
| 4 — autosave conectado, conflicto, aceptación | 6 | 6/6 |
| 5a — bloques restantes (tabla, callouts, resaltado) | 9 | 9/9 |
| 5b — resaltado de sintaxis, estilos finales | 7 | 7/7 |
| 6 — pipeline de imágenes | 22 | 20/22 (`6.2`, `6.4` pendientes, `(usuario)`) |
| 7 — documentación (diagramas, TSDoc, reconciliación de specs) | 4 | 0/4 (diferido por decisión del usuario el 2026-09-22) |
| 8a — follow-ups de cierre: CSP, proxy, apex | 9 | 9/9 |
| 8b — follow-ups de cierre: identity | 13 | 13/13 |
| 9 — cierre de fase | 3 | 2/3 (9.3 es este mismo archive) |
| **Total** | **133** | **124/133** |

### Tareas no completadas al cierre

| Tarea | Motivo | Responsable |
|---|---|---|
| 0.6 | Confirmar `DATABASE_URL` de Preview/Production en el dashboard de Vercel y la regla de protección de rama en GitHub | Usuario |
| 0.7 (mitad Vercel) | Confirmar en un deploy de preview real que el log de build muestra `drizzle-kit migrate` antes de "Compiling..."; la mitad local ya está verificada | Usuario |
| 6.2 (mitad `cogni-prod`) | Repetir en `cogni-prod` la verificación visual del bucket `page-assets` (ya confirmada en `cogni-dev`); la migración SQL 6.3 ya es la fuente de verdad idempotente | Usuario |
| 6.4 | Agregar `SUPABASE_STORAGE_BUCKET=page-assets` a `.env.local` y a Vercel (Production/Preview) | Usuario |
| 7.1 | Crear las cuatro fuentes de archify en `docs/diagramas/` | Diferido (decisión del usuario, 2026-09-22) |
| 7.2 | Ejecutar `validate`/`deliver` de archify sobre esas fuentes | Diferido (depende de 7.1) |
| 7.3 | TSDoc en puertos y casos de uso de `notebooks/application` | Diferido (decisión del usuario, 2026-09-22) |
| 7.4 | Verificar que las siete specs delta describen exactamente el comportamiento implementado | Diferido (decisión del usuario, 2026-09-22) |

9.3 (esta tarea de archivado) no se marca en `tasks.md` por instrucción explícita: el archive registra su ejecución en este reporte, no en un checkbox.

---

## Entregas / Pull Requests

Rama base: `main`. Estrategia de entrega: `auto-chain` / `stacked-to-main` (confirmada por el usuario el 2026-09-20). Todas las PR de producto están fusionadas; la Fase 9 vive en una rama sin fusionar (`chore/phase-1-close`).

| PR | Rama | Alcance |
|---|---|---|
| #7 | `chore/phase-0-archive` | Archive de la Fase 0 (previo a este change) |
| #8 | `docs/phase-1-planning` | Planificación de la Fase 1 (proposal/design/tasks) |
| #9 | `feat/phase-1-pr0-migrate-fk` | Slice 0: migrate-in-build, FK de `profiles` |
| #10 | `feat/phase-1-pr1-notebooks-domain` | Slice 1: schema, dominio/aplicación de `notebooks` |
| #11 | `feat/phase-1-pr2-notebooks-infra-sidebar` | Slice 2: repositorios Drizzle, Server Actions, sidebar, rutas |
| #12 | `feat/phase-1-pr3a-editor-core` | Slice 3a: editor sin Tiptap, regla `editor-tiptap-only-in-ui` |
| #13 | `feat/phase-1-pr3b-editor-tiptap` | Slice 3b: Tiptap base, menú `/`, guardado explícito |
| #14 | `feat/phase-1-pr4-autosave-acceptance` | Slice 4: autosave conectado, conflicto, aceptación e2e |
| #15 | `feat/phase-1-pr5a-blocks-table-callout-highlight` | Slice 5a: tabla, callouts, paleta de resaltado |
| #16 | `feat/phase-1-pr5b-code-highlight-styles` | Slice 5b: resaltado de sintaxis, estilos finales |
| #17 | `feat/phase-1-pr6-images` | Slice 6: pipeline de imágenes |
| #18 | `fix/next-config-loadable-without-env` | Corrección post-review: `next.config` cargable sin env de cliente |
| #19 | `fix/ci-e2e-storage-bucket-env` | Corrección CI: variable del bucket en el job e2e |
| #20 | `fix/editor-test-teardown-race` | Corrección: destrucción del editor Tiptap en cada camino de test |
| #21 | `fix/orphan-guard-test-empties-auth-users` | Corrección: precondición del test del guard de huérfanos |
| #22 | `feat/phase-1-pr8a-1-proxy-matcher-apex` | Slice 8a (parte 1): matcher anclado, redirect de apex |
| #23 | `feat/phase-1-pr8a-2-csp-nonce` | Slice 8a (parte 2): nonce de CSP por petición |
| #25 | `chore/phase-1-pr8a-preview-config` | Config de Playwright contra preview |
| #26 | `feat/phase-1-pr8b-1-signin-signout` | Slice 8b (parte 1): `userId` en sign-in, `signOutAction` |
| #27 | `feat/phase-1-pr8b-2-oauth-event-profile-resilience` | Slice 8b (parte 2): evento OAuth, `EnsureProfile` resiliente, fix de teclado del menú `/` |

**Main branch head tras la cadena de producto**: `aa4fc2c` (merge de PR #27). Commit de cierre de Fase 9 (9.1, 9.2): `6ca6d80` en `chore/phase-1-close`, **sin fusionar** — pendiente de que el usuario abra el pull request manualmente (no hay `gh` en este entorno, repositorio privado).

---

## Estado final de verificación (Fase 9, 2026-09-22, rama `chore/phase-1-close` sobre `main` `aa4fc2c`)

| Chequeo | Resultado |
|---|---|
| `pnpm test` | 75 archivos / 325 tests, verde |
| `pnpm test:db` | 8 archivos / 14 tests, verde (con `DATABASE_URL` exportada) |
| `pnpm typecheck` | Limpio |
| `pnpm lint` | Limpio |
| `pnpm depcruise` | 286 módulos / 760 dependencias, sin violaciones |
| `pnpm audit --audit-level=high` | Exit 0 (1 vulnerabilidad moderada, bajo el umbral) |
| `pnpm test:e2e` | 32/32, 5.7 min, 1 worker |
| Revisión nativa del commit `6ca6d80` | Lineage `review-48d57ddc147a00e9`, 4 lentes, **approved**, acknowledged (autoridad quemada) el 2026-09-22 |
| Revisión nativa del rango 8a | Lineage `review-0acdddda110807a0`, tier high, 4 lentes, **approved**, sin corrección |
| CI en GitHub (workflow `Main` en `aa4fc2c` y en el merge de esta rama) | **Pendiente `(usuario)`**: repositorio privado, sin `gh` en este entorno; no confirmado desde este agente |

---

## Follow-ups abiertos

1. **Marca de enlace no alcanzable end-to-end**: la app no ofrece diálogo, botón ni atajo que invoque `setLink()` (`extensions/index.ts`); documentado como hallazgo del cierre de Fase 9 (2026-09-22) durante la auditoría de cobertura de `notebooks-acceptance.spec.ts`. Follow-up de producto, no bloqueante.
2. **`MaxListenersExceededWarning` / "The destination stream closed early"** en `next start` durante corridas e2e largas: no afecta el resultado de los tests; posible relacionado con Sentry o internals de Next; sin diagnóstico de causa raíz, fuera del alcance del cierre.
3. **Fase 7 completa** (diagramas de archify, TSDoc en puertos/casos de uso, reconciliación de redacción de las siete specs delta): diferida por decisión explícita del usuario el 2026-09-22. `design.md` especifica las cuatro fuentes de diagrama (`fase-1-arquitectura-modulos`, `fase-1-guardado-pagina`, `fase-1-subida-imagen`, `fase-1-ciclo-pagina`) pero ninguna existe todavía en `docs/diagramas/`.
4. **Cuatro tareas `(usuario)`** (0.6, 0.7 mitad Vercel, 6.2 mitad `cogni-prod`, 6.4): configuración de dashboard que solo el usuario puede ejecutar; ver tabla de tareas no completadas arriba.
5. **Nota de producción (2026-09-22, fuera de este change)**: se corrigió en el dashboard de Vercel un bucle de redirect entre `cogni-dev.com` y `www` (apex canónico, `www` con 308 hacia apex); sin cambio de código, informativo para el historial del proyecto.

---

## Verificación mecánica del archivado

### Composición de deltas (`gentle-ai sdd-archive-compose`)

```
gentle-ai sdd-archive-compose --canonical openspec/specs/design-tokens-and-shell/spec.md --delta openspec/changes/phase-1-notebooks-editor/specs/design-tokens-and-shell/spec.md --output openspec/specs/design-tokens-and-shell/spec.md.compose-tmp
EXIT: 0

gentle-ai sdd-archive-compose --canonical openspec/specs/identity-auth/spec.md --delta openspec/changes/phase-1-notebooks-editor/specs/identity-auth/spec.md --output openspec/specs/identity-auth/spec.md.compose-tmp
EXIT: 0

gentle-ai sdd-archive-compose --canonical openspec/specs/observability-and-delivery/spec.md --delta openspec/changes/phase-1-notebooks-editor/specs/observability-and-delivery/spec.md --output openspec/specs/observability-and-delivery/spec.md.compose-tmp
EXIT: 0

gentle-ai sdd-archive-compose --canonical openspec/specs/project-tooling/spec.md --delta openspec/changes/phase-1-notebooks-editor/specs/project-tooling/spec.md --output openspec/specs/project-tooling/spec.md.compose-tmp
EXIT: 0
```

Cada `.compose-tmp` se movió atómicamente (`mv`) sobre su spec canónica tras confirmar el exit 0 y la estructura bien formada (conteo de `### Requirement:` esperado vs. observado, ver tabla de specs sincronizadas).

### Copia mecánica de specs nuevas (`cp` + `diff`)

```
$ diff openspec/changes/phase-1-notebooks-editor/specs/notebooks/spec.md openspec/specs/notebooks/spec.md
(sin salida — diff exit 0)

$ diff openspec/changes/phase-1-notebooks-editor/specs/editor/spec.md openspec/specs/editor/spec.md
(sin salida — diff exit 0)

$ diff openspec/changes/phase-1-notebooks-editor/specs/page-assets/spec.md openspec/specs/page-assets/spec.md
(sin salida — diff exit 0)
```

### Movimiento del change folder (`git mv` + `diff -r`)

```
$ git mv openspec/changes/phase-1-notebooks-editor openspec/changes/archive/2026-09-22-phase-1-notebooks-editor
(exit 0)

$ diff -r /private/tmp/claude-501/-Users-sarez-Trabajo-de-Grado-Cogni/33568e2b-253f-4fb4-b3a4-1cbf07d6da26/scratchpad/archive-snapshot openspec/changes/archive/2026-09-22-phase-1-notebooks-editor
(sin salida — diff -r exit 0)
```

El snapshot pre-move se tomó con `cp -R` antes del `git mv`; el `diff -r` posterior confirma byte-identidad completa entre el snapshot y la carpeta archivada (la única adición es este propio `archive-report.md`, ausente del snapshot porque no existía en el origen).

---

## Chequeo de ADR

Se leyeron las 16 decisiones de arquitectura de `design.md` (migrar dentro del build, FK de `profiles`, modelo de datos, puerto de guardado, `plain_text` como recorrido puro, Tiptap solo en `editor/ui`, autosave con debounce, subida de imagen firmada, bucket privado con RLS, `remotePatterns`/CSP, shadcn/ui, sidebar como Server Component, y las cinco decisiones del slice 8) contra `docs/documento-maestro.md`. Ninguna de estas decisiones **reabre ni contradice** una decisión ya cerrada del documento maestro: todas son implementaciones concretas de decisiones que el documento maestro ya dejaba abiertas para la fase de diseño (por ejemplo, "migrar dentro del build" y "FK de `profiles`" son explícitamente los dos follow-ups de la Fase 0 que `proposal.md` declara resolver antes del trabajo de producto, no un cambio de rumbo). No se identificó ninguna decisión que requiera un ADR nuevo en `docs/adr/`.

**Resultado**: ningún ADR pendiente para el orquestador.

---

## Change Closed

La Fase 1 queda archivada con el producto funcional de punta a punta en `cogni-dev` (evidencia local verde) y en `main` para todas las ramas de producto. Persisten como trabajo abierto y explícito: la Fase 7 (documentación, diferida por decisión del usuario) y cuatro tareas de configuración de dashboard `(usuario)`. La confirmación de CI en verde en GitHub para la rama de cierre queda pendiente del usuario.

**Próxima fase recomendada**: Fase 2 (documento maestro §13) — importación de PDF y extracción de texto, primer consumidor real de `plain_text` materializado en esta fase.

---

## Key Learnings

1. La composición nativa `gentle-ai sdd-archive-compose` reproduce correctamente MODIFIED, REMOVED y ADDED por nombre de requisito, pero omite la línea en blanco separadora cuando el último requisito MODIFIED de un delta coincide con el final físico del archivo delta.
2. Cuando un delta spec es la última sección del archivo sin salto de línea final, la fusión mecánica puede unir su bloque con el siguiente Requirement del spec canónico sin separador, un artefacto puramente de formato que no altera contenido ni orden.
3. Verificar el conteo de encabezados `### Requirement:` antes y después de una composición es una forma barata de confirmar que ningún requisito se perdió o duplicó sin necesidad de releer todo el contenido.
4. Un change puede archivarse honestamente con Fase 7 completa en cero por ciento cuando la decisión de diferir esa fase fue explícita del usuario y quedó registrada en `apply-progress.md` antes del archivo.
5. Las cuatro tareas `(usuario)` de esta fase son configuración de dashboard verificable de forma idempotente por SQL versionado (bucket de Storage, variables de entorno), lo que reduce el riesgo de que el paso manual del usuario diverja del comportamiento ya probado en código.
