# Módulo `editor`

## Responsabilidad

Extensiones Tiptap, bloques, menú `/`, resaltados y autoguardado.

## Estado

PR3a completo: dominio y aplicación sin Tiptap. `domain/save-page-port.ts`
declara el puerto `SavePagePort` (propiedad de `editor`; los Server Actions
`saveContent`/`getCurrentContent` de `notebooks` lo cumplen de forma
estructural, sin importarlo), toma `TiptapDoc`/`TiptapNode` de
`src/shared/kernel/tiptap-doc.ts` y declara el código de conflicto de
versión; `domain/autosave-state.ts` define
el estado puro del autoguardado; `application/use-autosave.ts` implementa el
debounce, el reintento y la reconciliación de conflicto contra un
`SavePagePort` inyectado, sin importar Tiptap ni ProseMirror
(`.dependency-cruiser.cjs`, regla `editor-tiptap-only-in-ui`). El componente
`Editor` de Tiptap llega en PR3b.

## Fase pendiente

PR3b — Tiptap base, bloques principales y menú "/" (ver
`openspec/changes/phase-1-notebooks-editor/tasks.md`, Fase 3b).

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo una vez implementado.
