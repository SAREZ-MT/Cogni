# Módulo `flashcards`

## Responsabilidad

Tarjetas, sesiones de repaso y retroalimentación.

## Estado

Fase 3: entidad `Flashcard` con `createFlashcard` (recorta y rechaza
anverso/reverso vacíos, `FLASHCARD_EMPTY`), puerto `FlashcardRepository`
(`insertMany`, `listByPage`, `countByPage`, `nextPosition`), adaptador Drizzle y
fake en memoria (`testing.ts`), ambos validados por el mismo contrato.

Casos de uso (`application/`, `(input, deps, ownerId)` → `Result`):

- `requestGeneration`: lee el texto de la página (`PageTextReader` de
  notebooks), responde `PAGE_EMPTY` si está en blanco, consume una unidad del
  límite diario (`DAILY_LIMIT_REACHED` con `resetAt`), trunca al tope de tokens,
  llama a `ai.generateStructured` con el prompt `generate_flashcards/v1` y
  persiste las tarjetas con posiciones consecutivas. El orden (página antes que
  límite) evita gastar una generación en páginas inexistentes o vacías. Cero
  tarjetas válidas = `GENERATION_FAILED` y nada persistido.
- `listFlashcardsByPage`: tarjetas del dueño ordenadas por posición.
- `getGenerationStatus`: generaciones restantes con `peek` (no consume).

Acciones (`actions.ts`, `"use server"`): `generateFlashcardsAction`,
`listFlashcardsAction`, `getGenerationStatusAction`. Validan sesión y entrada
con Zod, devuelven `Result<T, ActionError>` y emiten el evento
`generation_requested`. `maxDuration` se declara en la ruta de página que las
aloja. Las sesiones de repaso llegan en la Fase 4.

## Fase pendiente

Fase 4 — Motor de repetición espaciada y Flashcards (ver `docs/documento-maestro.md` §13).

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo una vez implementado.
