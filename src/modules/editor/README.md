# Módulo `editor`

## Responsabilidad

Extensiones Tiptap, bloques, menú `/`, resaltados y autoguardado.

## Estado

Implementado. El editor es un editor de bloques tipo Notion construido con
extensiones gratuitas de Tiptap 3.

- Dominio y aplicación sin Tiptap (`.dependency-cruiser.cjs`, regla
  `editor-tiptap-only-in-ui`): `domain/save-page-port.ts` declara el puerto
  `SavePagePort` (los Server Actions `saveContent`/`getCurrentContent` de
  `notebooks` lo cumplen de forma estructural, sin importarlo) y toma
  `TiptapDoc`/`TiptapNode` de `src/shared/kernel/tiptap-doc.ts`;
  `domain/image-upload-port.ts` (`ImageUploadPort`) y
  `domain/mention-port.ts` (`MentionPort`) son los otros dos puertos que la
  raíz de composición inyecta; `domain/autosave-state.ts` define el estado
  puro del autoguardado y `application/use-autosave.ts` implementa el
  debounce, el reintento y la reconciliación de conflictos de versión.
- `ui/tiptap/editor.tsx` exporta `Editor` (`pageId`, `initialContent`,
  `initialVersion`, `port`, y opcionales `imagePort`, `mentionPort`,
  `extraSlashItems`, `statusPortalId`). Monta el estado de guardado
  (`save-status.tsx`), el aviso de conflicto (`conflict-banner.tsx`), la
  barra flotante de formato (`bubble-toolbar.tsx`), la barra de tablas
  (`table-toolbar.tsx`) y el asa de arrastre con su menú contextual
  (`block-handle.tsx`, `block-context-menu.tsx`).
- `ui/tiptap/extensions/index.ts` (`createEditorExtensions()`) registra
  StarterKit, listas de tareas, resaltado con paleta, callouts, bloques de
  código con lowlight, imágenes (subida directa a Supabase Storage con URL
  firmada mediante `ImageUploadPort`), tablas, detalles, emoji, menciones
  `@` a páginas, matemáticas KaTeX, tabla de contenidos, alineación,
  subíndice y superíndice, estilos de texto (color, fondo, familia, tamaño,
  interlineado), fondo de bloque, identificadores de bloque estables
  (`UniqueID`), atajos de bloque, tipografía, YouTube y el texto indicativo de los bloques vacíos (`Placeholder`).
- Menú `/` (`slash-command.tsx`, `slash-command-items.ts`): texto, títulos
  1–3, cita, bloque de código, listas con viñetas, numeradas y de tareas,
  imagen, tabla, divisor, tabla de contenidos, emoji, mención y callouts de
  idea, nota y advertencia. La página agrega "Importar documento" con
  `extraSlashItems` (el editor no conoce `ingestion`).

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

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo.
