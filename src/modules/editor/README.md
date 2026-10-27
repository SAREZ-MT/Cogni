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

## Catálogo de contenido (document-import, `docs/adr/0009`)

El editor registra todos los nodos, marcas y atributos del catálogo de
contenido de `src/shared/kernel/tiptap-catalogue.ts`, el mismo contra el
que `notebooks` valida el contenido importado (`tiptapContentSchema`):

- `ui/tiptap/extensions/catalogue-parity.test.ts` compara el esquema real
  de `createEditorExtensions()` con el catálogo (nodos, marcas y atributos)
  y carga `CATALOGUE_SAMPLE_DOC` (`src/shared/kernel/testing/`) exigiendo
  que `getJSON()` lo devuelva sin pérdidas. Un nodo nuevo en el editor o en
  el catálogo rompe esta prueba hasta que ambos coinciden.
- Registrados por esta característica: detalles (`details`,
  `detailsSummary`, `detailsContent`, `ui/tiptap/extensions/details.ts`),
  YouTube (`youtube.ts`, siempre desde `youtube-nocookie.com`; la CSP
  permite `frame-src 'self' https://www.youtube-nocookie.com`),
  `BackgroundColor`, `FontFamily`, `FontSize`, `LineHeight` y el atributo
  `alt` de la imagen.
- Matemáticas en bloque en modo de presentación: `blockMath` usa KaTeX con
  `displayMode: true` y `inlineMath` con `displayMode: false`, configurados
  por separado porque el paquete `Mathematics` comparte un solo
  `katexOptions`.
- Títulos 4 a 6 con su propia escala tipográfica (`.editor-content`).
- Bloques de código: sin lenguaje elegido no se colorean. El plugin de
  lowlight detecta un lenguaje cuando `language` es nulo y la versión
  3.31.3 no permite apagarlo, así que `code-block.tsx` responde a
  `highlightAuto` con el texto sin clases; los bloques con un lenguaje
  registrado siguen resaltados.

## Fase pendiente

PR3b — Tiptap base, bloques principales y menú "/" (ver
`openspec/changes/phase-1-notebooks-editor/tasks.md`, Fase 3b).

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo una vez implementado.
