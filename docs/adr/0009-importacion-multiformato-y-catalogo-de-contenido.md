# ADR 0009 — Importación multiformato con mammoth y officeparser y catálogo estricto de contenido

| Campo | Valor |
|---|---|
| Fecha | 2026-10-26 |
| Estado | Aceptado (implementado para PDF, Word y PowerPoint) |
| Reemplaza | La fila "Extracción PDF: unpdf" de §4.1 y la restricción "solo PDF" de §3.2, §5.2 y §13 (Fase 2) del documento maestro 1.6.0; recogido en la versión 1.7.0. No cambia la decisión de no hacer OCR (§1.2) ni el procesamiento síncrono de ADR 0003 |

## Contexto

La Fase 2 (2026-09-23) dejó una importación solo de PDF: `unpdf` devuelve texto plano por página y la heurística `textToBlocks` adivina títulos, párrafos y listas. Se perdían tablas, imágenes, código, formato en línea y orden de lectura, y los archivos de Word y PowerPoint se rechazaban. El material de estudio llega sobre todo como diapositivas y documentos de Word, así que la importación era la entrada más débil del producto.

Además, nada en el servidor garantizaba que el contenido importado se pudiera mostrar: `tiptapDocSchema` aceptaba cualquier nombre de nodo, y el editor no registraba varios nodos que un documento podía traer (detalles, YouTube, títulos 4 a 6, colores de texto y fondo).

La investigación del 2026-10-26 comparó extractores y la tarea T0 (prueba de concepto, sin código de producción) midió officeparser 8.2 y mammoth 1.13 sobre documentos de prueba con cada construcción: un PDF de 30 páginas en 0,4 s, una presentación de 40 diapositivas en 48 ms y un DOCX de 30 páginas en 84 ms, con un máximo de 175 MB de memoria. La característica se construyó con ODD en la rama `feat/document-import` (tareas T0–T6, T9, T9b, T10, T11 y T11b); cada commit de trabajo pasó una revisión nativa. Las decisiones de producto son del usuario (2026-10-26).

## Decisión

### Formatos y motores

1. **Formatos admitidos: PDF, Word (`.docx`) y PowerPoint (`.pptx`).** El formato se detecta por los bytes reales (`%PDF-`; un ZIP con `[Content_Types].xml` y `word/document.xml` o `ppt/presentation.xml`), no por la extensión ni por el tipo declarado. Los binarios antiguos `.doc` y `.ppt` (OLE2) quedan fuera: ninguno de los dos motores los lee y harían falta LibreOffice u otro binario del sistema; se rechazan como `unsupported_format`. Hoy se importan de punta a punta PDF y Word; PowerPoint ya se detecta, el bucket lo acepta y `import_jobs.format` lo registra, pero su adaptador (T7) no existe y la interfaz no lo ofrece.
2. **Un adaptador por formato detrás de un puerto único.** `DocumentExtractor.extract(bytes, format)` devuelve el documento importado, las imágenes extraídas y los conteos de páginas e imágenes omitidas; `FormatRoutingDocumentExtractor` elige el adaptador. Las librerías de análisis solo se importan desde `ingestion/infrastructure` (reglas `mammoth-only-in-ingestion-infra` y `officeparser-only-in-ingestion-infra`, junto a `unpdf-only-in-ingestion-infra`); el mapeo a bloques es dominio puro.
3. **Word: mammoth para la estructura y officeparser para lo que mammoth descarta.** mammoth lee títulos, listas anidadas, tablas con celdas combinadas, código, citas, casillas, saltos de página e imágenes con su texto alternativo; officeparser aporta el color del texto, el sombreado y el resaltado, el número inicial de las listas numeradas y las ecuaciones OMML convertidas a LaTeX. Los dos motores corren uno después del otro, nunca en paralelo, y si officeparser falla el documento se importa solo con mammoth (salvo que su falla sea un límite superado).
4. **PDF: `unpdf` y `textToBlocks` se mantienen por ahora.** Pasar el PDF a officeparser (estructura de los PDF etiquetados, con `textToBlocks` solo como respaldo para los no etiquetados) es la tarea T8; hasta entonces el PDF sigue entrando como texto con títulos y listas por heurística.
5. **PowerPoint: officeparser (T7, implementado).** Cada diapositiva, en el orden de la presentación, aporta su título como encabezado de nivel 2 (nivel 1 si es el título centrado de una diapositiva de título; "Diapositiva N" si no tiene título), su cuerpo como bloques (párrafos con formato y enlaces seguros, listas anidadas reconstruidas desde el nivel de cada párrafo, incluidas las viñetas heredadas del patrón, tablas con fila de encabezado y celdas combinadas leídas del XML de la diapositiva, imágenes con su texto alternativo) y sus notas del orador como un bloque de detalles cerrado "Notas del orador". No se añade separador entre diapositivas. Las diapositivas y formas ocultas, y los marcadores de número de diapositiva, fecha y pie, no se importan.
6. **Sin OCR.** Un PDF escaneado sigue fallando como `no_text_layer`. La prueba de concepto mostró que `tesseract.js` es viable sin conexión (unos 5 a 8 s por página en una vCPU, tope de unas 10 páginas, solo texto), pero adoptarlo es una decisión pendiente del usuario (T12).
7. **Canalización local y de costo cero.** Todo corre dentro de la Server Action de la página con `maxDuration = 120` (ADR 0003), sin servicios externos ni otro alojamiento. officeparser se declara en `serverExternalPackages` de `next.config.ts`, porque Turbopack rompe su envoltorio ESM al empaquetarlo; mammoth se empaqueta normalmente.

### Catálogo estricto de contenido

8. **El contrato de contenido es el catálogo completo de Tiptap.** `src/shared/kernel/tiptap-catalogue.ts` enumera los nodos, marcas y atributos permitidos, incluidos nodos que Cogni todavía no inserta desde el menú (detalles, YouTube, mención, emoji, tabla de contenido), para que las funciones futuras no necesiten migrar el contenido guardado.
9. **Lo importado se valida contra el catálogo antes de escribirse.** `writeImportedContent` (`notebooks`) usa el esquema estricto `tiptapContentSchema`, que rechaza nodos, marcas o atributos desconocidos, valores inválidos, anidamientos incorrectos, nodos de texto vacíos y enlaces que no sean `http`, `https` o `mailto`. El autoguardado del editor conserva el esquema permisivo `tiptapDocSchema`.
10. **El editor registra todo el catálogo.** Se añadieron detalles, YouTube (siempre desde `youtube-nocookie.com`, con `frame-src 'self' https://www.youtube-nocookie.com` en la CSP), matemáticas en bloque en modo de presentación, color de fondo, familia, tamaño e interlineado de fuente y el texto alternativo de la imagen. Una prueba de paridad compara el esquema real del editor con el catálogo y una prueba de ida y vuelta carga un documento con todas las construcciones y exige que `getJSON()` devuelva lo mismo. Los títulos 4 a 6, que el editor ya admitía, reciben su propia escala tipográfica, y los bloques de código sin lenguaje ya no se colorean por detección automática.
11. **Imágenes importadas como recursos de página.** Las imágenes png, jpeg, gif y webp se suben desde el servidor al bucket `page-assets`, se registran en `page_assets` (`NotebooksServerApi.storeImportedAsset`) y el bloque `image` las referencia por `assetId`. Las de otros formatos (EMF, WMF, TIFF), las demasiado grandes y las que no alcanzan a subirse dentro del presupuesto se omiten, se cuentan en `import_jobs.skipped_images` y el estudiante ve un aviso.
12. **Texto plano para la IA desde cualquier nodo.** `extractPlainText` cubre todo el catálogo sin partir párrafos (átomos en línea en su línea, matemáticas como LaTeX, tablas, detalles, código). El texto alternativo de una imagen y el texto oculto de Word (`w:vanish`) no llegan a `plain_text`, porque el estudiante no los ve.

### Datos y telemetría

13. **Migración `0014_document_formats.sql`.** `import_jobs` gana `format` (`pdf|docx|pptx`, con `CHECK` y relleno desde la extensión de la ruta) y `skipped_images` (≥ 0). El bucket privado `page-pdfs` acepta también los tipos MIME de DOCX y PPTX, con el mismo límite de 20 MiB; conserva su nombre histórico (renombrar un bucket obliga a mover todos los objetos), como deuda de nombres conocida.
14. **Evento `document_imported`.** El evento de PostHog `pdf_imported` se renombra a `document_imported` y suma las propiedades `format` y `skipped_images`. Los insights que usaban el nombre anterior deben actualizarse en PostHog.

## Consecuencias

- Un documento de Word llega como una página editable con su estructura: títulos, formato en línea, colores, listas, tablas con celdas combinadas, código, citas, casillas, ecuaciones e imágenes. El PDF sigue igual que en la Fase 2 hasta T8.
- Todo bloque importado se puede mostrar en el editor: el catálogo, el esquema estricto y la prueba de paridad impiden que el importador y el editor se separen.
- Límites de seguridad (auditoría del 2026-10-26, T9b), todos como constantes con nombre: revisión del directorio central del ZIP antes de analizar (2000 entradas, 50 MiB por parte, 150 MiB en total, razón de compresión máxima 200:1, 1 000 000 de elementos XML, 256 niveles de anidamiento), inflado propio con tope de salida (ningún motor descomprime por su cuenta), motores en secuencia, PDF de hasta 300 páginas con 100 000 caracteres por página y 2 000 000 en total, extracción en carrera contra el presupuesto de 100 s, imágenes de hasta 10 MiB, 100 por documento y 40 MiB en total, límites por usuario (20 permisos de subida por hora, 10 inicios por hora y 3 importaciones activas, este último aplicado de forma atómica con un candado consultivo de Postgres), títulos sin caracteres de control ni de formato y una consulta de estado que no revela si existe la página de otro usuario.
- El límite por usuario se movió a `src/shared/rate-limit` (Upstash en modo `live`, memoria en los demás), reutilizado por `ingestion`; la regla `upstash-only-in-ai-infra` admite ahora esa carpeta.
- Cuatro dependencias nuevas de producción (`mammoth`, `officeparser`, `@tiptap/extension-details`, `@tiptap/extension-youtube`) y dos de desarrollo solo para generar documentos de prueba (`docx`, `pptxgenjs`; este último tiene un aviso de seguridad alto en `image-size` y por eso no entra en producción).
- Las Server Actions, el puerto `PdfStorageGateway`, el bucket y `SUPABASE_PDF_BUCKET` conservan sus nombres de la era PDF: renombrarlos no cambia nada para el estudiante.

### Riesgos residuales

- **Análisis síncrono.** pdf.js y el analizador XML trabajan de forma síncrona, así que la carrera contra el presupuesto no puede interrumpirlos: una página o una parte dentro de los límites todavía puede pasar del presupuesto, y su resultado se descarta. El techo duro sigue siendo `maxDuration = 120`. Se descartó un `worker_thread` con terminación forzada porque exige un archivo de entrada propio trazado en la salida de Next 16 y un arranque por llamada.
- **El límite por usuario falla abierto.** Si Upstash responde con error, la importación sigue y el error se registra; el tope de importaciones activas en la base de datos se mantiene.
- **Texto oculto incompleto.** Se elimina el texto con `w:vanish` o `w:specVanish` en la ejecución, en su estilo de carácter o en su estilo de párrafo, pero no el que se oculta por los valores predeterminados del documento (`docDefaults`) ni por estilos de tabla o de numeración.

### Pendientes

- T8 (PDF con officeparser y retiro de `unpdf`), T12 (decisión sobre OCR) y T13 (pruebas e2e por formato; Word y PowerPoint ya tienen la suya). PowerPoint (T7) quedó implementado el 2026-10-26.
- Actualizar los insights de PostHog al nombre `document_imported`.
- Aplicar la migración `0014` en `cogni-prod` (aplicada en `cogni-dev` el 2026-10-26).
- Observaciones de revisión no bloqueantes registradas en `odd/tasks/document-import.md`.

## Alternativas descartadas

- **Docling, Marker, MinerU y MarkItDown**: son de Python y, salvo MarkItDown, dependen de modelos de aprendizaje automático; exigirían un servicio aparte con su propio alojamiento y presupuesto, fuera del monolito en Vercel.
- **Kreuzberg**: su OCR requiere Tesseract instalado en el sistema, que no existe en las funciones de Vercel.
- **Tiptap Conversion**: es un servicio de pago y no convierte PDF ni PowerPoint.
- **APIs alojadas (Mistral OCR, LlamaParse, Unstructured)**: envían los apuntes del estudiante a un tercero y tienen costo por página. Mistral OCR queda anotado como posible respaldo de pago para PDF escaneados, fuera del alcance actual.
- **Solo officeparser para Word**: pierde estructura que mammoth conserva (listas anidadas, tablas con celdas combinadas, estilos de código y de cita); solo mammoth pierde colores, números iniciales de lista y ecuaciones. La combinación conserva ambas cosas.
- **Seguir aceptando cualquier nodo en el servidor**: un documento importado podía guardar nodos que el editor no sabía mostrar.
