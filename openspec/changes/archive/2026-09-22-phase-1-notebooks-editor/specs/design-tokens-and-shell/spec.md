# design-tokens-and-shell Specification (Delta)

## MODIFIED Requirements

### Requirement: shadcn/ui inicializado sobre los tokens de Cogni

shadcn/ui MUST inicializarse con variables CSS y MUST NOT aplicar el preset por defecto (`--defaults` / tema `base-nova`). `components.json` MUST dejar vacío el campo `tailwind.config`. `components.json` MUST existir en la raíz del repositorio y los primitivos requeridos por el editor y el sidebar (menú de comandos, popover, dropdown, dialog, y los que agregue esta fase) MUST agregarse sobre los tokens ya declarados en `@theme`, sin introducir un segundo sistema de tokens.

#### Scenario: Botón primario casi negro (unit)

- GIVEN el componente `Button` de shadcn/ui con variante primaria
- WHEN se renderiza
- THEN su fondo resuelve a `#1C1917` y no al violeta de acento

#### Scenario: `components.json` reconciliado (unit)

- GIVEN el repositorio tras esta fase
- WHEN se inspecciona `components.json`
- THEN existe en la raíz, `tailwind.config` está vacío y los primitivos nuevos referencian los tokens de `globals.css`

#### Scenario: Primitivo nuevo sin valores literales (unit)

- GIVEN un primitivo de shadcn/ui agregado en esta fase (menú de comandos, popover, dropdown o dialog)
- WHEN se inspeccionan sus clases y estilos
- THEN no contiene códigos hexadecimales en línea y usa solo tokens de `@theme`

### Requirement: Shell autenticado

El grupo de rutas `(app)` MUST renderizar un shell con canvas gris cálido, área de contenido blanca de radio 20 px, sidebar de 240 px colapsable a 64 px con el árbol de cuadernos y páginas del owner, y topbar de 52 px con menú de usuario que incluye cierre de sesión.

#### Scenario: Shell renderizado para sesión activa (e2e)

- GIVEN un usuario autenticado
- WHEN visita la raíz del grupo `(app)`
- THEN ve sidebar con el árbol de cuadernos y páginas, topbar y área de contenido con las medidas declaradas

#### Scenario: Colapso del sidebar (e2e)

- GIVEN el shell con sidebar expandido
- WHEN el usuario activa el control de colapso
- THEN el sidebar mide 64 px, conserva sus iconos y la preferencia persiste al navegar

#### Scenario: Cierre de sesión desde el topbar (e2e)

- GIVEN el menú de usuario abierto
- WHEN el usuario elige cerrar sesión
- THEN la sesión termina y queda en la pantalla de inicio de sesión

## REMOVED Requirements

### Requirement: Shell sin funcionalidad de producto

(Reason: superado por `notebooks` y `editor`; el shell de esta fase aloja el árbol de cuadernos y páginas y el editor de bloques, dejando de mostrar únicamente un estado vacío.)
(Migration: `tests/e2e/shell-empty-state.spec.ts` se reescribe para verificar el árbol del sidebar en lugar del estado vacío.)

## ADDED Requirements

### Requirement: Sidebar con árbol de cuadernos y páginas

El sidebar del grupo `(app)` MUST mostrar el árbol de cuadernos activos y sus páginas activas del owner autenticado, ordenados por `position`, reemplazando el estado vacío de la fase 0. Un owner sin cuadernos MUST ver el mensaje de estado vacío de `notebooks` ("Aún no tienes cuadernos. Crea uno para empezar.") en lugar del estado vacío genérico de la fase 0.

#### Scenario: Árbol visible para owner con contenido (e2e)

- GIVEN un usuario autenticado con cuadernos y páginas activas
- WHEN entra al shell
- THEN el sidebar muestra el árbol de cuadernos y páginas en orden de `position`

#### Scenario: Reescritura de `shell-empty-state.spec.ts` (e2e)

- GIVEN `tests/e2e/shell-empty-state.spec.ts` reescrito para esta fase
- WHEN se ejecuta contra un owner sin cuadernos
- THEN valida el mensaje de estado vacío de `notebooks` y el control para crear el primer cuaderno, sin asumir el shell vacío de la fase 0
