# Módulo `flashcards`

## Responsabilidad

Tarjetas, sesiones de repaso y retroalimentación.

## Estado

Fase 3 (parcial): entidad `Flashcard` con `createFlashcard` (recorta y rechaza
anverso/reverso vacíos, `FLASHCARD_EMPTY`), puerto `FlashcardRepository`
(`insertMany`, `listByPage`, `countByPage`, `nextPosition`), adaptador Drizzle y
fake en memoria (`testing.ts`), ambos validados por el mismo contrato. Los casos
de uso y las acciones llegan en una tarea posterior de la Fase 3; las sesiones
de repaso, en la Fase 4.

## Fase pendiente

Fase 4 — Motor de repetición espaciada y Flashcards (ver `docs/documento-maestro.md` §13).

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo una vez implementado.
