# Documentos legales de Cogni

- **Versión del conjunto:** 1.0 (borrador para revisión)
- **Fecha de corte de la investigación:** 28 de octubre de 2026
- **Responsable:** [PENDIENTE: nombre completo]
- **Rama:** `docs/legal-framework` (feature ODD `legal-framework`, `odd/tasks/legal-framework.md`); publicación en la aplicación: `feat/legal-consent` (`odd/tasks/legal-consent.md`)

> **En resumen**
>
> - Esta carpeta contiene el capítulo "Marco legal" de la tesis, el modelo de términos institucionales y la matriz de cumplimiento. Los documentos públicos viven en `src/content/legal/`, que es la fuente autorizada de las páginas `/legal/*` (sección 2).
> - Todos están redactados según el estado real de la plataforma al 28 de octubre de 2026. Las páginas públicas y el aviso de aceptación en el registro ya están en código, marcados como borrador; todavía no se han desplegado.
> - Antes del lanzamiento hay que completar los datos marcados como `[PENDIENTE: …]`, resolver las brechas de prioridad alta de la matriz y **pedir la revisión de un abogado**. Estos documentos no constituyen asesoría jurídica.

## 1. Índice

| Documento | Propósito | Público | Pie de página | Estado |
|---|---|---|---|---|
| [marco-legal.md](marco-legal.md) | Capítulo de tesis: normas aplicables y de referencia, análisis y conclusiones, con citas APA 7 | Jurado y lectores de la tesis | No | Revisado; puntos pendientes de verificación marcados |
| [terminos-y-condiciones.md](../../src/content/legal/terminos-y-condiciones.md) | Contrato de uso con las personas usuarias | Público | Sí | Borrador; publicado en código en `/legal/terminos` |
| [politica-de-tratamiento-de-datos.md](../../src/content/legal/politica-de-tratamiento-de-datos.md) | Política exigida por la Ley 1581 de 2012 y el DUR 1074 de 2015 | Público | Sí | Borrador |
| [aviso-de-privacidad.md](../../src/content/legal/aviso-de-privacidad.md) | Aviso breve para mostrar junto a la autorización en el registro | Público | Sí (y en el registro) | Borrador |
| [politica-de-cookies.md](../../src/content/legal/politica-de-cookies.md) | Cookies y almacenamiento reales, categorías y cómo desactivarlos | Público | Sí | Borrador |
| [politica-de-uso-aceptable-e-ia.md](../../src/content/legal/politica-de-uso-aceptable-e-ia.md) | Usos prohibidos, políticas de los proveedores de IA incorporadas, aviso de transparencia, riesgos y atribuciones | Público | Sí | Borrador |
| [codigo-de-integridad-academica.md](../../src/content/legal/codigo-de-integridad-academica.md) | Reglas de uso honesto de la IA para estudiar | Público | Sí | Borrador |
| [politica-de-derechos-de-autor.md](../../src/content/legal/politica-de-derechos-de-autor.md) | Notificación y retiro, contranotificación e infractores reiterados | Público | Sí | Borrador |
| [subencargados.md](../../src/content/legal/subencargados.md) | Proveedores que tratan datos, país, rol y estado de su contrato | Público | Sí | Borrador; con contratos pendientes |
| [terminos-institucionales.md](terminos-institucionales.md) | Modelo para universidades y organizaciones, con anexo de tratamiento de datos | Instituciones | No (a solicitud) | Modelo para negociación |
| [matriz-de-cumplimiento.md](matriz-de-cumplimiento.md) | Requisito, norma, estado, brecha, acción y prioridad, con seguimientos de código y operación | Interno | No | Vigente a la fecha de corte |

Enlaces sugeridos para el pie de página: Términos y condiciones (`/legal/terminos`) · Política de privacidad (`/legal/privacidad`) · Cookies (`/legal/privacidad#cookies`) · Uso aceptable e IA (`/legal/uso-aceptable`) · Derechos de autor (`/legal/derechos-de-autor`). La lista de subencargados no va en el pie de página: es una sección de la política de privacidad.

## 2. Publicación y consentimiento

### 2.1 Fuente autorizada

Los ocho documentos públicos están en `src/content/legal/*.md`. Esos archivos son la **fuente autorizada**: las páginas de la aplicación los leen y los muestran tal cual. Se movieron desde esta carpeta el 28 de octubre de 2026 sin cambiar su redacción; solo cambiaron los enlaces internos, que ahora apuntan a las rutas y anclas de abajo. Para cambiar un documento:

1. Edita el archivo en `src/content/legal/`.
2. Si cambia el sentido de los términos o de la política, sube `TERMS_VERSION` en `src/modules/identity/domain/terms.ts`, para que cada cuenta acepte de nuevo.
3. Conserva la versión anterior en el historial de git.

### 2.2 Páginas

| Ruta | Contenido | Anclas |
|---|---|---|
| `/legal/terminos` | Términos y condiciones | Una por cláusula |
| `/legal/privacidad` | Política de tratamiento de datos; después de su sección 10, la lista de subencargados; al final, el aviso de privacidad y la política de cookies | `#subencargados`, `#aviso-de-privacidad`, `#cookies` |
| `/legal/uso-aceptable` | Política de uso aceptable y de IA y, al final, el código de integridad académica | `#integridad-academica` |
| `/legal/derechos-de-autor` | Política de derechos de autor | Una por sección |

Cada página muestra la versión, la fecha de vigencia, el aviso "Borrador — pendiente de completar datos y de revisión legal", un índice lateral de secciones y enlaces a las demás páginas. Cada `[PENDIENTE: …]` aparece resaltado. Las páginas son públicas, con o sin sesión.

### 2.3 Patrón de consentimiento

- **Aviso junto al botón (*sign-in-wrap*), sin casilla** (decisión del usuario del 28 de octubre de 2026). En `/register`, entre "Crear cuenta" y "Continuar con Google": "Al crear tu cuenta o continuar con Google, aceptas los Términos y condiciones, autorizas el tratamiento de tus datos según la Política de privacidad y confirmas que eres mayor de 18 años." En `/login`, después de "Continuar con Google", la misma frase empieza por "Si continúas con Google y aún no tienes cuenta, aceptas…".
- **Prueba en el servidor, antes de que exista la cuenta.**
  - Registro por correo: la versión y la hora del servidor viajan como metadatos de la cuenta en Supabase.
  - Google: una cookie *httpOnly* de 10 minutos guarda la versión y la hora antes de redirigir.
  - En `/auth/callback` se copian al perfil (`terms_accepted_version`, `terms_accepted_at`, `terms_accepted_method`) solo si la cuenta se acaba de crear y el perfil no tiene una aceptación. La hora guardada es la del consentimiento, no la del primer ingreso.
- **Respaldo.** La página `/terminos` sigue pidiendo la aceptación con una casilla a las cuentas sin aceptación registrada y a todas las cuentas cuando sube `TERMS_VERSION` (pasó a `2026-10-28`). En ese caso el método guardado es `gate`.
- **Riesgo.** Es una conducta inequívoca (Decreto 1074 de 2015, art. 2.2.2.25.2.4), pero no hay jurisprudencia verificada sobre esta modalidad. Las cláusulas 2.1 de los términos y 8.1 de la política ya describen el aviso junto al botón: la aceptación y la autorización se dan al pulsar «Crear cuenta» o «Continuar con Google». Ver la fila D21 de la [matriz](matriz-de-cumplimiento.md).
- **Alternativa no elegida.** Una tabla de consentimientos de solo inserción (una fila por aceptación, con resumen del texto y agente de usuario) daría una prueba más completa. Se eligió una columna para mantener el cambio pequeño; queda en la fila D4 de la matriz.

## 3. Decisiones que reflejan estos documentos

- Solo personas de 18 años o más; sin menores ni consentimiento parental (decisión del 28 de octubre de 2026).
- Servicio dirigido a personas en Colombia; no disponible en el Espacio Económico Europeo, el Reino Unido ni Suiza.
- Responsable: persona natural en Colombia. Ley aplicable: colombiana. Sin arbitraje obligatorio, sin renuncia a acciones colectivas y sin foro exclusivo para usuarios; el arbitraje solo es opcional en los términos institucionales.
- Sin exoneraciones generales de responsabilidad; se preservan los derechos irrenunciables del consumidor.
- El usuario conserva la titularidad de su contenido y otorga una licencia limitada, no exclusiva y revocable solo para operar el servicio. Cogni no entrena modelos con él.
- La IA es formativa; se advierte que puede equivocarse y que algunos proveedores gratuitos usan el contenido.
- Donde la plataforma aún no hace algo que la ley exige (eliminación en la aplicación, borrado de archivos, banner de cookies), los documentos públicos declaran el derecho y el canal por correo, y la brecha queda en la matriz.

## 4. Datos pendientes (`[PENDIENTE: …]`)

**Identidad del Responsable (bloquean la publicación):**

- `[PENDIENTE: nombre completo]`
- `[PENDIENTE: cédula]`
- `[PENDIENTE: dirección de notificación]`
- `[PENDIENTE: correo de privacidad]`
- `[PENDIENTE: teléfono]`
- `[PENDIENTE: dominio]`
- `[PENDIENTE: fecha de entrada en vigor]`

**Datos técnicos por confirmar en los paneles de los proveedores:**

- `[PENDIENTE: región de Supabase]`
- `[PENDIENTE: región de Upstash]`
- `[PENDIENTE: proveedor de correo transaccional y su país]` y `[PENDIENTE: confirmar si es el servicio de correo incluido en Supabase]`
- `[PENDIENTE: periodo de retención en PostHog y Sentry]`
- `[PENDIENTE: duración de las cookies sb-*]`
- `[PENDIENTE: duración de la cookie de PostHog]`

**Decisiones del Responsable:**

- `[PENDIENTE: días de aviso de cierre; se sugieren 30 días calendario]` (términos, cláusula 13.3)

**Términos institucionales (se definen al negociar con una institución):**

- `[PENDIENTE: definir proveedores de pago para el plan institucional.]` y el Apéndice A-1 de subencargados
- `[PENDIENTE: confirmar con asesoría jurídica antes de firmar con una entidad pública.]`
- `[PENDIENTE: plazo de confidencialidad tras la terminación]`
- `[PENDIENTE: tope de responsabilidad institucional, por ejemplo el valor pagado en los últimos doce meses]`
- `[PENDIENTE: plazo de subsanación]`
- `[PENDIENTE: plazo de arreglo directo]`
- `[PENDIENTE: número de árbitros]` y `[PENDIENTE: cámara de comercio]`
- `[PENDIENTE: plazo de traslado de solicitudes]`
- `[PENDIENTE: plazo de devolución o eliminación]`

## 5. Puntos pendientes de verificación

Están marcados como **(pendiente de verificación)** en [marco-legal.md](marco-legal.md):

1. Prórroga de ocho (8) días hábiles para reclamos (Ley 1581 de 2012, art. 15): la copia consultada se cortó antes de la cifra.
2. Validez de un DPA estándar aceptado electrónicamente como contrato de transmisión ante la SIC.
3. Ausencia de modificaciones del numeral 3.2 del Título V de la Circular Única de la SIC posteriores a marzo de 2020.
4. Guía de la SIC sobre responsabilidad demostrada (2015): URL y fecha.
5. Valor de la UVT de 2026 y fecha exacta del Decreto 090 de 2018.
6. Concepto oficial de la SIC sobre cookies.
7. Decisión de la SIC o de la Corte Suprema sobre la aceptación mediante casilla (*click-wrap*).
8. Concepto de la SIC sobre servicios digitales gratuitos como relación de consumo, y decisiones sobre cláusulas de limitación de responsabilidad y de arbitraje en contratos de consumo.
9. Literales del artículo 50 de la Ley 1480 de 2011 posteriores al d), y fecha exacta de la Ley 2439 de 2024.
10. Requisitos tributarios y mercantiles para planes de pago (IVA, facturación electrónica, registro mercantil).
11. Doctrina de la SIC sobre si los recordatorios de repaso son publicidad (Ley 2300 de 2023).
12. Ausencia de un régimen legal colombiano de notificación y retiro.
13. Contenido de la Resolución 154 de 2025 de la DNDA.
14. Texto de la Ley 27 de 1977 en la Secretaría del Senado.
15. Texto del Decreto 769 de 2026, que reglamenta la Ley 2489 de 2025.
16. Archivo del Proyecto de Ley 043 de 2025 Senado en la Gaceta del Congreso, y ausencia de una ley de IA vigente en Colombia.
17. Texto oficial del Reglamento (UE) 2026/1744 en EUR-Lex y del artículo 6.3 del Reglamento (UE) 2024/1689.
18. Redacción del artículo 5.3 de la Directiva 2002/58/CE, exención de microempresas del Acta Europea de Accesibilidad y estado del asunto *Latombe*.
19. Artículos de ámbito territorial de la LGPD (Brasil), la Ley 21.719 (Chile), el reglamento peruano y la Ley 25.326 (Argentina).
20. Fecha de cumplimiento de la regla COPPA enmendada y alcance de la Sección 230 frente al contenido generado por IA.
21. Política de uso de OpenAI para gpt-oss y obligación de atribución "Built with Llama" para un servicio alojado.
22. Política de datos de usuario de las API de Google para el inicio de sesión con Google.
23. Artículo 13 de la Ley 1150 de 2007 y deberes de publicación en el SECOP de las universidades con régimen especial.
24. Ausencia de normas del Ministerio de Educación sobre plataformas educativas con IA.
25. Anexo de la Resolución 1519 de 2020 del MinTIC y adopción de WCAG 2.2 como ISO/IEC 40500:2025.

## 6. Recomendación

Antes del lanzamiento público:

1. Completar los datos del Responsable y la fecha de entrada en vigor.
2. Resolver las brechas de prioridad **Alta** de la [matriz de cumplimiento](matriz-de-cumplimiento.md), en especial la autorización antes de recolectar datos, el uso del nivel gratuito de Gemini, el consentimiento de cookies, los DPA de PostHog y Sentry, y la eliminación de la cuenta con borrado de archivos.
3. Pedir a un abogado con experiencia en protección de datos y derecho del consumidor en Colombia que revise todos los documentos.
4. Al publicar, conservar cada versión de los documentos y registrar qué versión aceptó cada persona.
