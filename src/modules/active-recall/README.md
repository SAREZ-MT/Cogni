# Módulo `active-recall`

## Responsabilidad

Preguntas abiertas, sesiones y evaluación combinada.

## Estado

En construcción (Fase 6 — Recordación activa, ver `docs/documento-maestro.md` §13).

Implementado:

- `domain/`: entidades `RecallQuestion`, `RecallSession` y `RecallAnswer`
  (§6.1) y funciones puras: calidad combinada y señal de calibración (§7.4),
  registro auditable de una respuesta saltada, estado de evaluación de la
  sesión, composición de la sesión (vencidas primero, luego nuevas),
  selección léxica del fragmento de página más relevante (§8.5) y puntaje
  por sesión.

Pendiente: persistencia, enganche con `study-engine`, generación y
evaluación con IA, Server Actions y pantallas sobre datos reales.

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo.
