# Cogni — Documento Maestro de Producto, Arquitectura y Stack

| Campo | Valor |
|---|---|
| Versión del documento | 1.7.2 |
| Fecha | 2026-09-14 (actualizado 2026-10-26) |
| Cambios de la versión 1.7.2 | ADR 0009, T8: el PDF se importa con officeparser (títulos, formato en línea, enlaces, listas, tablas, bloques de código e imágenes desde el árbol de estructura o la geometría de la página), con `textToBlocks` como respaldo para documentos de solo párrafos; `unpdf` se retira. Notas en §3.2, §4.1 y §13 (Fase 2). |
| Cambios de la versión 1.7.1 | ADR 0009, T7: la importación de PowerPoint (`.pptx`) queda implementada de punta a punta con officeparser (títulos de diapositiva, cuerpo, listas, tablas, imágenes y notas del orador como bloque de detalles) y el selector la ofrece. Notas en §3.2, §4.1, §4.2 y §13 (Fase 2). |
| Cambios de la versión 1.7.0 | ADR 0009: importación multiformato (PDF y Word `.docx` de punta a punta; PowerPoint `.pptx` detectado y planificado; `.doc`/`.ppt` sin soporte) con mammoth y officeparser para Word y `unpdf` para PDF por ahora; catálogo estricto de contenido Tiptap validado al importar y registrado completo en el editor; imágenes importadas como `PageAsset`; límites de seguridad de la importación; evento `pdf_imported` renombrado a `document_imported`. Sigue sin OCR. Campos nuevos de `ImportJob` (`format`, `skipped_images`, migración `0014`). Notas en §3.2, §4.1, §4.2, §5.2, §6.1, §8.1, §9, §10.3 y §13 (Fase 2). |
| Cambios de la versión 1.6.0 | ADR 0008: decisiones de implementación de la Fase 7 ("Hoy" como pestaña de `/calendario`; el calendario muestra solo el próximo vencimiento de cada ítem y lo vencido en hoy; días en la zona horaria del perfil, elegida en `/configuracion` o detectada en el primer uso; tendencia desde `review_logs`; definiciones de tasa de acierto, racha y repasos completados; calibración solo con recordación activa; números del dashboard sin fuente resueltos por el usuario). Sin entidades ni migraciones nuevas. Notas en §3.5, §3.6, §5.2, §6.1 y §7.4; §13 (Fase 7 implementada). |
| Cambios de la versión 1.5.0 | ADR 0007: decisiones de implementación de la Fase 6 (evaluación asíncrona con `after()`, reclamo y sondeo acotado, "Reintentar"; respuesta fallida sin SM-2 y respuesta saltada sin modelo; límite de 60 evaluaciones por usuario por día con clave propia; sin resumen de IA de la sesión; sesión fija de 10 preguntas; generación incremental por huellas de párrafo en las tres técnicas; panel de técnicas al estilo NotebookLM Studio, "Crear examen" y hub de recordación activa). Nueva entidad `GenerationFingerprint`. Notas en §3.1, §3.3, §6.1, §7.4, §8.2, §8.3, §8.4 y §8.5; §13 (Fase 6 implementada). |
| Cambios de la versión 1.4.0 | ADR 0006: decisiones de implementación de la Fase 5 (exámenes de 10 a 30 preguntas, falladas primero; repetición con preguntas reformuladas y reglas para cuando no se puede armar; cronómetro solo dentro del examen; política de retroalimentación con reutilización; "Repasar contenido" antes de repetir). Notas en §3.3, §6.1, §7.2, §7.5 y §8.4; §13 (Fase 5 implementada). |
| Cambios de la versión 1.3.1 | Nueva Fase 8 — Diseño y flujos de pantalla (solo interfaz y navegación, sin cambios de lógica de backend), justo después de la Fase 7. Endurecimiento pasa a ser la Fase 9. Actualizados §1, §4 y §13. |
| Cambios de la versión 1.3.0 | ADR 0005: decisiones de implementación de la Fase 4 (repaso en la página del mazo, calificación solo de ítems vencidos, retroalimentación idempotente que no consume el límite diario de IA, trabajo diario de dominio acotado en tiempo y con bloqueo por página). Notas en §5.2, §6.1 y §7.3; §13 (Fase 4 implementada). |
| Cambios de la versión 1.2.0 | ADR 0004: capa de IA con cuatro proveedores gratuitos (Mistral y Cerebras descartados), límite de 6 generaciones por usuario por día y tope de página con truncado. Actualizadas §4.2, §4.3, §8.1, §8.2, §8.3, §8.4, §8.5 y §13 (Fase 3 implementada). |
| Cambios de la versión 1.1.0 | ADR 0003: Vercel Fluid Compute y Vercel Cron reemplazan a Trigger.dev. Fase 2 (importación de PDF) implementada y fuera de "Próximamente". La métrica por técnica "tiempo de estudio" se reemplaza por "repasos completados". |
| Estado | Aprobado. Fuente de verdad para todas las fases. |
| Autor | Javier Sarez |
| Metodología de construcción | Fases 0 y 1: Spec-Driven Development (SDD) con gentle-ai. Desde 2026-09-22: Organic Driven Development (ODD); SDD sigue disponible si se elige explícitamente. Ver §15. |

Este documento fija **qué** se construye, **con qué** se construye, **cómo** se organiza y **en qué orden**. Toda decisión aquí registrada se considera cerrada. Cambiarla requiere un ADR nuevo en `docs/adr/` que la reemplace explícitamente.

---

## 1. Visión y alcance

### 1.1 Qué es Cogni

Cogni es una plataforma web para estudiar a partir de apuntes propios. El estudiante escribe o importa su contenido en un editor de bloques tipo Notion, y la plataforma genera y programa, a partir de ese contenido, tres técnicas de estudio con respaldo científico:

1. **Flashcards** con repetición espaciada (algoritmo SM-2).
2. **Exámenes** de opción múltiple.
3. **Recordación activa** (Active Recall) con preguntas abiertas evaluadas por IA.

La **repetición espaciada** es transversal: un único motor decide cuándo debe repasarse cada ítem de cada técnica, calcula el nivel de dominio de cada página y alimenta el calendario y el dashboard.

### 1.2 Qué NO es Cogni (fuera de alcance)

- No es una herramienta colaborativa. Cada cuaderno pertenece a un solo usuario.
- No es una aplicación móvil nativa ni una PWA. Es web responsiva.
- No sincroniza con Google Calendar ni con calendarios externos.
- No tiene búsqueda global de contenido.
- No tiene logros, insignias ni gamificación.
- No hace OCR. Los PDF escaneados sin capa de texto no se importan.
- No expone una API pública.
- No cobra a los usuarios en esta etapa.

Estos puntos pueden reabrirse después de la Fase 9 mediante ADR.

### 1.3 Definición de "producto rápido por fases"

No se construye un MVP recortado. Se construye el producto completo en **fases pequeñas, cada una desplegada en producción y usable**. Cada fase deja la plataforma en un estado mejor que el anterior y nunca deja funcionalidad a medias visible al usuario.

### 1.4 Usuario objetivo

Estudiantes (universitarios, de secundaria, autodidactas) que toman apuntes digitales y quieren un método de estudio que les diga qué repasar y cuándo. Idioma de la interfaz: español, tratamiento de "tú".

---

## 2. Fundamentos de ciencia cognitiva

El diseño del producto no es arbitrario. Cada técnica y cada regla del motor se apoya en evidencia. Esta sección es la justificación; la Fase 3 y la Fase 4 deben ejecutar `sdd-research` para dejar las fuentes verificadas en el repositorio.

| Principio | Evidencia | Cómo lo aplica Cogni |
|---|---|---|
| Práctica de recuperación (testing effect) | Roediger y Karpicke (2006); Dunlosky et al. (2013) la califican de "alta utilidad" | Las tres técnicas obligan a recuperar información en vez de releer. |
| Práctica distribuida (spacing effect) | Ebbinghaus (1885); Cepeda et al. (2006); Dunlosky et al. (2013), "alta utilidad" | Motor SM-2 transversal que espacia los repasos según el desempeño. |
| Jerarquía de exigencia: reconocer < recordar con pista < producir | Literatura de recuperación libre vs. reconocimiento | Exámenes (reconocer), flashcards (recordar con pista), recordación activa (producir). |
| Dificultades deseables | Bjork y Bjork (2011) | La retroalimentación se entrega **después** del intento, nunca antes. |
| Carga cognitiva | Sweller (1988) | La unidad de estudio es la página, no el cuaderno. Sesiones cortas. |
| Metacognición y calibración | Dunning y Kruger (1999); Koriat | Autoevaluación por ítem comparada con el resultado real; el dashboard muestra la brecha. |
| SM-2 | Wozniak (1987), implementado por SuperMemo y Anki | Algoritmo del motor. FSRS se evalúa como evolución en un ADR posterior. |

---

## 3. Modelo de producto

### 3.1 Jerarquía de contenido

```
Usuario
└── Cuaderno (agrupación, sin semántica de estudio)
    └── Página (UNIDAD DE ESTUDIO)
        ├── Contenido (documento Tiptap en JSON)
        ├── Flashcards
        ├── Preguntas de examen
        └── Preguntas de recordación activa
```

Decisión cerrada: **las técnicas se generan por página**. Un cuaderno de 100 páginas no genera un examen de 100 páginas. Cada página tiene su propio conjunto de ítems y su propio nivel de dominio.

Notas de implementación de la Fase 6 (ADR 0007):

- **Panel "Técnicas de estudio".** Sigue el modelo de NotebookLM Studio: tres tarjetas (Flashcards, Recordación activa, Examen) con su botón "Generar" coloreado por técnica y la línea "Te quedan N generaciones hoy"; debajo, "Generado en esta página" muestra una fila por técnica con contenido, que abre su práctica (repaso del mazo, sesión de recordación o examen). El "Generar" de Examen abre un diálogo para elegir N (10–30).
- **Generación incremental.** Cada técnica recuerda, por página, la huella de los párrafos que ya envió a la IA. "Generar" envía solo los párrafos nuevos o editados; sin nada nuevo responde "No hay contenido nuevo para generar", sin llamar a la IA ni consumir generación. Borrar contenido no borra los ítems ya generados. Una página generada antes de la Fase 6 envía todos sus párrafos una vez.

### 3.2 El editor

- Motor: **Tiptap** (headless, sobre ProseMirror). Cogni construye su propia UI, su sistema de bloques y sus extensiones encima.
- Funcionalidades mínimas: títulos (H1–H3), párrafos, listas con viñetas, listas numeradas, listas de tareas, citas, bloques de código con resaltado de sintaxis, imágenes (subidas a Supabase Storage), divisores, tablas, callouts (idea, nota, advertencia), resaltado de texto con la paleta propia de Cogni, negrita, cursiva, subrayado, tachado, código en línea, enlaces.
- Menú de comandos con `/` para insertar cualquier bloque.
- Autoguardado con debounce y actualización optimista.
- El contenido se persiste como JSON de Tiptap; además se materializa un campo `plain_text` por página para la capa de IA.
- Importación de documentos (ADR 0009): PDF, Word (`.docx`) y PowerPoint (`.pptx`) se convierten en bloques editables dentro de una página nueva. Word conserva su estructura (títulos, formato y colores, listas, tablas con celdas combinadas, código, citas, casillas, ecuaciones e imágenes); PowerPoint se importa diapositiva por diapositiva (título como encabezado, cuerpo, listas, tablas, imágenes y notas del orador en un bloque de detalles "Notas del orador"); el PDF se importa con officeparser (títulos, negrita, cursiva, código, enlaces, listas, tablas con fila de encabezado, bloques de código e imágenes, desde las etiquetas del PDF o la geometría de la página) y, si solo tiene párrafos, como texto con títulos y listas por heurística. Los formatos antiguos `.doc` y `.ppt` no se admiten. Sin OCR.
- Todo bloque importado pertenece al catálogo de contenido de Tiptap (`src/shared/kernel/tiptap-catalogue.ts`), que el servidor valida al importar y que el editor registra completo.

### 3.3 Las tres técnicas

#### Flashcards

- Anverso y reverso, generadas por IA desde la página. La creación es solo con IA por decisión del usuario del 2026-10-29 (Fase 8, H13): no hay "Nueva tarjeta". Las tarjetas creadas a mano antes de esa fecha (`origin = manual`) se siguen mostrando, repasando y archivando.
- Sesión de repaso: se muestran los ítems vencidos de la página (o de todas las páginas, en la vista "Repasos de hoy").
- Calificación por el estudiante en escala SM-2 simplificada de 4 botones: Otra vez (q=1), Difícil (q=3), Bien (q=4), Fácil (q=5).
- Retroalimentación con IA al final de la sesión: resumen de qué se recordó bien y qué conviene reforzar.

#### Exámenes

- Preguntas de opción múltiple con 4 opciones y una correcta, generadas por IA desde la página. La creación es solo con IA por decisión del usuario del 2026-10-29 (Fase 8, H13): la pantalla de preguntas no ofrece "Nueva pregunta", pero conserva "Editar" y "Retirar" para corregir lo generado. Las preguntas creadas a mano antes de esa fecha (`origin = manual`) se siguen mostrando, rindiendo, editando y retirando.
- Sesión: N preguntas (configurable, por defecto 10). Corrección determinista.
- Cada pregunta es un ítem del motor. Correcta → q=4. Incorrecta → q=1.
- Si la nota del examen es menor a 70 %, la página queda marcada para repetir examen; el motor reprograma las preguntas falladas y el calendario lo muestra.
- Cuando el usuario repita el examen fallido no le van a salir las mismas preguntas demanera identica a las que fallo, se deben genera preguntas diferentes o descritas de otra manera, pero que ataquen las falencias que el estudiante presento anteriormente.
- Retroalimentación con IA al final: explicación de las preguntas falladas usando el contenido de la página.

Notas de implementación de la Fase 5 (ADR 0006):

- **Tamaño.** El estudiante elige N entre 10 y 30 (por defecto 10). Una página necesita al menos 10 preguntas raíz activas para tener examen; con menos, la interfaz pide agregar o generar preguntas. El orden es: raíces falladas en el último examen, luego raíces vencidas (la más antigua primero), luego las vistas hace más tiempo.
- **Repetición.** Las preguntas falladas vuelven **reformuladas** (mismo concepto, redacción u enfoque distintos, nunca una redacción usada antes por su linaje, nunca otro tema), primero en la sesión; después, el resto de las preguntas de la página hasta N. La repetición exige N mayor o igual al número de conceptos fallados que siguen en la página.
- **Cronómetro.** El examen muestra el tiempo transcurrido y los resultados muestran el tiempo total. Es una excepción acotada a la regla de no mostrar tiempo de estudio: solo dentro de la sesión y de sus resultados; el dashboard sigue sin mostrar tiempo. La duración se deriva de `started_at` y `finished_at`, no se guarda aparte.
- **Retroalimentación.** Examen fallado → retroalimentación nueva con las debilidades actuales. Primera aprobación → retroalimentación nueva. Aprobación posterior a otra aprobación → sin llamada a la IA: se muestra la retroalimentación guardada de la aprobación anterior. Un fallo después de aprobar vuelve a pedir una nueva. La retroalimentación nunca impide ver la nota.
- **Repasar antes de repetir.** Un resultado fallado ofrece "Repasar contenido", que abre la página del cuaderno con un aviso de los conceptos fallados y la acción "Repetir examen".
- Editar una pregunta la cambia en el lugar y conserva su raíz; retirarla suspende el ítem de la raíz cuando su linaje no tiene otra pregunta activa. No hay límite de tiempo y una sesión abandonada queda abierta (como en flashcards).

Nota de implementación de la Fase 6 (ADR 0007): `/exams` y la vista por cuaderno siguen listando solo las páginas con preguntas. Su encabezado ofrece "Crear examen" (en lugar del inicio rápido "Nuevo examen"): se elige cuaderno y página y luego "Generar con IA" (N de 10 a 30). Desde el 2026-10-29 (Fase 8, H12 y H13, decisión del usuario) la creación es solo con IA: ya no existe "Crear mis preguntas" ni una entrada para escribir la primera pregunta a mano.

#### Recordación activa

- Preguntas abiertas generadas por IA desde la página. Sesión de N preguntas (por defecto 10).
- El estudiante escribe su respuesta. Después de cada respuesta, se autoevalúa: "¿Qué tan difícil te resultó?" en escala 0–5.
- La IA evalúa cada respuesta contra el contenido de la página con una rúbrica y devuelve JSON validado (ver 8.5).
- La retroalimentación se muestra **al final de la sesión**, nunca entre preguntas.
- La calificación SM-2 del ítem combina evaluación de IA y autoevaluación (ver 7.4).

Notas de implementación de la Fase 6 (ADR 0007):

- **Generación.** Cada "Generar" crea 10 preguntas abiertas con rúbrica (`generate_recall_questions/v1`) y cuesta una generación del límite diario solo si las preguntas se guardaron.
- **Sesión.** Tamaño fijo de 10 (no hay selector): vencidas primero, luego nuevas y, para completar, las repasadas hace más tiempo. Cada respuesta y su autoevaluación se guardan al darlas. "Saltar" guarda la pregunta como no respondida. "Terminar" cierra con las respuestas dadas; las demás no se registran.
- **Evaluación y resultados.** Al cerrar, la evaluación corre después de responder al navegador; la vista de resultados consulta el estado y muestra la calidad combinada, la calibración y, por pregunta, el puntaje de la IA y su justificación cuando todas las evaluaciones terminaron. Una evaluación fallida queda marcada y "Reintentar" la vuelve a pedir. "No estoy de acuerdo" se registra y no cambia el puntaje.
- **Puntaje por sesión.** Porcentaje = promedio de la calidad combinada × 20; aciertos, parciales y fallos según el puntaje de la IA (≥ 4, 2–3, ≤ 1). El dominio de cada página viene del motor (§7.3).
- **Sin resumen de IA de la sesión.** La retroalimentación del final es la justificación por pregunta más la calidad combinada y la calibración; no se crea `SessionFeedback` para recordación activa.
- **Hub.** `/active-recall` y la vista por cuaderno muestran las páginas con sesiones terminadas, el porcentaje de cada sesión y el contador de preguntas vencidas hoy por cuaderno. La tarjeta de una página abre los resultados de su sesión más reciente ("Ver resultados →"), desde donde "Nueva sesión →" inicia otra.

### 3.4 El motor de repetición espaciada (transversal)

Decisión cerrada (opción C):

- **Cada ítem** (flashcard, pregunta de examen, pregunta abierta) tiene su propio estado SM-2.
- **Cada página** tiene un **nivel de dominio** derivado de sus ítems.
- El calendario y el dashboard leen el nivel de página. El detalle por ítem existe para el motor, no para el usuario.
- Ningún módulo calcula fechas de repaso fuera del motor.

### 3.5 Calendario

- Vista mensual y semanal con los repasos programados por el motor, agrupados por página.
- Vista "Hoy": lista de páginas con ítems vencidos, con acceso directo a la sesión de cada técnica.
- El usuario no crea eventos manualmente. El sistema los genera.

Notas de implementación de la Fase 7 (ADR 0008):

- **Una sola ruta.** `/calendario` (entrada "Calendario" de la barra lateral) tiene las pestañas "Hoy", "Semana" y "Mes". "Hoy" lista las páginas con ítems vencidos, la que más esperó primero, con un chip por técnica que abre su sesión (repaso del mazo, sesión de recordación o examen). La tarjeta "Repasos pendientes hoy" del inicio muestra el total real y enlaza al calendario.
- **Solo el próximo vencimiento.** "Semana" y "Mes" muestran cada ítem en el día de su próximo `due_at`, agrupado por página, con chips coloreados por técnica; no se proyectan repeticiones posteriores. Lo vencido aparece en hoy y los días pasados quedan vacíos. Sin datos, el calendario se pinta vacío.
- **Zona horaria.** Los días se cuentan en la zona del perfil (§6.1), que se elige en `/configuracion` o se detecta del navegador en el primer uso.

### 3.6 Dashboard

- Progreso por cuaderno y por página: nivel de dominio, tendencia, ítems totales y vencidos.
- Métricas por técnica: tasa de acierto, racha de días con repasos, repasos completados.
- Calibración metacognitiva: comparación entre autoevaluación y resultado real. Detecta exceso y falta de confianza.
- Gráficos con los componentes de gráficos de shadcn/ui (Recharts).

Notas de implementación de la Fase 7 (ADR 0008):

- **Datos reales.** `/dashboard` lee el módulo `analytics` en el período elegido (7, 15 o 30 días) y la zona del perfil; sin datos muestra un estado vacío y ante un fallo, un aviso de error. Ya no hay datos de muestra ni barrera de vista previa.
- **Tendencia.** Promedio semanal de la calidad de los repasos de la página (`review_logs`), no del puntaje de dominio, que no tiene historial. El módulo la calcula, pero el dashboard no la muestra: el progreso por cuaderno no tiene flecha de variación semanal.
- **Tasa de acierto.** Flashcards: repasos con calidad ≥ 3. Exámenes: respuestas correctas de exámenes terminados. Recordación activa: respuestas evaluadas con puntaje de IA ≥ 3. Se compara con el período anterior de la misma duración.
- **Racha y repasos completados.** Días locales consecutivos con al menos un repaso (hoy cuenta como abierto), en total y por técnica; repasos completados = filas de `review_logs` del período. Nunca se muestra tiempo de estudio.
- **Variaciones.** Solo "Racha de repasos" muestra variación (contra la racha de hace 7 días). "Ítems vencidos", "Páginas dominadas" y "Dominio global" muestran solo el valor actual.
- **Calibración.** Solo recordación activa (§7.4). Cada página se clasifica por su señal más frecuente entre sus respuestas; un empate favorece la señal descalibrada (primero exceso, luego falta de confianza).
- Sin sección de conceptos (no hay fuente por concepto) y con la etiqueta "Active recall", igual que la barra lateral.

### 3.7 Capa de IA como guía

La IA no es un chat. Cumple funciones acotadas y estructuradas:

1. Generar flashcards, preguntas de examen y preguntas abiertas desde una página.
2. Evaluar respuestas abiertas con rúbrica.
3. Producir retroalimentación al final de cada sesión según el puntaje.

Toda salida es JSON validado con Zod. Nunca texto libre sin esquema.

---

## 4. Stack tecnológico

Regla de versiones: en la Fase 0 se instala **la última versión estable** de cada dependencia, se fija en `package.json` y se verifica con documentación oficial actualizada (Context7). Este documento no fija números de versión para no quedar obsoleto; el `package.json` es la referencia.

### 4.1 Núcleo

| Capa | Tecnología | Uso | Costo | Condición de salida |
|---|---|---|---|---|
| Gestor de paquetes | pnpm (único) | Fijado con `packageManager` y `engines` | 0 | Ninguna |
| Framework | Next.js (App Router) + TypeScript estricto | Frontend y backend en una sola app | 0 | Ninguna |
| UI | Tailwind CSS + shadcn/ui | Sistema de diseño Cogni encima | 0 | Ninguna |
| Editor | Tiptap + extensiones oficiales | Editor de bloques | 0 | Extensiones Pro solo si un ADR lo justifica |
| Estado servidor en cliente | TanStack Query | Mutaciones optimistas, autoguardado, dashboard | 0 | Ninguna |
| Estado de UI | Zustand (mínimo) | Estado de sesión de estudio y UI | 0 | Ninguna |
| Validación | Zod | Entradas, formularios y esquemas de salida de IA | 0 | Ninguna |
| ORM | Drizzle ORM + drizzle-kit | Acceso a Postgres y migraciones versionadas | 0 | Ninguna |
| Lint y formato | Biome | Una sola herramienta | 0 | Ninguna |
| Gráficos | shadcn/ui charts (Recharts) | Dashboard | 0 | Ninguna |
| Extracción de documentos | mammoth + officeparser (Word); officeparser (PowerPoint y PDF) | Estructura de Word con mammoth y, con officeparser, colores, numeración y ecuaciones; diapositivas de PowerPoint y estructura de PDF con officeparser, cuyo pdf.js corre en un proceso aparte (ADR 0009) | 0 | Ninguna; officeparser va en `serverExternalPackages` |

### 4.2 Infraestructura y servicios

| Servicio | Uso | Plan | Límite relevante | Mitigación / condición de salida |
|---|---|---|---|---|
| Vercel | Hosting y deploy de Next.js, previews por rama | Hobby | Solo uso no comercial | Sin anuncios, donaciones ni cobros. Al monetizar: Pro. |
| Supabase | Postgres, Auth (correo + Google), Storage (documentos importados e imágenes) | Free | Pausa tras 7 días sin actividad; 500 MB DB; 1 GB Storage | Cron diario de keep-alive. Con usuarios recurrentes: Pro. |
| Cloudflare | Registrador de dominio y DNS | Registrar a costo | — | Solo DNS. Sin proxy delante de Vercel. |
| Upstash Redis | Una única base `cogni` con prefijo `REDIS_KEY_PREFIX`: límites por usuario, cuotas por proveedor de IA y estado del circuit breaker | Free | 500.000 comandos/mes | No se usa como caché genérica. (actualizado en la Fase 3, ADR 0004) |
| Vercel Functions (Fluid Compute) + Vercel Cron | Trabajo síncrono acotado (procesar documentos importados, generación con IA, evaluación) y tareas programadas diarias (keep-alive, cálculo de repasos) | Hobby | 300 s por función con `maxDuration` explícito; crons diarios | ADR 0003. Si un trabajo supera los 300 s, se reintroduce un servicio de jobs con un ADR nuevo. |
| Sentry | Errores en cliente y servidor | Free | Eventos/mes del plan free | Muestreo si se acerca al límite. |
| PostHog | Analítica de producto | Free | Eventos/mes del plan free | Eventos definidos explícitamente, sin autocaptura masiva. |
| Better Stack | Logs centralizados | Free | — | **Diferido a Fase 9.** Se conecta con log drain de Vercel. |
| GitHub | Código, PRs, Actions (CI) | Free | Minutos de Actions del plan free | Ninguna |

### 4.3 Proveedores de IA (todos vía Vercel AI SDK)

| Proveedor | Paquete AI SDK | Modelo | Rol en la rotación |
|---|---|---|---|
| Google AI Studio | `@ai-sdk/google` | `gemini-3.5-flash-lite` | Generación, prioridad 1 |
| Cloudflare Workers AI | `@ai-sdk/openai-compatible` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Generación, prioridad 2 |
| OpenRouter | `@openrouter/ai-sdk-provider` | `nvidia/nemotron-3.5-super-vl:free` | Generación, prioridad 3 (reemplaza a `qwen/qwen3.8-27b:free`, retirado; 2026-10-28) |
| OpenRouter | `@openrouter/ai-sdk-provider` | `dots-studio/dots-3-note-preview:free` | Generación, prioridad 4 (reemplaza a `nvidia/nemotron-3-super-120b-a12b:free`, retirado; 2026-10-28) |
| Groq | `@ai-sdk/groq` | `openai/gpt-oss-120b` | Solo evaluación (no se usa en la generación de la Fase 3) |

(actualizado en la Fase 3, ADR 0004) Mistral y Cerebras se descartaron porque exigen método de pago o tarjeta. Nunca se usan varios proyectos de Google por incumplimiento de sus términos de servicio. El detalle y las alternativas descartadas están en `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.

Restricción conocida: los modelos Pro de Gemini no están en el tier gratuito. Los límites de los tiers gratuitos cambian sin aviso; la capa de IA se diseña asumiendo que cualquier proveedor puede fallar o agotar cuota en cualquier momento. Herramientas descartadas: OmniRoute (proxy local, no desplegable en Vercel; se usa solo como referencia de estrategias de enrutamiento), itsfree.ai (directorio informativo, no un servicio), rosenCharts (sin mantenimiento).

### 4.4 Calidad y documentación

| Aspecto | Decisión |
|---|---|
| Tests unitarios y de dominio | Vitest |
| Tests de componentes | Testing Library |
| Tests de extremo a extremo | Playwright, 3 a 5 flujos críticos |
| TDD | Estricto en dominio. Motor SM-2 y cálculo de dominio: cobertura 100 %. |
| CI | GitHub Actions en cada PR: instalación, Biome, `tsc --noEmit`, Vitest. Playwright en main. |
| Deploy | Integración Git de Vercel. Preview por rama, producción desde `main`. |
| Documentación de código | TSDoc en puertos, entidades y servicios de aplicación. |
| Documentación de proyecto | Este documento, ADRs en `docs/adr/`, artefactos SDD de gentle-ai en `openspec/` (Fases 0 y 1) y documentos de feature ODD en `odd/tasks/`. |
| Diagramas | archify, generados desde el agente hacia `docs/diagramas/`. |
| Manual de usuario | Fase 9. |
| Swagger / Scalar / Mintlify | No aplica en esta etapa. No hay API pública. |
| Docker | No para la app. Solo lo usa la Supabase CLI para Postgres local. |

---

## 5. Arquitectura

### 5.1 Estilo

**Monolito modular** con **arquitectura hexagonal por módulo**. Una sola aplicación Next.js desplegable. Cada módulo tiene dominio puro, casos de uso, adaptadores de infraestructura y UI.

### 5.2 Mapa de módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `identity` | Perfil de usuario, sesión, preferencias | Supabase Auth |
| `notebooks` | Cuadernos, páginas, contenido, `plain_text` | `identity` |
| `editor` | Extensiones Tiptap, bloques, menú `/`, resaltados, autoguardado | `notebooks` (por puerto de guardado) |
| `ingestion` | Subida de documentos (PDF, Word y PowerPoint), extracción, conversión a bloques del catálogo e imágenes importadas | `notebooks`, Storage |
| `ai` | Registro de proveedores, rotación por cuota, salida estructurada, prompts versionados, rate limiting | Upstash, proveedores |
| `study-engine` | Estado SM-2 por ítem, nivel de dominio por página, cálculo de vencimientos | Nadie del dominio de estudio |
| `flashcards` | Tarjetas, sesiones, retroalimentación | `study-engine`, `ai`, `notebooks` |
| `exams` | Preguntas, sesiones, corrección, retroalimentación | `study-engine`, `ai`, `notebooks` |
| `active-recall` | Preguntas abiertas, sesiones, evaluación combinada | `study-engine`, `ai`, `notebooks` |
| `scheduling` | Calendario y vista "Hoy" | `study-engine`, `notebooks` |
| `analytics` | Dashboard, métricas, calibración | `study-engine`, técnicas (solo lectura) |

Nota de implementación (Fase 4, ADR 0005): `study-engine` también persiste las sesiones de flashcards y la retroalimentación de sesión (`FlashcardSession`, `SessionFeedback`) y ofrece la sesión de repaso (iniciar, calificar, terminar) como API de servidor; las acciones que la usan y el caso de uso de retroalimentación viven en `flashcards`, porque `study-engine` no importa técnicas. Los puertos `RecordReview` y `GetDueItems` de §5.3 se materializan en esa API (`gradeFlashcard`, `startFlashcardSession`) y en `StudyItemRepository.listDue`.

Nota de implementación (Fase 7, ADR 0008): `scheduling` y `analytics` leen con lectores Drizzle propios de solo lectura (`scheduling`: `study_items`, `pages`, `notebooks`; `analytics`: además `review_logs`, `page_mastery`, `exam_answers` y `recall_answers`), porque los casos de uso de `study-engine` y de las técnicas no ofrecen lecturas por dueño y rango. De otros módulos solo importan por su `index.ts`: tipos de `study-engine`, la sesión de `identity` y, en `analytics`, `calibrationOf` de `active-recall`. Ninguno escribe, guarda métricas ni calcula vencimientos o dominio.

### 5.3 Reglas de dependencia (obligatorias)

1. `domain` no importa nada externo: ni Next.js, ni Drizzle, ni AI SDK, ni React.
2. `application` depende solo de `domain` y de puertos (interfaces) definidos en `domain` o `application`.
3. `infrastructure` implementa puertos. Es el único lugar con Drizzle, Supabase, AI SDK, Upstash.
4. `ui` consume `application` a través de Server Actions o route handlers. Nunca toca `infrastructure` directamente.
5. Un módulo solo importa de otro módulo a través de su `index.ts` público. Nunca de rutas internas.
6. `study-engine` no conoce las técnicas. Las técnicas le envían resultados por el puerto `RecordReview` y le consultan vencimientos por `GetDueItems`.
7. Se verifica con reglas de Biome o con un test de arquitectura (dependency-cruiser) en CI.

### 5.4 Estructura de carpetas

```
cogni/
├── src/
│   ├── app/                      # Rutas Next.js (App Router). Capa delgada.
│   │   ├── (public)/             # landing, login, registro
│   │   ├── (app)/                # shell autenticado
│   │   └── api/                  # route handlers (webhooks, keep-alive)
│   ├── modules/
│   │   ├── identity/
│   │   ├── notebooks/
│   │   ├── editor/
│   │   ├── ingestion/
│   │   ├── ai/
│   │   ├── study-engine/
│   │   ├── flashcards/
│   │   ├── exams/
│   │   ├── active-recall/
│   │   ├── scheduling/
│   │   └── analytics/
│   │       ├── domain/           # entidades, value objects, reglas, puertos
│   │       ├── application/      # casos de uso, DTOs, servicios
│   │       ├── infrastructure/   # repositorios Drizzle, adaptadores externos
│   │       ├── ui/               # componentes React del módulo
│   │       └── index.ts          # API pública del módulo
│   ├── shared/
│   │   ├── kernel/               # Result, errores de dominio, ids, fechas
│   │   ├── db/                   # cliente Drizzle, esquema compartido
│   │   ├── ui/                   # shadcn/ui y primitivas del design system
│   │   └── config/               # env validado con Zod
├── drizzle/                      # migraciones generadas
├── tests/
│   └── e2e/                      # Playwright
├── docs/
│   ├── documento-maestro.md
│   ├── adr/
│   ├── design-system/
│   └── diagramas/
├── openspec/                     # artefactos SDD de gentle-ai
└── .github/workflows/
```

### 5.5 Flujo de datos de referencia

```
Usuario edita página
  → editor.ui (Tiptap) → autoguardado (TanStack Query)
  → Server Action → notebooks.application.SavePage
  → notebooks.infrastructure.PageRepository (Drizzle)
  → Postgres (content JSON + plain_text)

Usuario pide "Generar flashcards" (planificado, Fase 3; aún no hay código de generación)
  → flashcards.ui → Server Action (maxDuration acotado) → flashcards.application.RequestGeneration
  → ai.application.GenerateStructured (rotación de proveedor)
  → flashcards.infrastructure guarda tarjetas
  → study-engine.RegisterItems crea estado SM-2 por tarjeta
  → la Server Action responde con el resultado y la UI lo muestra (sin cola ni polling: el trabajo cabe en `maxDuration`)

Usuario califica una tarjeta
  → flashcards.application.RateCard
  → study-engine.RecordReview(itemId, quality)
  → recalcula SM-2 del ítem y nivel de dominio de la página
  → scheduling y analytics leen el nuevo estado
```

---

## 6. Modelo de dominio y datos

### 6.1 Entidades principales

Convenciones comunes a todas las entidades de usuario: `id` (UUID v7), `owner_id`, `created_at`, `updated_at`. Se omiten de la tabla para no repetirlos. El borrado es lógico (`archived_at`) en todo lo que el usuario crea a mano.

| Entidad | Módulo | Campos clave |
|---|---|---|
| `Profile` | identity | `id` (= auth.users.id), `display_name`, `locale`, `timezone` (IANA, para presentar fechas), `onboarding_completed_at` |
| `Notebook` | notebooks | `title`, `icon` (emoji elegido por el usuario), `color`, `position`, `archived_at` |
| `Page` | notebooks | `notebook_id`, `title`, `content` (jsonb Tiptap), `plain_text`, `content_version`, `position`, `archived_at` |
| `PageAsset` | notebooks | `page_id`, `storage_path`, `mime`, `size_bytes` |
| `ImportJob` | ingestion | `page_id`, `storage_path`, `file_name`, `format` (pdf/docx/pptx), `status` (queued/processing/done/failed), `page_count`, `skipped_images` (imágenes omitidas), `error` |
| `StudyItem` | study-engine | `page_id`, `kind` (flashcard/exam_question/recall_question), `source_id` (id de la Flashcard, de la `ExamQuestion` raíz o de la `RecallQuestion`), `easiness` (≥1.3, inicial 2.5), `interval_days`, `repetitions`, `due_at`, `last_quality`, `last_reviewed_at`, `lapses`, `suspended_at` |
| `ReviewLog` | study-engine | `item_id`, `quality`, `reviewed_at`, `interval_before`, `interval_after`, `easiness_after`, `session_kind`, `session_id` |
| `PageMastery` | study-engine | `page_id`, `level` (Nuevo/Aprendiendo/Consolidando/Dominado), `score` (0–1), `items_total`, `items_due`, `computed_at` |
| `Flashcard` | flashcards | `page_id`, `front`, `back`, `origin` (ai/manual), `generation_id`, `archived_at` |
| `FlashcardSession` | flashcards | `page_id` (nulo en la vista "Hoy" multipágina), `started_at`, `finished_at`, `reviewed_count`, `again_count` |
| `ExamQuestion` | exams | `page_id`, `stem`, `options` (jsonb, 4), `correct_index`, `explanation`, `concept` (texto corto: el concepto que evalúa), `root_id` (id de la pregunta original de su linaje; igual a su propio `id` si es original), `variant_of` (id de la pregunta a la que reemplaza, nulo si es original), `origin` (ai/manual/ai_variant), `generation_id`, `retired_at` |
| `ExamPageState` | exams | `page_id`, `retake_pending` (bool), `failed_root_ids` (jsonb, ids raíz falladas en el último examen), `last_passed_session_id` |
| `ExamSession` | exams | `page_id`, `is_retake`, `retake_of_session_id`, `started_at`, `finished_at`, `total`, `correct`, `score` (0–1), `passed` |
| `ExamAnswer` | exams | `session_id`, `question_id` (la variante realmente mostrada), `root_id`, `selected_index`, `is_correct`, `answered_at` |
| `RecallQuestion` | active-recall | `page_id`, `prompt`, `rubric` (jsonb: `keyConcepts[]`, `acceptableAnswerSummary`), `origin`, `generation_id`, `archived_at` |
| `RecallSession` | active-recall | `page_id`, `started_at`, `finished_at`, `evaluation_status` (pending/done/partial) |
| `RecallAnswer` | active-recall | `session_id`, `question_id`, `answer_text`, `self_rating` (0–5), `evaluation_status` (pending/done/failed), `ai_evaluation` (jsonb crudo), `ai_score` (0–5), `combined_quality` (0–5), `generation_id`, `disagreed` (bool) |
| `SessionFeedback` | técnicas | `session_kind`, `session_id`, `content` (jsonb), `generation_id`, `status` (pending/done/failed) |
| `GenerationFingerprint` | técnicas (kernel compartido) | `page_id`, `technique` (flashcards/exam/recall), `fingerprint` (sha256 hexadecimal del párrafo normalizado), `created_at`; sin `id` ni `updated_at`: la clave es `(page_id, owner_id, technique, fingerprint)` |
| `AiGeneration` | ai | `page_id` (nulo si no aplica), `purpose`, `provider`, `model`, `prompt_version`, `input_tokens`, `output_tokens`, `latency_ms`, `status` (queued/running/done/failed), `error` |

Relaciones que importan:

- Un `StudyItem` de tipo `exam_question` apunta a la pregunta **raíz** (`root_id`). Todas las variantes de esa raíz alimentan el mismo ítem. Así el motor sigue el concepto, no la redacción.
- `ReviewLog.session_id` apunta a `FlashcardSession`, `ExamSession` o `RecallSession` según `session_kind`.
- `SessionFeedback` existe una vez por sesión terminada de flashcards o exámenes; la recordación activa no lo crea (ADR 0007).
- `owner_id` se filtra en la capa de aplicación en toda consulta, sin excepción. La única excepción deliberada es el listado entre dueños del trabajo diario de dominio (`StudiedPageReader`), que corre sin sesión y devuelve solo identificadores.

Notas de implementación de la Fase 4 (ADR 0005):

- `FlashcardSession` no tiene `status`: está abierta mientras `finished_at` es nulo. Su tabla y su repositorio están en `study-engine`.
- `SessionFeedback` nace `pending` cuando se pide y pasa una sola vez a `done` (con contenido) o `failed`; ambos son definitivos. Una fila `pending` sin tocar durante 2 minutos se puede reclamar. Su tabla y su repositorio están en `study-engine`; el caso de uso, en `flashcards`.
- `Flashcard.archived_at` se agregó en la migración 0009 (faltaba en la Fase 3). Archivar una tarjeta suspende su `StudyItem`; el último ítem activo de un mazo no se puede archivar.

Notas de implementación de la Fase 5 (ADR 0006):

- Migraciones `0010_exams` y `0011_exam_session_questions` (con sus `.down.sql`). Las preguntas de examen no se borran: se retiran (`retired_at`).
- `ExamSession` agrega `requested_count` (N, entre 10 y 30) y `question_ids` (jsonb: los ids de las preguntas mostradas, en orden, fijados al iniciar; de 1 a `requested_count` ids). Responder, cerrar y leer una sesión usan solo esa lista, así que los cambios posteriores en las preguntas o en los ítems de la página no mueven un examen abierto. La duración no se guarda: se deriva de `started_at` y `finished_at`.
- `ExamAnswer` tiene clave `(session_id, question_id)`, un único `(session_id, root_id)` y una clave foránea `(question_id, root_id)` que exige que `root_id` sea la raíz real de la pregunta.
- `ExamPageState` tiene clave `page_id` y guarda `owner_id`. Su `upsert` no escribe nada para una página que no es del dueño.
- Las claves foráneas del linaje (`root_id`, `variant_of`) son NO ACTION: una raíz con variantes o una pregunta reemplazada no se pueden borrar; borrar la página o el dueño borra el linaje completo.

Notas de implementación de la Fase 6 (ADR 0007):

- Migraciones `0012_active_recall` (`recall_questions`, `recall_sessions`, `recall_answers`) y `0013_generation_fingerprints` (con sus `.down.sql`). RLS activo sin políticas, como el resto de tablas de negocio.
- `RecallQuestion`: `origin` es `ai` o `manual` (en la Fase 6 solo se generan con IA); la rúbrica debe tener al menos un concepto clave y un resumen no vacío (restricción `CHECK`). Las preguntas se archivan, no se borran.
- `RecallSession` no guarda la lista de preguntas: una respuesta se acepta si su pregunta es del dueño y de la página de la sesión (una pregunta archivada después de que la sesión la mostró sigue contando). `evaluation_status` solo deja `pending` cuando la sesión terminó; una sesión cerrada sin respuestas queda `done`.
- `RecallAnswer` tiene un único `(session_id, question_id)` y claves foráneas compuestas `(session_id, owner_id)` y `(question_id, owner_id)`. Agrega `evaluation_claimed_at` (no estaba en esta tabla): el instante en que una corrida de evaluación reclamó la respuesta; un reclamo de más de 6 minutos se retoma. Una restricción `CHECK` ata el estado a sus datos: `pending` sin puntajes; `done` con `ai_evaluation`, `ai_score` y `combined_quality`; `failed` con `ai_evaluation` (el intento crudo) y sin puntajes. Una respuesta saltada guarda el texto `(sin respuesta)`.
- `GenerationFingerprint` (tabla `generation_fingerprints`) es la memoria de la generación incremental (§3.1): una fila por párrafo ya enviado a la IA por técnica y página. `technique` y el formato de la huella (64 caracteres hexadecimales) se validan con `CHECK`; borrar la página o el dueño borra sus huellas. Cada módulo escribe solo las de su técnica, en la misma transacción que sus ítems.

Nota de implementación de la Fase 7 (ADR 0008): `Profile.timezone` ya se usa. Sin migración, el valor por defecto `UTC` significa "nunca elegida" y una elección explícita de UTC se guarda como `Etc/UTC`. La detección del navegador solo escribe mientras el valor sigue en `UTC`, así una elección explícita siempre gana. "Hoy", el calendario y el dashboard cuentan los días en esa zona.

### 6.2 Reglas de persistencia

- Postgres en Supabase. Esquema y migraciones con Drizzle. Nunca cambios manuales en producción.
- El servidor se conecta con la cadena de conexión de Supabase (pooler) y omite RLS; la autorización es explícita en `application`.
- RLS permanece activo en Storage y en cualquier acceso desde el cliente con `supabase-js`.
- `content` de página es JSON de Tiptap. `plain_text` se recalcula en cada guardado y es lo que consume la IA.
- Borrado lógico (`archived_at`) para cuadernos y páginas. Borrado físico solo por job de limpieza.

---

## 7. Especificación del motor de repetición espaciada

### 7.1 SM-2 por ítem

Entrada: calidad `q` entre 0 y 5. Estado: `easiness` (EF), `interval_days` (I), `repetitions` (n).

```
si q < 3:
    n = 0
    I = 1
si q >= 3:
    si n = 0: I = 1
    si n = 1: I = 6
    si n >= 2: I = redondear(I_anterior * EF)
    n = n + 1

EF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
EF = max(EF, 1.3)

due_at = ahora + I días
lapses += 1 si q < 3
```

Implementación como función pura `applySm2(state, quality, now) → newState`. Sin efectos secundarios. Cobertura 100 % con casos: primera revisión, segunda, tercera, fallo tras éxito, EF mínimo, q = 0 y q = 5 extremos.

### 7.2 Mapeo de calidad por técnica

| Técnica | Señal | `q` |
|---|---|---|
| Flashcards | Botón del estudiante | Otra vez 1, Difícil 3, Bien 4, Fácil 5 |
| Exámenes | Corrección determinista | Incorrecta 1, Correcta 4 |
| Recordación activa | Combinación IA + autoevaluación | Ver 7.4 |

Nota de implementación de la Fase 5 (ADR 0006): un examen se puede rendir en cualquier momento, aunque no haya nada vencido. Una respuesta incorrecta registra siempre q = 1 en el ítem de la raíz (vence al día siguiente, así la página aparece en "Hoy"). Una correcta registra q = 4 solo si el ítem estaba vencido; si no, no toca SM-2 (sin inflar intervalos con intentos repetidos). El cálculo vive en `study-engine` (`recordExamReviews`, `examReviewQualityFor`), que no conoce el módulo de exámenes; `gradeFlashcard` no cambia.

### 7.3 Nivel de dominio por página (v1)

```
para cada ítem activo de la página:
    estabilidad_i = min(1, interval_days_i / 21)
    acierto_i     = 1 si last_quality >= 3, si no 0
    aporte_i      = 0.6 * estabilidad_i + 0.4 * acierto_i

score = promedio(aporte_i)        # 0 si la página no tiene ítems

nivel:
    sin ítems        → "Nuevo"
    score < 0.35     → "Aprendiendo"
    score < 0.70     → "Consolidando"
    score >= 0.70    → "Dominado"
```

Es una fórmula v1. Se implementa como función pura, se prueba al 100 % y se ajusta por ADR con datos reales. El calendario ordena por `due_at` mínimo de los ítems de la página; el dashboard muestra `level` y `score`.

Notas de implementación de la Fase 4 (ADR 0005):

- Calificar exige que el ítem esté vencido: un ítem con `due_at` futuro (por ejemplo, un doble envío) se rechaza con `STUDY_ENGINE_ITEM_NOT_DUE` sin escribir, bajo bloqueo de fila del ítem.
- `PageMastery` se recalcula en la misma transacción de cada calificación y, además, una vez al día para todas las páginas en `/api/recompute-mastery` (Vercel Cron, 06:30 UTC, `CRON_SECRET`). El trabajo procesa primero las páginas más desactualizadas dentro de un presupuesto de 240 s, bloquea los ítems de cada página con un `lock_timeout` de 5 s y deja para la siguiente ejecución las páginas que no alcanzó o que fallaron.

### 7.4 Calidad combinada en recordación activa (v1)

```
ai_score      ∈ [0, 5]   (de la evaluación con rúbrica)
self_rating   ∈ [0, 5]   (0 = imposible, 5 = trivial)

combined = redondear(0.6 * ai_score + 0.4 * self_rating)

señal metacognitiva:
    self_rating >= 4 y ai_score <= 2  → exceso de confianza
    self_rating <= 1 y ai_score >= 4  → falta de confianza
```

Ninguna de las dos señales manda sola. Se registran las tres (cruda, autoevaluación, combinada).

Notas de implementación de la Fase 6 (ADR 0007):

- Se guardan la evaluación cruda (`ai_evaluation`), el puntaje de la IA, la autoevaluación y la calidad combinada. La señal metacognitiva no se guarda: se deriva al leer los resultados.
- Solo una respuesta evaluada (`done`) alimenta SM-2, con la calidad combinada, mediante `recordRecallReviews` de `study-engine` (`ReviewLog` con `session_kind = recall`). Calidad < 3 se registra aunque el ítem no esté vencido; ≥ 3, solo si está vencido. Una respuesta `failed` no registra repaso: su pregunta sigue vencida y vuelve en la próxima sesión.
- Una respuesta saltada recibe puntaje de IA 0 sin llamar al modelo, con el registro `{ source: "skipped", score: 0, justification: "Pregunta sin responder." }`.

Nota de implementación de la Fase 7 (ADR 0008): la tabla de calibración del dashboard reutiliza la misma regla (`calibrationOf`) sobre las respuestas evaluadas del período, agregada por página; tampoco se guarda.

### 7.5 Reprogramación y repetición de exámenes

```
al terminar un ExamSession:
    score = correct / total
    para cada respuesta: RecordReview(item de root_id, q = 4 si correcta, q = 1 si incorrecta)
    si score < 0.70:
        ExamPageState.retake_pending = true
        ExamPageState.failed_root_ids = raíces de las preguntas falladas
    si score >= 0.70:
        ExamPageState.retake_pending = false
        ExamPageState.failed_root_ids = []
        ExamPageState.last_passed_session_id = sesión actual
```

Repetición (decisión cerrada): el estudiante **nunca vuelve a ver la misma pregunta con la misma redacción**. Al iniciar un examen de repetición:

1. Para cada `root_id` en `failed_root_ids` se genera una **variante** con la IA (propósito `generate_exam_variants`): misma página, mismo `concept`, redacción, enfoque u opciones distintas. La variante se guarda con `variant_of` = pregunta anterior y `root_id` = raíz.
2. La pregunta anterior se marca `retired_at` para no volver a mostrarse.
3. La sesión de repetición contiene una variante por raíz fallada. Si son menos de 5, se completan con preguntas nuevas de la página hasta 5, para no hacer un examen trivial.
4. Las respuestas alimentan el `StudyItem` de la raíz, por lo que el historial SM-2 del concepto se conserva.
5. Si la generación de variantes falla en todos los proveedores, la repetición se bloquea con mensaje claro; no se reutiliza la pregunta original.

Las preguntas falladas vencen al día siguiente (q = 1), así la página aparece en "Hoy" con la acción "Repetir examen".

Notas de implementación de la Fase 5 (ADR 0006), que precisan los puntos anteriores:

- Al terminar, la calidad sigue §7.2 tal como la precisa la Fase 5: incorrecta → q = 1 siempre; correcta → q = 4 solo si el ítem estaba vencido. La sesión se cierra en una sola transacción: resultado, `ExamPageState` y repasos SM-2 se confirman o se revierten juntos.
- El punto 3 queda reemplazado: la repetición tiene N entre 10 y 30 (no "hasta 5"); las variantes de las raíces falladas van primero y el resto de la página completa hasta N.
- Generar las variantes cuesta **una** generación del límite diario (6) y solo si la generación tuvo éxito: un fallo no la consume. Si una raíz fallada ya tiene una variante activa que no se mostró, se reutiliza sin llamar a la IA.
- Callejones sin salida resueltos:
  - Si el estudiante retiró todas las preguntas de todas las raíces falladas, la repetición pendiente se borra (`retake_pending = false`, sin raíces falladas) y la página vuelve a tener un examen normal.
  - Si la repetición no se puede armar (menos de 10 raíces en la página, o N menor que los conceptos fallados que siguen en la página), se rechaza **antes** de llamar a la IA y sin consumir generaciones.
  - Las raíces falladas retiradas desde el examen se omiten; las demás se repiten.
- La variante se compara con todas las redacciones anteriores de su linaje (incluidas las retiradas), no solo con la inmediatamente anterior.

---

## 8. Capa de servicio de IA

### 8.1 Principios

1. Toda llamada pasa por `ai.application`. Ningún módulo importa el AI SDK directamente.
2. Toda salida es estructurada: `generateObject` con esquema Zod (AI SDK v7; `generateObject` figura como obsoleto a favor de `generateText` con `Output.object`, migración pendiente, ver ADR 0004). Si el proveedor no cumple el esquema, se reintenta una vez con otro proveedor; si falla, la operación se marca `failed` y el usuario ve un mensaje claro. Nunca se inventa un resultado.
3. Los prompts son versionados en código (`prompts/<purpose>/v1.ts`). Cada `AiGeneration` registra la versión usada.
4. Temperatura baja (≤ 0.3) para evaluación; moderada (≤ 0.7) para generación.
5. Todo se ejecuta dentro del presupuesto de una función de Vercel (máximo 300 segundos, con `maxDuration` explícito). Las tareas programadas usan Vercel Cron. (ADR 0003) Si una función se interrumpe a mitad de un trabajo, el estado persistido queda como estaba: en la importación de documentos (Fase 2), una consulta de estado reporta como `failed` (tiempo agotado) un trabajo no terminal sin escrituras desde hace `maxDuration` + 30 s, sin reescribir la fila ni reintentarlo; no existe un mecanismo de recuperación automática.

### 8.2 Registro de proveedores y rotación

```
ProviderRegistry (src/modules/ai/infrastructure/provider-registry.ts)
  ├── entradas: { id, model, capabilities, rpm, rpd, priority }
  │     solo las de proveedores con clave configurada
  ├── selectProvider(purpose) → primer proveedor sano con cuota disponible
  │     por capacidad, luego prioridad, luego cuota restante
  └── generateStructured → registra cada intento en AiGeneration;
        ante error o salida inválida reintenta una vez con el siguiente proveedor

Claves en Upstash Redis (prefijo REDIS_KEY_PREFIX: cogni:dev | cogni:prod):
  {prefijo}:ai:quota:{provider}:{yyyy-mm-dd}        contador diario, TTL 48 h
  {prefijo}:ai:quota:{provider}:{yyyy-mm-dd-hh-mm}  contador por minuto, TTL 120 s
  {prefijo}:ai:breaker:{provider}                   estado del breaker (JSON), TTL 1 h
  {prefijo}:ai:gen:*                                límite de generaciones por usuario (Upstash Ratelimit)
  {prefijo}:ai:eval:*                               límite de evaluaciones por usuario (Upstash Ratelimit, Fase 6)

Circuit breaker simple:
  3 fallos consecutivos → proveedor marcado no sano por 10 minutos
```

`{provider}` es el `id` de la entrada (por ejemplo `gemini-flash-lite`, `cloudflare-workers-ai`, `openrouter-qwen`, `openrouter-nemotron`). Con `AI_PROVIDER_MODE=fake` el registro contiene un único proveedor determinista y cuotas, breaker y límite viven en memoria (CI y e2e).

### 8.3 Rate limiting por usuario

Upstash Ratelimit con ventana fija de un día. Límite inicial implementado: 6 generaciones por usuario por día, configurable con `AI_DAILY_GENERATIONS` (antes 20, actualizado en la Fase 3). Se muestra al usuario como "Te quedan N generaciones hoy".

Límite de evaluaciones (implementado en la Fase 6, ADR 0007): 60 respuestas evaluadas por el modelo por usuario por día, configurable con `AI_DAILY_EVALUATIONS`, con su propio contador (`{prefijo}:ai:eval`), separado del de generaciones. Se consulta antes de cada llamada a `evaluate_recall_answer` y se consume solo cuando la evaluación termina bien; las respuestas saltadas no lo tocan. Con el límite agotado, la respuesta queda `failed` con el código `AI_DAILY_LIMIT_REACHED` y la hora de renovación (nunca queda pendiente); "Reintentar" la evalúa cuando se renueve la ventana. No se muestra un contador de evaluaciones en la interfaz.

### 8.4 Propósitos y esquemas

En la Fase 3 solo `generate_flashcards` está cableado de extremo a extremo (prompt `generate_flashcards/v1`); los demás propósitos tienen esquema Zod y tipo, pero ningún caso de uso los invoca todavía.

Nota de implementación de la Fase 5 (ADR 0006): quedan cableados `generate_exam_questions/v1` (recibe además las preguntas activas de la página para no duplicarlas), `generate_exam_variants/v1` (recibe el id de cada raíz fallada, su concepto, su respuesta correcta y todas sus redacciones anteriores) y `session_feedback/v2` (exámenes: hasta 10 preguntas falladas con concepto, enunciado, opción elegida, opción correcta y explicación, más el texto de la página dentro de `AI_PAGE_TOKEN_CAP`; `session_feedback/v1` sigue sirviendo a flashcards). Cada llamada al modelo pide como máximo 15 preguntas o variantes; una solicitud mayor se reparte en varias llamadas y sigue costando una sola generación.

Nota de implementación de la Fase 6 (ADR 0007): quedan cableados `generate_recall_questions/v1` (10 preguntas con rúbrica por llamada, temperatura 0,7; recibe además hasta 60 preguntas activas de la página para no repetirlas) y `evaluate_recall_answer/v1` (escala 0–5 explícita, fragmento y respuesta enviados como datos delimitados, justificación en español con "tú", nunca inventa contenido, temperatura 0,2). Con la generación incremental (§3.1), el `plain_text` que reciben los propósitos de generación son solo los párrafos nuevos o editados de la página, recortados a `AI_PAGE_TOKEN_CAP`. No se usa `session_feedback` para recordación activa.

| Propósito | Entrada | Salida (Zod) |
|---|---|---|
| `generate_flashcards` | `plain_text`, cantidad | `{ cards: [{ front, back }] }` |
| `generate_exam_questions` | `plain_text`, cantidad | `{ questions: [{ stem, options[4], correctIndex, explanation, concept }] }` |
| `generate_exam_variants` | `plain_text`, lista de preguntas falladas (`stem`, `concept`, `explanation`) | `{ variants: [{ forRootId, stem, options[4], correctIndex, explanation }] }` — misma idea evaluada, redacción y enfoque distintos |
| `generate_recall_questions` | `plain_text`, cantidad | `{ questions: [{ prompt, rubric: { keyConcepts[], acceptableAnswerSummary } }] }` |
| `evaluate_recall_answer` | pregunta, rúbrica, fragmento relevante, respuesta | `{ score: 0-5, presentConcepts[], missingConcepts[], misconceptions[], justification }` |
| `session_feedback` | técnica, resultados de la sesión | `{ summary, strengths[], toReinforce[], nextStepSuggestion }` |

### 8.5 Riesgos específicos de recordación activa (registro obligatorio)

- La evaluación de texto libre no es determinista. Mitigación: rúbrica explícita, esquema estricto, temperatura baja, fragmento de página como contexto, registro de la evaluación cruda para auditoría.
- Un modelo puede puntuar mal. Mitigación: la calificación final combina la autoevaluación; el estudiante ve la justificación y puede marcar "no estoy de acuerdo" (se registra, no cambia el puntaje en v1).
- Un proveedor puede caer a mitad de sesión. Mitigación: las respuestas se guardan primero; la evaluación es asíncrona y se reintenta con otro proveedor; la retroalimentación se muestra cuando todas las evaluaciones terminan.
- Contenido de página muy largo. Mitigación implementada en la Fase 3 para la generación: se conserva el inicio del texto hasta el tope `AI_PAGE_TOKEN_CAP` (12.000 por defecto, estimación por palabras) y la interfaz avisa cuántas palabras se usaron; no hay selector de sección ni división en partes. Para recordación activa (Fase 6): se recorta `plain_text` a la ventana del modelo, priorizando el fragmento más similar a la pregunta (búsqueda léxica simple en v1; embeddings quedan fuera de alcance).

Notas de implementación de la Fase 6 (ADR 0007):

- **Selección del fragmento** (`selectRelevantFragment`). Si la página cabe en `AI_PAGE_TOKEN_CAP` se envía completa. Si no, se divide en oraciones (terminan en `.`, `!`, `?`, `…` o salto de línea; una oración más larga que el tope se corta en trozos del tope), cada oración suma cuántas de sus palabras son términos de la pregunta o de los conceptos clave de la rúbrica (en minúsculas, sin acentos ni puntuación, sin palabras vacías ni de menos de tres letras), y se envía el tramo continuo de oraciones que cabe en el tope con mayor puntaje (el primero, si empatan). Sin ninguna coincidencia se conserva el inicio de la página. Si la página no se puede leer, el fragmento va vacío.
- **Proveedor caído a mitad de sesión.** Las respuestas ya están guardadas; cada una se evalúa con reintento en otro proveedor (§8.1). Si fallan los dos, la respuesta queda `failed` con el intento crudo, sin calidad combinada ni repaso SM-2, la sesión queda `partial` y la vista de resultados ofrece "Reintentar". La retroalimentación se muestra cuando todas las evaluaciones terminaron (bien o mal).
- **Sin cola durable.** La evaluación corre con `after()` dentro de `maxDuration = 300` (ADR 0003). Un reclamo de más de 6 minutos se retoma, y la consulta de resultados vuelve a programar una evaluación cuando ninguna corrida viva tiene las respuestas pendientes.

---

## 9. Seguridad y autorización

- Autenticación con Supabase Auth: correo/contraseña con verificación y Google OAuth. Sesión por cookies gestionadas por `@supabase/ssr`.
- Aceptación de los términos de uso: toda cuenta (correo o Google, nueva o existente) debe aceptar la versión vigente de los términos (`TERMS_VERSION`, una fecha) antes de usar la aplicación. El layout autenticado redirige a `/terminos` a quien no la haya aceptado; la página es pública y, con sesión pendiente, muestra la casilla de aceptación (mayoría de edad y términos). La versión y la fecha quedan en `profiles`; al publicar una versión nueva se vuelve a pedir a todos.
- Toda Server Action y route handler valida sesión y valida entrada con Zod antes de tocar `application`.
- Autorización por propiedad: cada caso de uso recibe `ownerId` de la sesión y filtra por él. No existe acceso entre usuarios.
- Storage: buckets privados con políticas RLS por `owner_id`. URLs firmadas de corta duración.
- Importación de documentos (ADR 0009): formato detectado por los bytes reales, revisión del ZIP antes de analizar (entradas, tamaños declarados y razón de compresión) con inflado acotado, PDF de hasta 300 páginas, extracción contra el presupuesto de tiempo, topes de imágenes, límites por usuario (20 subidas y 10 inicios por hora, 3 importaciones activas), texto oculto de Word fuera de `plain_text`, títulos saneados y estado de importación que no revela páginas de otros usuarios.
- Variables de entorno validadas al arranque con Zod (`shared/config`). Ninguna clave de proveedor llega al cliente.
- Cabeceras de seguridad configuradas en `next.config` (CSP básica, HSTS lo maneja Vercel).
- Dependencias auditadas en CI (`pnpm audit --audit-level=high`).

---

## 10. Entornos, CI/CD y operación

### 10.1 Entornos

| Entorno | Base de datos | IA | Deploy |
|---|---|---|---|
| Local | Supabase CLI (`supabase start`) | Claves personales, proveedores reales con cuota baja | `pnpm dev` |
| Preview | Proyecto Supabase de desarrollo | Igual que local | Vercel preview por rama |
| Producción | Proyecto Supabase de producción | Claves de producción | Vercel desde `main` |

Nota: el plan free de Supabase permite 2 proyectos activos. Desarrollo y producción son los dos.

### 10.2 Pipeline

```
PR abierta
  → GitHub Actions: pnpm install --frozen-lockfile → biome ci → tsc --noEmit → vitest run → pnpm audit
  → Vercel preview
Merge a main
  → GitHub Actions: lo anterior + playwright (contra preview)
  → Vercel producción
  → drizzle migrate (paso explícito en el workflow, antes del deploy)
```

### 10.3 Operación de costo cero

- Keep-alive: Vercel Cron diario (`vercel.json` → `/api/keep-alive`, protegido con `CRON_SECRET`) que ejecuta `select 1` contra Supabase de producción.
- Job diario de vencimientos: recalcula `PageMastery` y materializa la vista "Hoy".
- Alertas: Sentry a correo. PostHog con eventos: `page_created`, `document_imported` (`pdf_imported` hasta el ADR 0009), `generation_requested`, `session_started`, `session_finished`, `item_rated`.
- Presupuesto vigilado: la generación por lotes se trocea en unidades que quepan en los 300 s de una función; si el uso de funciones de Vercel se acerca al límite del plan Hobby, se reducen los lotes.

---

## 11. Sistema de diseño y UI

- Fuente de verdad visual: `docs/design-system/` (copia versionada de la guía creada por el autor, renombrada a Cogni). Se aplica como tokens en `app/globals.css` con `@theme` de Tailwind y en la configuración de shadcn/ui.
- Identidad: lienzo gris cálido `#EDEAE4`, superficies blancas, acento violeta `#7C3AED`, botón primario casi negro `#1C1917`, DM Sans para texto y JetBrains Mono para código, radios generosos (tarjetas 16 px, área de contenido 20 px), sombras muy sutiles, íconos Lucide.
- Paleta de resaltado del editor: la paleta pastel del design system (rosa, verde, amarillo, violeta, naranja, azul, menta), cada una con su variante de texto accesible.
- Copy de interfaz: español, "tú", oración en minúscula inicial salvo nombres propios, sin emoji salvo íconos de cuaderno elegidos por el usuario.
- Accesibilidad objetivo: WCAG 2.1 AA, objetivos táctiles de 44 px, `prefers-reduced-motion` respetado.
- Las pantallas de referencia en `docs/design-system/ui_kits/` son guía estética, no contrato. Cualquier contradicción con este documento se resuelve a favor de este documento.
- La iteración visual de las pantallas de flashcards, exámenes, recordación activa y dashboard está integrada en `main` como vistas previas ocultas en producción, con datos de muestra locales a cada ruta (`requireDesignPreviews()` en `src/shared/config/design-previews.ts`; visibles en desarrollo o con `COGNI_DESIGN_PREVIEWS=1`). Sus capas de dominio y aplicación siguen vacías: las Fases 4 a 7 reemplazan los datos de muestra por puertos de aplicación reales. Si una pantalla y este documento se contradicen, prevalece este documento.
- Se creará una skill de diseño para el agente (`cogni-design`) que apunte a esta carpeta, registrada en el registro de skills de gentle-ai.

---

## 12. Convenciones

| Tema | Regla |
|---|---|
| Idioma del código | Inglés: identificadores, nombres de archivos, mensajes de commit. |
| Comentarios en código | Inglés simple (nivel B1). Frases cortas, sin jerga innecesaria. |
| Interfaz de usuario | Español, "tú". |
| Documentación técnica | Español neutro profesional. |
| Commits | Conventional Commits: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`. Sin atribución a IA. |
| Ramas | `main` protegida. `feat/<change>`, `fix/<tema>`. Una rama por change o feature. |
| PRs | Máximo 400 líneas netas; si crece, se divide en PRs encadenadas. |
| Nombres de módulos | kebab-case en carpetas, PascalCase en tipos, camelCase en funciones. |
| Errores | `Result<T, DomainError>` en dominio y aplicación. Excepciones solo en infraestructura, traducidas en el borde. |
| Fechas | UTC en base de datos. Zona horaria del usuario solo en presentación. |
| IDs | UUID v7 generados en aplicación. |

---

## 13. Fases de construcción

Las Fases 0 y 1 se construyeron como changes SDD de gentle-ai (artefactos archivados en `openspec/`); desde 2026-09-22 cada fase se construye con ODD (ver §15). Una fase se considera terminada solo cuando está desplegada en producción y cumple su criterio de "hecho".

### Fase 0 — Cimientos

Entregables: repositorio con estructura de 5.4, Next.js + TypeScript estricto, Tailwind + shadcn/ui con tokens Cogni, Supabase (Auth con correo y Google, Storage), Drizzle con migración inicial (`profiles`), Biome, Vitest, Playwright, GitHub Actions, Sentry, PostHog, dominio comprado en Cloudflare y apuntado a Vercel, `sdd init` ejecutado.
Hecho cuando: un usuario se registra, verifica correo, inicia sesión con Google y ve el shell vacío en el dominio de producción. CI verde.

### Fase 1 — Cuadernos y editor

Entregables: CRUD de cuadernos y páginas, sidebar, editor Tiptap con todos los bloques de 3.2, menú `/`, resaltados con paleta Cogni, imágenes a Storage, autoguardado optimista, `plain_text` materializado.
Hecho cuando: un usuario toma apuntes completos de una clase sin salir de Cogni y los recupera al volver a entrar.

### Fase 2 — Importación de PDF

> **Implementada y fusionada en `main` el 2026-09-23**, construida con ODD. El procesamiento es síncrono dentro de una Server Action acotada por `maxDuration` (ADR 0003), sin Trigger.dev. El diferimiento del 2026-09-22 (ADR 0002) quedó revertido al reinstaurarse la fase.

Entregables: subida a Storage, `ImportJob`, procesamiento síncrono con unpdf en una Server Action acotada por `maxDuration`, conversión de texto a bloques (títulos por heurística, párrafos, listas), estado de progreso en UI, manejo de PDF sin texto.
Hecho cuando: un PDF de 30 páginas con capa de texto termina como página editable en menos de 60 segundos.

> **Ampliada el 2026-10-26 (ADR 0009, rama `feat/document-import`).** La importación admite Word (`.docx`) además de PDF, con mammoth y officeparser, imágenes importadas y un catálogo estricto de contenido. PowerPoint (`.pptx`) se sumó el mismo día con officeparser (T7), y el PDF pasó también a officeparser (T8), con `textToBlocks` solo como respaldo para documentos de solo párrafos; `unpdf` se retiró. La decisión sobre OCR queda pendiente.

### Fase 3 — Capa de IA

> **Implementada el 2026-10-04 en seis PR apiladas (#63–#66 y las dos siguientes), construida con ODD.** Decisiones en `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.

Entregables: `ProviderRegistry`, rotación por cuota con Upstash, circuit breaker, rate limiting por usuario, prompts versionados, `AiGeneration`, primer caso de uso real: `generate_flashcards` desde una página (sin sesiones de repaso todavía; solo generación y listado).
Hecho cuando: con la cuota de un proveedor agotada artificialmente, la generación sigue funcionando con el siguiente y el registro lo evidencia.

Estado (actualizado en la Fase 3):

- Entregado: registro de proveedores, rotación por cuota, circuit breaker, límite de 6 generaciones por usuario por día, prompts versionados (`generate_flashcards/v1`), entidad `AiGeneration` (tabla `ai_generations`), generación y listado de flashcards (tabla `flashcards`), interfaz en el panel de técnicas de la página y rutas `/flashcards`, modo `AI_PROVIDER_MODE=fake` para CI y e2e.
- Pendiente: ejecución manual de `scripts/ai-smoke.mts` con claves reales y cuota agotada artificialmente (criterio de "hecho"); migración de `generateObject` a `generateText` con `Output.object`.

### Fase 4 — Motor de repetición espaciada y Flashcards

> **Implementada el 2026-10-04 en siete PR apiladas (#71–#76 y la de cierre), construida con ODD.** Decisiones en `docs/adr/0005-motor-de-repeticion-y-flashcards.md`.

Entregables: `applySm2` y `computeMastery` con TDD al 100 %, `StudyItem`, `ReviewLog`, `PageMastery`, flashcards manuales, sesión de repaso con 4 botones, retroalimentación de sesión con IA, vista mínima "Repasos de hoy", job diario.
Hecho cuando: un usuario repasa durante 3 días simulados y los intervalos coinciden exactamente con SM-2 en los tests y en producción.

Estado (actualizado en la Fase 4):

- Entregado: `applySm2` y `computeMastery` con cobertura del 100 %; migración `0009_study_engine` (`study_items`, `review_logs`, `page_mastery`, `flashcard_sessions`, `session_feedback`, `flashcards.archived_at`, con ítems rellenados para las tarjetas existentes); flashcards manuales ("Nueva tarjeta") y archivado sin dejar mazos vacíos; sesión de repaso en la página del mazo con los cuatro botones y bloqueo contra doble calificación; retroalimentación con IA (`session_feedback/v1`) al cerrar la sesión; vista "Repasos de hoy" en `/flashcards` (módulo `scheduling`) con conteos reales de vencidas por mazo; trabajo diario `/api/recompute-mastery`. La prueba de integración con reloj inyectado reproduce los días 0, 1 y 2 y la tercera revisión el día 7 (intervalos 1, 6 y 16; EF 2,46).
- Pendiente: el inicio automático de `?repasar=1` es por instancia de `DeckReview` (no se dispara en una navegación del cliente sin volver a montar, y el parámetro queda en la URL si no hay nada que repasar); el contrato del lector de "Repasos de hoy" no prueba el desempate con igual `earliestDueAt`; `isAuthorized` duplicado entre `/api/keep-alive` y `/api/recompute-mastery`; la sesión multipágina no tiene entrada en la interfaz; las sesiones abandonadas quedan abiertas; el trabajo diario recalcula páginas archivadas; el registro "destination stream closed early" en los e2e. Detalle en ADR 0005.

### Fase 5 — Exámenes

> **Implementada el 2026-10-06 en ocho PR apiladas (#78–#85) más la de cierre, construida con ODD.** Decisiones en `docs/adr/0006-examenes-y-repeticion-con-variantes.md`.

Entregables: generación y edición manual de preguntas con `concept`, sesión de examen, corrección, alimentación del motor, `ExamPageState`, reprogramación por nota < 70 %, repetición con variantes generadas por IA (7.5), retroalimentación con IA.
Hecho cuando: fallar un examen hace aparecer la página en "Hoy" al día siguiente, y al repetirlo el estudiante recibe preguntas distintas sobre los mismos conceptos fallados.

Estado (actualizado en la Fase 5):

- Entregado: dominio puro con cobertura del 100 % (`scoreExam`, `composeExam`, `composeRetake`, `examQualityFor`, `decideFeedback`); migraciones `0010_exams` y `0011_exam_session_questions`; caso de uso del motor `recordExamReviews`; preguntas manuales (crear, editar en el lugar, retirar); generación con IA (`generate_exam_questions/v1`) desde el panel de técnicas; sesión con selector de N (10–30), cronómetro, corrección pregunta a pregunta y resultados con nota y tiempo total; repetición con variantes (`generate_exam_variants/v1`); retroalimentación (`session_feedback/v2`) con reutilización tras una aprobación; "Repasar contenido" con aviso de conceptos fallados en la página; `/exams` y la vista por cuaderno con datos reales, con las preguntas vencidas hoy de cada página (leídas de la lista "Hoy" de `scheduling`: "Vence hoy" y "Rendir examen") y "Repetir examen" en las páginas con repetición pendiente; "Exámenes" habilitado en la barra lateral. Un e2e recorre fallar, volver a la página y repetir con preguntas reformuladas.
- Pendiente: "Repasos de hoy" en `/flashcards` sigue listando solo flashcards; la vista "Hoy" con todas las técnicas llega en la Fase 7. La vista por cuaderno lee todo el listado de exámenes y luego filtra; unas 10 idas y vueltas a la base por respuesta; la diferencia visual de las pantallas de exámenes y flashcards con el sistema de diseño queda para la Fase 8; el e2e del criterio de "hecho" no inyecta un reloj del día siguiente (lo cubren las pruebas de base de datos y de casos de uso). Detalle en ADR 0006.

### Fase 6 — Recordación activa

> **Implementada el 2026-10-08 en siete PR apiladas (#87–#93) más la de cierre, construida con ODD.** Decisiones en `docs/adr/0007-recordacion-activa-y-generacion-incremental.md`.

Entregables: generación de preguntas abiertas con rúbrica, sesión con respuesta escrita y autoevaluación, evaluación asíncrona con esquema, calidad combinada, retroalimentación al final, registro de señales metacognitivas.
Hecho cuando: una sesión completa funciona aunque un proveedor falle a mitad, y cada respuesta conserva su evaluación cruda.

Estado (actualizado en la Fase 6):

- Entregado: dominio puro con cobertura del 100 % (`combinedQuality`, `calibrationOf`, `composeRecallSession`, `sessionEvaluationStatus`, `selectRelevantFragment`, `sessionScore`); migraciones `0012_active_recall` y `0013_generation_fingerprints`; caso de uso del motor `recordRecallReviews`; generación con IA (`generate_recall_questions/v1`); sesión de 10 preguntas con cada respuesta guardada al darla; evaluación asíncrona (`evaluate_recall_answer/v1`) con `after()`, reclamo con plazo de 6 minutos, sondeo acotado y "Reintentar"; límite de 60 evaluaciones por usuario por día (`AI_DAILY_EVALUATIONS`); resultados con calidad combinada, calibración, puntaje y justificación por pregunta y "No estoy de acuerdo"; generación incremental por huellas de párrafo en flashcards, exámenes y recordación activa; panel "Técnicas de estudio" al estilo NotebookLM Studio con la lista "Generado en esta página"; "Crear examen" en el hub de exámenes; `/active-recall` y la vista por cuaderno con datos reales, contador de preguntas vencidas hoy por cuaderno y resultados de la sesión más reciente; "Active recall" habilitado en la barra lateral. Un e2e recorre una sesión con un proveedor que falla a mitad: la sesión termina, la respuesta fallida conserva su intento crudo y "Reintentar" la evalúa.
- Pendiente: "Repasos de hoy" en `/flashcards` sigue listando solo flashcards (la vista "Hoy" completa llega en la Fase 7); los resultados de sesiones de recordación anteriores a la más reciente no tienen entrada en la interfaz y el flujo entre hub, resultados y sesión se revisa en la Fase 8; ante un error que no se cura, el aviso de resultados ofrece un "Reintentar" que no ayuda; en páginas generadas antes de la fase, flashcards puede repetir tarjetas una vez; el final de un párrafo más largo que el tope nunca se envía; los mensajes de error de exámenes están duplicados entre el panel y "Crear examen"; la prueba "across batches" de `drizzle-studied-page-reader` agota su tiempo en la base compartida; la documentación técnica de las Fases 3 a 5 está sin actualizar; acelerar la integración continua queda para después de la Fase 8. Detalle en ADR 0007.

### Fase 7 — Calendario y Dashboard

> **Implementada el 2026-10-14 en cinco PR apiladas (#95–#99) más la de cierre, construida con ODD.** Decisiones en `docs/adr/0008-calendario-y-dashboard.md`.

Entregables: calendario mensual y semanal, vista "Hoy" completa, dashboard con progreso por cuaderno y página, métricas por técnica, calibración metacognitiva, gráficos shadcn.
Hecho cuando: el usuario puede responder "qué estudio hoy" y "cómo voy" sin abrir ninguna página.

Estado (actualizado en la Fase 7):

- Entregado: `/calendario` con las pestañas "Hoy", "Semana" y "Mes" sobre datos reales (próximo vencimiento de cada ítem, lo vencido en hoy, chips coloreados por técnica que abren su sesión o su página); la tarjeta "Repasos pendientes hoy" del inicio con el total real; `/configuracion` con la zona horaria del perfil y su detección en el primer uso; módulo `analytics` (dominio puro con cobertura del 100 %, lectores de solo lectura, `getProgress`, `getTechniqueMetrics`, `getCalibration`, API de servidor y acciones); `/dashboard` sobre datos reales con progreso por cuaderno y página, tasa de acierto, racha y repasos completados por técnica, calibración de recordación activa y gráficos shadcn, sin datos de muestra ni barrera de vista previa; "Calendario", "Configuración" y "Dashboard" habilitados en la barra lateral. Sin migraciones. Pruebas e2e del calendario, la zona horaria y el dashboard.
- Pendiente: instantáneas semanales de dominio para mostrar variaciones de "Dominio global", "Páginas dominadas", "Ítems vencidos" y la tendencia por cuaderno; unificar "Active recall" / "Recordación activa" y plegar la barra lateral en teléfonos (Fase 8); pruebas de las acciones de `analytics` con campos de tipo incorrecto; varias pruebas de base de datos agotan su tiempo de 5 s con la base compartida bajo carga; la documentación técnica de las Fases 3 a 5 está sin actualizar. Detalle en ADR 0008.

### Fase 8 — Diseño y flujos de pantalla

> Fase de solo interfaz, decidida el 2026-10-05. Se ejecuta justo después de la Fase 7.

Entregables: revisión y mejora de la UI/UX de todas las pantallas construidas en las fases anteriores, flujos de navegación coherentes entre cuadernos, páginas, técnicas, "Hoy", calendario y dashboard, consistencia con el sistema de diseño (`docs/design-system/`) y con los átomos de `src/shared/ui`, verificación visual en navegador y pruebas e2e de los flujos.
Restricción: **no se modifica la lógica de backend**. Quedan fuera los cambios de dominio, casos de uso, infraestructura, esquema y migraciones; las pantallas componen los casos de uso y acciones existentes. Cualquier necesidad de backend detectada se registra como pendiente para una fase posterior.
Hecho cuando: cada flujo principal (tomar apuntes, generar y repasar cada técnica, revisar "Hoy" y el progreso) se recorre sin pasos ambiguos ni callejones sin salida, y las pantallas coinciden con el sistema de diseño.

### Fase 9 — Endurecimiento

Entregables: Better Stack con log drain, revisión de límites y cuotas, pruebas de carga ligeras, auditoría de accesibilidad, manual de usuario, documentación final y diagramas con archify, entregables académicos.
Hecho cuando: la plataforma se publica para uso abierto.

### Próximamente

No hay fases diferidas por ahora. Una fase diferida por ADR se listaría aquí con su fecha, su ADR y el estado de su planificación.

---

## 14. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Tiers gratuitos de IA cambian o desaparecen | Alta | Alto | Rotación multi-proveedor, registro configurable sin deploy, degradación a "sin IA" con mensaje claro |
| Supabase pausa el proyecto | Media | Alto | Keep-alive diario; upgrade a Pro como primer gasto |
| Vercel Hobby considerado uso comercial | Baja | Alto | Producto sin monetización; documentado en 4.2 |
| Evaluación de IA inconsistente en recordación activa | Alta | Medio | Sección 8.5 completa |
| Editor Tiptap: complejidad de bloques personalizados | Media | Medio | Extensiones oficiales primero; bloques propios solo para lo diferencial |
| Alcance crece a mitad de fase | Alta | Alto | Sección 1.2 y este documento; cambios solo por ADR |
| Una sola persona desarrollando | Cierta | Medio | Fases chicas, ODD con tareas rastreadas, TDD en dominio, CI estricta |

---

## 15. Flujo de trabajo con gentle-ai

1. Las Fases 0 y 1 se construyeron con SDD: `sdd init` bootstrapeó el contexto y cada entregable fue un change (`sdd new` → exploración → propuesta → spec → diseño → tareas → apply → verify → archive). Sus artefactos archivados están en `openspec/`.
2. Desde 2026-09-22 el flujo activo es Organic Driven Development (ODD): un documento de feature en `odd/tasks/` con tareas rastreadas, TDD estricto, commits por unidad de trabajo, PRs pequeñas encadenadas y revisión nativa (RDD) por porción. SDD sigue disponible cuando se elige explícitamente.
3. Este documento se pasa como contexto a cada fase de exploración. Las specs y los documentos de feature no lo contradicen; si necesitan hacerlo, primero un ADR.
4. `sdd-research` se ejecuta en Fase 3 (proveedores de IA y límites vigentes) y en Fase 4 (evidencia de SM-2 y ciencia cognitiva).
5. Las decisiones de arquitectura se registran como ADR en `docs/adr/` con el formato `NNNN-titulo.md`.
6. Solo se usan herramientas y skills provistas por gentle-ai y las skills propias del proyecto (`cogni-design`). No se usan skills externas instaladas en el cliente.
7. Modo TDD estricto habilitado.

---

## 16. Glosario

| Término | Definición |
|---|---|
| Cuaderno | Agrupación de páginas de un usuario. Sin semántica de estudio. |
| Página | Unidad de estudio. Contiene el documento y sus ítems. |
| Ítem | Cualquier flashcard, pregunta de examen o pregunta abierta con estado SM-2. |
| Motor | Módulo `study-engine`. Único responsable de fechas de repaso y dominio. |
| Nivel de dominio | Enum Nuevo / Aprendiendo / Consolidando / Dominado derivado de los ítems de una página. |
| Sesión | Una ejecución de una técnica sobre una página. |
| Calidad (q) | Entero 0–5 que alimenta SM-2. |
| Generación | Una llamada a la capa de IA con propósito y esquema definidos. |

---

## 17. Referencias

- Roediger, H. L., y Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science*, 17(3).
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., y Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest*, 14(1).
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., y Rohrer, D. (2006). Distributed practice in verbal recall tasks. *Psychological Bulletin*, 132(3).
- Bjork, E. L., y Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning.
- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science*, 12(2).
- Wozniak, P. A. (1990). Optimization of learning. Algoritmo SM-2, SuperMemo.
- Documentación de Vercel AI SDK, Tiptap, Drizzle ORM, Supabase, Vercel Functions y Cron, Upstash (consultar versión vigente al iniciar cada fase).
