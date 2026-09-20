# project-tooling Specification

## Purpose

Base ejecutable del repositorio: gestor de paquetes único, TypeScript estricto, una sola herramienta de lint y formato, runners de tests y verificación automática de las reglas de dependencia de la sección 5.3 sobre la estructura de carpetas de la sección 5.4.

## Requirements

### Requirement: Gestor de paquetes único

El repositorio MUST fijar pnpm en `packageManager` y restringir el gestor en `engines`. Cualquier otro gestor MUST fallar la instalación.

#### Scenario: Instalación con pnpm

- GIVEN un clon limpio del repositorio
- WHEN se ejecuta `pnpm install --frozen-lockfile`
- THEN la instalación termina sin error
- AND solo existe `pnpm-lock.yaml` como lockfile

#### Scenario: Instalación con otro gestor

- GIVEN un clon limpio del repositorio
- WHEN se ejecuta `npm install` o `yarn install`
- THEN el comando falla y el mensaje indica que el proyecto requiere pnpm

### Requirement: TypeScript estricto

`tsconfig.json` MUST habilitar `strict: true` y MUST NOT relajarlo por archivo. `pnpm tsc --noEmit` MUST ser un comando disponible.

#### Scenario: Chequeo de tipos limpio

- GIVEN el proyecto instalado
- WHEN se ejecuta `pnpm tsc --noEmit`
- THEN el comando termina con código 0

#### Scenario: Tipo implícito rechazado

- GIVEN un archivo con un parámetro sin tipo
- WHEN se ejecuta `pnpm tsc --noEmit`
- THEN el comando falla indicando `implicit any`

### Requirement: Biome como única herramienta de lint y formato

Biome MUST ser la única herramienta de lint y formato. El proyecto MUST NOT conservar configuración ni dependencias de ESLint o Prettier. `biome ci .` MUST ser ejecutable.

#### Scenario: Verificación de estilo

- GIVEN el proyecto instalado
- WHEN se ejecuta `pnpm biome ci .`
- THEN el comando termina con código 0

#### Scenario: Ausencia de ESLint y Prettier

- GIVEN el repositorio
- WHEN se inspeccionan `package.json` y la raíz
- THEN no existen dependencias ni archivos de configuración de ESLint o Prettier

### Requirement: Runner de tests unitarios y de componentes

El proyecto MUST exponer `pnpm test` ejecutando Vitest con Testing Library (`@testing-library/react` y `@testing-library/jest-dom`) sobre un entorno DOM.

#### Scenario: Suite verde

- GIVEN al menos un test unitario y un test de componente
- WHEN se ejecuta `pnpm test`
- THEN ambos tests pasan y el comando termina con código 0

#### Scenario: Test fallido detiene el comando

- GIVEN un test con una aserción falsa
- WHEN se ejecuta `pnpm test`
- THEN el comando falla con código distinto de 0

### Requirement: Tests de extremo a extremo

El proyecto MUST exponer `pnpm test:e2e` ejecutando Playwright con `webServer` que levanta la aplicación y `reuseExistingServer` desactivado en CI.

#### Scenario: Ejecución local de e2e

- GIVEN la aplicación construible
- WHEN se ejecuta `pnpm test:e2e`
- THEN Playwright levanta la aplicación, ejecuta las especificaciones y termina con código 0

### Requirement: Reglas de dependencia verificadas

dependency-cruiser MUST codificar las reglas de la sección 5.3 como errores: (1) `domain` no importa nada externo ni otra capa, (2) `application` solo importa `domain` y puertos, (3) solo `infrastructure` importa Drizzle, Supabase, AI SDK, Upstash o Trigger.dev, (4) `ui` no importa `infrastructure`, (5) un módulo solo se importa a través de su `index.ts`, (6) `study-engine` no importa `flashcards`, `exams` ni `active-recall`.

#### Scenario: Grafo conforme

- GIVEN el esqueleto de módulos sin violaciones
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando termina con código 0

#### Scenario: Violación de capa

- GIVEN un archivo de `domain` que importa Drizzle
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla nombrando la regla violada

#### Scenario: Importación de ruta interna

- GIVEN un archivo que importa `modules/identity/application/...` desde otro módulo
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla indicando que el acceso debe pasar por `index.ts`

### Requirement: Estructura de carpetas de la sección 5.4

El repositorio MUST tener `src/app/{(public),(app),api}`, `src/modules/`, `src/shared/{kernel,db,ui,config}`, `drizzle/` y `tests/e2e/`.

#### Scenario: Árbol presente

- GIVEN el repositorio tras la fase 0
- WHEN se inspecciona el árbol de carpetas
- THEN existen todas las rutas anteriores con el alias `@/*` apuntando a `src/`

### Requirement: Esqueleto de los once módulos

`src/modules/` MUST contener los once módulos declarados. `identity` y `shared` MUST tener código real; los demás MUST tener solo `index.ts` y `README.md` indicando la fase pendiente, sin lógica de negocio.

#### Scenario: Módulos pendientes vacíos

- GIVEN `src/modules/notebooks/`
- WHEN se inspecciona su contenido
- THEN contiene `index.ts` sin exportaciones de dominio y un `README.md` que nombra su fase futura
