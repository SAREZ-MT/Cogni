# project-tooling Specification (Delta)

## MODIFIED Requirements

### Requirement: Esqueleto de los once módulos

`src/modules/` MUST contener los once módulos declarados. `identity`, `shared`, `notebooks` y `editor` MUST tener código real; los demás MUST tener solo `index.ts` y `README.md` indicando la fase pendiente, sin lógica de negocio.

#### Scenario: Módulos pendientes vacíos (unit)

- GIVEN un módulo de fase futura, por ejemplo `src/modules/study-engine/`
- WHEN se inspecciona su contenido
- THEN contiene `index.ts` sin exportaciones de dominio y un `README.md` que nombra su fase futura

#### Scenario: `notebooks` y `editor` con código real (unit)

- GIVEN `src/modules/notebooks/` y `src/modules/editor/` tras esta fase
- WHEN se inspecciona su contenido
- THEN cada uno tiene `domain`, `application` e `index.ts` con exportaciones reales, y `notebooks` además tiene `infrastructure` y `ui`

### Requirement: Reglas de dependencia verificadas

dependency-cruiser MUST codificar las reglas de la sección 5.3 como errores: (1) `domain` no importa nada externo ni otra capa, (2) `application` solo importa `domain` y puertos, (3) solo `infrastructure` importa Drizzle, Supabase, AI SDK, Upstash o Trigger.dev, (4) `ui` no importa `infrastructure`, (5) un módulo solo se importa a través de su `index.ts`, (6) `study-engine` no importa `flashcards`, `exams` ni `active-recall`, (7) los paquetes de Tiptap y ProseMirror (`@tiptap/*`, `prosemirror-*`) MUST importarse únicamente desde `src/modules/editor/ui`.

#### Scenario: Grafo conforme (unit)

- GIVEN el esqueleto de módulos sin violaciones
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando termina con código 0

#### Scenario: Violación de capa (unit)

- GIVEN un archivo de `domain` que importa Drizzle
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla nombrando la regla violada

#### Scenario: Importación de ruta interna (unit)

- GIVEN un archivo que importa `modules/identity/application/...` desde otro módulo
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla indicando que el acceso debe pasar por `index.ts`

#### Scenario: Tiptap importado fuera de `editor/ui` (unit)

- GIVEN un archivo en `editor/domain` o `editor/application` que importa un paquete `@tiptap/*` o `prosemirror-*`
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla nombrando la regla de dependencia violada

#### Scenario: Tiptap permitido en `editor/ui` (unit)

- GIVEN un archivo en `editor/ui` que importa `@tiptap/react`
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando termina con código 0 para esa importación
