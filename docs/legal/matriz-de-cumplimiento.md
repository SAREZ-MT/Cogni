# Matriz de cumplimiento legal de Cogni

- **Versión:** 1.0
- **Fecha de corte:** 28 de octubre de 2026 (estado verificado en el repositorio y en los términos de los proveedores)
- **Responsable:** [PENDIENTE: nombre completo]

> **En resumen**
>
> - Esta matriz cruza cada obligación legal con el estado real de Cogni, la brecha y la acción para cerrarla.
> - Prioridad **Alta**: debe resolverse antes del lanzamiento público. **Media**: poco después del lanzamiento o antes de crecer. **Baja**: buena práctica o condicional.
> - Las acciones de código y operación quedan listadas para planearlas con el usuario. Las ya hechas en código (feature `legal-consent`) aparecen tachadas en la sección 8 y sus filas indican lo que falta para publicar.

Abreviaturas: DUR = Decreto 1074 de 2015; SIC = Superintendencia de Industria y Comercio; DPA = acuerdo de tratamiento de datos.

## 1. Protección de datos personales

| ID | Requisito | Norma | Estado actual | Brecha | Acción | Prioridad |
|---|---|---|---|---|---|---|
| D1 | Autorización previa, expresa e informada, a más tardar al recolectar los datos | Ley 1581/2012, art. 9; DUR art. 2.2.2.25.2.2 (antes D. 1377, art. 5) | **Cerrada en código** (feature `legal-consent`, 28-10-2026): aviso de aceptación junto al botón de registro y a "Continuar con Google" en `/register` y `/login`, sin casilla (fila D21). La prueba se fija en el servidor antes de que exista la cuenta: metadatos del registro por correo o cookie de intención para Google, copiados al perfil en `/auth/callback` con la versión, la hora del consentimiento y el método | Pendiente de publicación: datos del Responsable `[PENDIENTE]`, aplicar la migración 0015 en producción y desplegar | Completar los datos, aplicar 0015 con autorización y publicar | Alta (hasta publicar) |
| D2 | Autorización separada de la aceptación de los términos y con el contenido del art. 12 | Ley 1581/2012, arts. 9 y 12 | El aviso contiene una frase propia de autorización ("autorizas el tratamiento de tus datos según la Política de privacidad") con enlace a la política, que incluye el aviso de privacidad | Una sola acción (el botón) cubre términos, autorización y edad; no hay casilla separada por decisión del usuario (fila D21) | Validar con el abogado que la frase separada basta; si no, añadir una casilla propia | Alta |
| D3 | Autorización expresa para el envío a proveedores de IA que usan los datos para fines propios | Ley 1581/2012, art. 26 lit. a; Circular Única SIC, T. V, num. 3.2 par. 1 | Los términos mencionan el uso por proveedores, sin autorización expresa de transferencia | No hay autorización expresa | Incluir la transferencia en la autorización (texto ya redactado en la política, sección 8.2) | Alta |
| D4 | Prueba de la autorización | DUR art. 2.2.2.25.2.5; Ley 1480/2011, art. 48 | Se guardan versión, hora del consentimiento y método (`email`, `google` o `gate`, columna `terms_accepted_method`, migración 0015); en el registro por correo, además, en los metadatos de la cuenta en Supabase | Falta resumen criptográfico del texto y agente de usuario; los metadatos de Supabase pueden ser modificados por el propio usuario, así que la prueba de referencia es la fila de `profiles` | Ampliar el registro (o pasar a una tabla de consentimientos de solo inserción) y conservar publicadas todas las versiones | Media |
| D5 | Política de tratamiento publicada | DUR art. 2.2.2.25.3.1; Ley 1581/2012, art. 17 lit. k | Página `/legal/privacidad` en código (fuente: `src/content/legal/`), con la lista de subencargados (`#subencargados`), el aviso y las cookies como secciones; marcada como borrador | Sin desplegar y con datos `[PENDIENTE]` | Completar los datos, desplegar y enlazarla en el pie de página | Alta |
| D6 | Aviso de privacidad al recolectar y conservación del modelo | DUR arts. 2.2.2.25.3.2 a 2.2.2.25.3.4 | Publicado en código como sección `/legal/privacidad#aviso-de-privacidad`; el aviso del registro enlaza la política que lo contiene | El texto del aviso no se muestra en el registro, solo su enlace; sin despliegue | Validar con el abogado si basta el enlace o si el enlace debe apuntar directo a `#aviso-de-privacidad`; conservar las versiones (historial de git de `src/content/legal/`) | Alta |
| D7 | Identificación y contacto del Responsable | Ley 1581/2012, art. 12 lit. d; Ley 1480/2011, art. 50 lit. a | Los términos dicen "correo del proyecto", sin dirección | Faltan nombre, cédula, dirección, correo y teléfono | Completar los [PENDIENTE] y crear el buzón de privacidad | Alta |
| D8 | Procedimiento de consultas (10 + 5 días hábiles) y reclamos (15 + 8 días hábiles) | Ley 1581/2012, arts. 14 y 15 | Solo canal por correo, sin procedimiento documentado | Sin registro de solicitudes ni control de plazos | Operar el procedimiento de la política (sección 13) con un registro de solicitudes y fechas | Alta |
| D9 | Leyenda "reclamo en trámite" en 2 días hábiles; requerimiento de subsanación en 5 días | Ley 1581/2012, art. 15 | No existe | Sin campo ni proceso | Añadir un campo o nota administrativa por perfil (por ejemplo, `claim_status`) | Media |
| D10 | Supresión de datos | Ley 1581/2012, arts. 8 lit. e y 15; C-748/2011 | El borrado del usuario elimina en cascada perfil y contenido; los archivos del almacenamiento no se borran | Archivos huérfanos tras la supresión; paso manual | Borrar los archivos de `page-assets` y `page-pdfs` al eliminar la cuenta; mientras tanto, procedimiento manual documentado | Alta |
| D11 | Eliminación de la cuenta tan sencilla como el registro | Ley 1480/2011, art. 43 num. 11 | Solo por solicitud al correo | Más exigente que el registro en línea | Eliminación de la cuenta en la aplicación, con confirmación | Alta |
| D12 | Acceso y copia de los datos | Ley 1581/2012, art. 8 lit. a y f | Sin exportación | Solo a solicitud manual | Exportación de datos en la aplicación (formato de uso común) | Media |
| D13 | Contratos de transmisión con encargados | DUR arts. 2.2.2.25.5.1 y 2.2.2.25.5.2 | Supabase, Upstash y Groq: DPA incorporado. PostHog: disponible, sin generar. Sentry: sin aceptar. Vercel Hobby: sin DPA | Faltan PostHog y Sentry; Vercel sin cobertura | Generar y archivar el DPA de PostHog; aceptar el de Sentry; evaluar Vercel Pro o documentar el riesgo | Alta (PostHog, Sentry); Media (Vercel) |
| D14 | Archivo de evidencia de los contratos | DUR art. 2.2.2.25.6.1 | No existe | Sin copias fechadas | Guardar copias fechadas de cada DPA y términos de proveedor | Media |
| D15 | Responsabilidad demostrada proporcional | DUR arts. 2.2.2.25.6.1 y 2.2.2.25.6.2 | Prueba versionada de aceptación | Falta manual interno, registro de incidentes y de solicitudes | Manual interno breve, registro de incidentes y de solicitudes | Media |
| D16 | Ponderación y evaluación de impacto en IA | Circular Externa SIC 002/2024, instr. I a IV | Sin documento | Sin evaluación | Evaluación de impacto breve (2 a 3 páginas) con ponderación, riesgos y medidas | Media |
| D17 | Notificación de incidentes a la SIC | Ley 1581/2012, art. 17 lit. n | Sin procedimiento | Sin plan de respuesta | Procedimiento de respuesta a incidentes con plantilla de reporte | Media |
| D18 | Datos sensibles: no condicionar el servicio y advertir | Ley 1581/2012, arts. 5 y 6; DUR art. 2.2.2.25.2.3 | Los términos piden no incluirlos | Cumple | Mantener la advertencia visible al importar y al escribir respuestas | Baja |
| D19 | Inscripción en el RNBD | DUR art. 2.2.2.26.1.2 | Persona natural | No aplica | Revisar si se constituye una sociedad | Baja |
| D20 | Retención definida | Ley 1581/2012, art. 4 lit. b; DUR art. 2.2.2.25.3.1 | Sin periodos de retención para analítica y errores | Periodos desconocidos | Fijar la retención en PostHog y Sentry y documentarla | Media |
| D21 | Aceptación por aviso junto al botón (*sign-in-wrap*), sin casilla | DUR art. 2.2.2.25.2.4 (conducta inequívoca); Ley 1480/2011, arts. 37 y 48; Ley 527/1999 | Decisión del usuario del 28-10-2026, en código (feature `legal-consent`): aviso visible, junto a cada botón que crea la cuenta, con enlaces a los términos y a la política, y prueba guardada en el servidor | Riesgo: no hay decisión de la SIC ni de la Corte Suprema sobre esta modalidad (punto 7 de la sección 5 del README), y es más débil que una casilla sin marcar. Además, la cláusula 2.1 de los términos y la 8.1 de la política siguen describiendo una casilla: el texto no coincide con el mecanismo | Revisión del abogado; ajustar las cláusulas 2.1 y 8.1 para describir el aviso (requiere nueva `TERMS_VERSION`); pasar a casilla si el abogado lo recomienda | Alta |

## 2. Cookies y analítica

| ID | Requisito | Norma | Estado actual | Brecha | Acción | Prioridad |
|---|---|---|---|---|---|---|
| C1 | Informar y obtener consentimiento para cookies no necesarias | Ley 1581/2012, arts. 9 y 12 (posición atribuida a la SIC, pendiente de verificación); referencia: Directiva 2002/58/CE, art. 5.3 | PostHog crea cookie y almacenamiento local desde la primera visita, sin aviso | Sin banner ni consentimiento | Inicializar PostHog solo tras el consentimiento (o tras iniciar sesión, con persistencia en memoria antes); banner de cookies | Alta |
| C2 | Política de cookies publicada | Ley 1581/2012, art. 12 | Publicada en código como sección `/legal/privacidad#cookies` | Sin desplegar; sin enlace propio en el pie de página | Desplegar y enlazar `#cookies` en el pie de página | Alta |
| C3 | Grabación de sesiones desactivada de forma verificable | Ley 1581/2012, art. 4 lit. b y c; referencia: CIPA (California) | Apagada en el proyecto de PostHog; el código no la desactiva | Depende de la configuración remota | Añadir `disable_session_recording: true` (y desactivar la captura de consola) en la inicialización | Alta |
| C4 | Minimización de la analítica | DUR art. 2.2.2.25.2.1 | Autocaptura y páginas vistas desactivadas | Captura de IP no verificada | Desactivar la captura de IP en PostHog | Media |

## 3. Términos, consumidor y comercio electrónico

| ID | Requisito | Norma | Estado actual | Brecha | Acción | Prioridad |
|---|---|---|---|---|---|---|
| T1 | Información veraz y completa del servicio | Ley 1480/2011, arts. 37 y 50 lit. b | Términos completos publicados en código (`/legal/terminos`); `TERMS_VERSION` pasó a `2026-10-28`, así que las cuentas existentes aceptan de nuevo en `/terminos`, que enlaza los documentos completos | El resumen de `/terminos` (`terms-copy.ts`) es anterior y omite DOCX, PPTX y las respuestas de recordación; sin despliegue | Alinear el resumen con los términos o reemplazarlo por un extracto de ellos | Media |
| T2 | Sin exoneración general de responsabilidad ni renuncia de derechos | Ley 1480/2011, arts. 42 y 43 nums. 1 a 4 | Términos actuales sin cláusula de responsabilidad | Sin cláusula equilibrada | Adoptar la cláusula 12 de los nuevos términos | Alta |
| T3 | Sin foro exclusivo ni arbitraje obligatorio para usuarios | CGP, art. 28 num. 3; Ley 1480/2011, arts. 42 y 58; Ley 1563/2012, art. 118 | No hay cláusulas de foro | Cumple | Mantener la cláusula 16 de los nuevos términos | Baja |
| T4 | Licencia de contenido limitada y declaración de derechos del usuario | Ley 23/1982, art. 12; Decisión 351, arts. 21 y 22; Ley 1915/2018, art. 16 | Sin cláusula | Sin base contractual para almacenar y procesar | Adoptar la cláusula 6 de los nuevos términos | Alta |
| T5 | Enlaces legales permanentes y descargables | Ley 1480/2011, art. 50 lit. d; Ley 527/1999, art. 6 | Cuatro páginas en código: `/legal/terminos`, `/legal/privacidad` (con `#subencargados`, `#aviso-de-privacidad` y `#cookies`), `/legal/uso-aceptable` (con `#integridad-academica`) y `/legal/derechos-de-autor`; el pie de página de la landing (`feat/landing-v1`) enlaza términos y privacidad | Sin desplegar; el pie de página aún no enlaza uso aceptable ni derechos de autor; sin versión descargable | Completar los enlaces del pie de página y ofrecer impresión o PDF | Alta |
| T6 | Planes de pago: retracto, reversión, facturación | Ley 1480/2011, arts. 47, 50 lit. c y 51; DUR arts. 2.2.2.37.x y 2.2.2.51.x | Sin planes de pago | No aplica hoy | Revisar antes de cobrar; registro mercantil, RUT y facturación con un contador | Baja (condicional) |
| T7 | Correos publicitarios con consentimiento, cancelación y horarios | Ley 2300/2023, arts. 3 y 5 | No hay correos publicitarios ni lista de espera | No aplica hoy | Si se lanzan: consentimiento separado, enlace de cancelación y envío dentro de los horarios en hora colombiana | Baja (condicional) |

## 4. Proveedores de IA

| ID | Requisito | Norma | Estado actual | Brecha | Acción | Prioridad |
|---|---|---|---|---|---|---|
| A1 | No enviar información personal al nivel gratuito de Gemini | Términos adicionales de la API de Gemini (2026) | El contenido libre puede incluir datos personales | Riesgo contractual que las advertencias no eliminan | Migrar Gemini a nivel pago, relegarlo en el orden de respaldo o depurar datos personales antes del envío | Alta |
| A2 | No ofrecer el nivel gratuito de Gemini en el EEE, Reino Unido y Suiza | Términos adicionales de la API de Gemini; RGPD, art. 3.2 (referencia) | Exclusión solo contractual | Sin bloqueo técnico | Bloqueo geográfico de EEE, Reino Unido y Suiza (por ejemplo, en el proxy o en Vercel) | Alta |
| A3 | Trasladar a los usuarios las políticas de uso de los modelos | OpenRouter, secs. 5.1, 5.2 y 5.5; Groq, sec. 3.2; Cloudflare; Llama 3.3 AUP | Sin política de uso aceptable | Falta incorporación por referencia | Publicar la política de uso aceptable y de IA y enlazarla desde los términos | Alta |
| A4 | Advertir los riesgos conocidos de la IA | Política de uso aceptable de Llama 3.3, num. 4; Ley 1480/2011, art. 50 lit. b | Advertencia parcial | Sin aviso de transparencia | Publicar el aviso de transparencia; etiquetar en la interfaz el contenido generado por IA | Media |
| A5 | Modelos de OpenRouter disponibles y con política de datos conocida | Términos de OpenRouter; Ley 1581/2012, art. 12 | Los dos modelos gratuitos configurados no tienen proveedores activos | Proveedor inservible y sin política verificable | Sustituir o retirar los modelos en `provider-registry.ts`; activar en OpenRouter la opción de no enrutar a proveedores que entrenan | Alta |
| A6 | Atribución "Built with Llama" | Licencia comunitaria de Llama 3.3 (pendiente de verificación) | Sin atribución | Posible incumplimiento de la licencia | Mostrar la atribución en la página de IA o de créditos | Media |
| A7 | Marcado y transparencia del contenido generado | Reglamento (UE) 2024/1689, art. 50 (referencia) | Sin etiqueta visible | Buena práctica no adoptada | Etiquetar "Generado con IA" en tarjetas, preguntas, exámenes y retroalimentación | Baja |

## 5. Edad, territorio y seguridad

| ID | Requisito | Norma | Estado actual | Brecha | Acción | Prioridad |
|---|---|---|---|---|---|---|
| E1 | Solo mayores de 18 años, con filtro neutral | Ley 1581/2012, art. 7; Ley 1098/2006, art. 3; Ley 2489/2025; términos de Gemini, Groq y OpenRouter | Autodeclaración en la misma casilla de los términos, que revela la respuesta esperada | Filtro no neutral | Pedir la fecha de nacimiento sin indicar el umbral antes del registro, bloquear a menores y guardar solo el resultado y la fecha | Media |
| E2 | Supresión al conocer que una cuenta es de un menor | Ley 1581/2012, art. 7; COPPA (referencia) | Sin procedimiento | Sin proceso | Incluir el caso en el procedimiento de supresión | Media |
| E3 | Vigilar la reglamentación de la Ley 2489/2025 | Decreto 769/2026 (pendiente de verificación) | Sin revisar | Texto no consultado | Revisar el decreto antes del lanzamiento | Media |
| S1 | Medidas de seguridad apropiadas | Ley 1581/2012, arts. 4 lit. g y 17 lit. d | Seguridad a nivel de fila, almacenamiento privado, cabeceras de seguridad, Sentry sin datos personales | Contraseña mínima de 8 caracteres sin segundo factor | Evaluar 15 caracteres mínimos o segundo factor (NIST SP 800-63B-4, buena práctica); ver también el plan de endurecimiento de seguridad pendiente | Media |

## 6. Propiedad intelectual

| ID | Requisito | Norma | Estado actual | Brecha | Acción | Prioridad |
|---|---|---|---|---|---|---|
| P1 | Procedimiento de notificación y retiro y de infractores reiterados | Ley 23/1982; buena práctica DMCA § 512 y DSA art. 16 | No existe | Sin canal | Publicar la política de derechos de autor y operar el buzón | Media |
| P2 | Créditos de recursos de terceros | Licencias de ilustraciones y componentes | Créditos pendientes en la configuración | Atribución incompleta | Sección de créditos en Configuración | Media |
| P3 | Titularidad del trabajo de grado | Ley 23/1982, art. 20; reglamento de la universidad | Sin revisar | Reglamento institucional no consultado | Revisar el reglamento de propiedad intelectual de la universidad | Baja |

## 7. Institucional y accesibilidad

| ID | Requisito | Norma | Estado actual | Brecha | Acción | Prioridad |
|---|---|---|---|---|---|---|
| I1 | Contrato de transmisión cuando la institución es Responsable | DUR art. 2.2.2.25.5.2 | Modelo redactado (Anexo A) | Sin configuración institucional | Definir proveedores de IA de pago sin uso de datos antes de ofrecer el modo institucional | Baja (condicional) |
| I2 | Uso solo formativo de la evaluación con IA | Reglamento (UE) 2024/1689, anexo III, punto 3 (referencia) | Modelo redactado | — | Mantener la cláusula en toda licencia | Baja (condicional) |
| X1 | Accesibilidad WCAG 2.2 AA | Buena práctica; Res. MinTIC 1519/2020 solo para sujetos obligados | Contrastes AA documentados en algunos componentes | Sin auditoría completa | Auditoría de accesibilidad con los criterios nuevos de WCAG 2.2 | Baja |

## 8. Lista consolidada de seguimientos de código y operación

**Código (requieren autorización del usuario):**

1. ~~Páginas públicas de política de datos, aviso de privacidad, cookies, uso aceptable e IA, integridad académica, derechos de autor y subencargados~~: hechas en `legal-consent` L1 (cuatro rutas `/legal/*`). Faltan los enlaces del pie de página (D5, D6, C2, T5).
2. ~~Aceptación y autorización de datos antes de enviar el registro y antes de redirigir a Google~~: hecha en `legal-consent` L2 con un aviso sin casilla, por decisión del usuario (D1, D2, D3, D21). Falta ajustar las cláusulas 2.1 de los términos y 8.1 de la política, que describen una casilla.
3. Registro ampliado de la aceptación: resumen criptográfico del texto, mecanismo de autenticación y agente de usuario (D4).
4. Banner de consentimiento de cookies y PostHog inicializado solo con consentimiento (C1).
5. `disable_session_recording: true` y desactivación de la captura de consola en la inicialización de PostHog (C3).
6. Eliminación de la cuenta en la aplicación, con borrado de los archivos de almacenamiento (D10, D11).
7. Exportación de datos (D12).
8. Actualización del resumen de `src/modules/identity/ui/terms-copy.ts` (DOCX, PPTX, respuestas de recordación, contacto); la nueva `TERMS_VERSION` (`2026-10-28`) ya está (T1).
9. Sustitución o retiro de los modelos gratuitos de OpenRouter sin servicio (A5).
10. Bloqueo geográfico de EEE, Reino Unido y Suiza (A2).
11. Filtro de edad neutral (E1).
12. Campo o proceso de "reclamo en trámite" (D9).
13. Etiqueta "Generado con IA" y atribución "Built with Llama" (A6, A7).

**Operación (sin código):**

1. Completar los datos del Responsable y crear el buzón de privacidad (D7).
2. Generar y archivar el DPA de PostHog; aceptar el DPA de Sentry; decidir sobre Vercel Hobby (D13, D14).
3. Fijar la retención de PostHog y Sentry y desactivar la captura de IP (D20, C4).
4. Activar en OpenRouter la opción de no enrutar a proveedores que entrenan (A5).
5. Decidir el nivel de Gemini (pago, relegado o con depuración) (A1).
6. Documentar el procedimiento de consultas y reclamos, el registro de solicitudes y el de incidentes (D8, D15, D17).
7. Redactar la evaluación de impacto breve sobre el uso de IA (D16).
8. Revisar el Decreto 769 de 2026 y el reglamento de propiedad intelectual de la universidad (E3, P3).
9. Si se lanza publicidad o lista de espera, aplicar la Ley 2300 de 2023 (T7).
10. Revisión de todos los documentos por un abogado antes del lanzamiento.
