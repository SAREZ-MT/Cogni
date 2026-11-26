# ADR 0010 — Endurecimiento de seguridad previo al lanzamiento

| Campo | Valor |
|---|---|
| Fecha | 2026-11-25 |
| Estado | Aceptado (implementado en la rama `feat/security-hardening`; la migración `0016` está aplicada a la base de desarrollo y la prueba manual de restablecimiento se hizo el 2026-11-25, ver "Pendientes") |
| Reemplaza | Los límites por usuario de ADR 0004 (6 generaciones por día) y de ADR 0007 (60 respuestas evaluadas por día, una llamada al modelo por respuesta); la regla "una solicitud de examen cuesta una sola generación" de ADR 0006; las versiones de prompt de las Fases 3 a 6; y la frase "HSTS lo maneja Vercel" de §9 del documento maestro 1.7.2. Recogido en la versión 1.8.0 del documento maestro. No cambia la rotación de proveedores ni el reintento único de ADR 0004 |

## Contexto

Una auditoría de seguridad de solo lectura del 2026-10-26, verificada de nuevo contra el código el 2026-11-03, encontró brechas de plataforma que debían cerrarse antes de abrir Cogni al público:

- **Disponibilidad y costo de la IA.** El adaptador usaba los reintentos por defecto del AI SDK, ninguna llamada tenía tiempo máximo propio, la retroalimentación de sesión no consumía ningún límite, un examen de varias llamadas costaba una sola unidad y no existía un tope para toda la aplicación. Los proveedores son gratuitos y su cuota es compartida por todos los usuarios.
- **Inyección de instrucciones.** El texto de la página, los títulos y los ítems guardados entraban sin delimitar en los prompts de generación y de retroalimentación. En recordación activa, la respuesta del estudiante podía pedirle al evaluador la nota máxima.
- **Acceso.** Ninguna Server Action comprobaba la aceptación de los términos (solo el layout), y una Server Action se puede llamar directamente. La comprobación de términos dejaba pasar cuando no podía leer el perfil. `safeNext` validaba el destino por prefijo. El registro revelaba si un correo ya tenía cuenta. Cualquier sesión válida podía cambiar la contraseña.
- **Aislamiento entre estudiantes.** Los repositorios de cuadernos, páginas y recursos buscaban solo por `id`. La aplicación se conecta a Postgres con un rol que no pasa por Row Level Security, así que esas consultas eran la única barrera.
- **Configuración y cadena de suministro.** Nada impedía desplegar producción con el proveedor de IA falso o con las vistas previas de diseño; la CSP admitía cualquier proyecto de Supabase; las acciones de CI se referían por etiqueta y varias dependencias sensibles usaban rangos.

La característica se construyó con ODD en la rama `feat/security-hardening` (unidades S0 a S8a). Las decisiones de producto son del usuario: los valores de los límites (2026-11-23), el texto neutro del registro (2026-11-24) y la evaluación de recordación activa en una llamada por sesión (2026-11-03).

## Decisión

### Capa de IA

1. **Presupuestos diarios de toda la aplicación, cobrados por intento y con falla cerrada.** Tres contadores por día UTC compartidos por todos los usuarios: `AI_GLOBAL_DAILY_GENERATIONS` (700), `AI_GLOBAL_DAILY_EVALUATIONS` (350) y `AI_GLOBAL_DAILY_FEEDBACKS` (700). `generateStructured` cobra una unidad después de elegir el proveedor y antes de llamarlo (`UpstashBudgetStore`: incrementa y luego compara, clave `{prefijo}:ai:budget:{grupo}:{yyyy-mm-dd}`). Con el presupuesto agotado, o si el contador no responde, la llamada termina con `AI_DAILY_BUDGET_EXHAUSTED`. La suma (1.750) es la capacidad diaria utilizable de los proveedores gratuitos con un 20 % de reserva; el reparto entre grupos es una suposición proporcional a los límites por usuario.
2. **Límites por usuario redefinidos.** `AI_DAILY_GENERATIONS` pasa de 6 a 20 y su unidad es una llamada al modelo que genera: un examen o una repetición repartidos en varias llamadas cuestan una unidad por llamada, todas o ninguna. `AI_DAILY_EVALUATIONS` pasa de 60 respuestas a 10 sesiones. La retroalimentación de sesión de flashcards y exámenes tiene su propio límite, `AI_DAILY_FEEDBACKS` (20). Una sesión de recordación activa admite 3 corridas de evaluación por día (`AI_EVALUATION_RUNS_PER_SESSION`), para acotar "Reintentar".
3. **Tiempo máximo por intento y sin reintentos del SDK.** Cada intento corre con `AbortSignal.timeout` (60 s por defecto) y el adaptador pasa `maxRetries: 0` al AI SDK: el único reintento es el de `generateStructured` (dos intentos, el segundo con otro proveedor cuando hay uno elegible) y cada intento queda auditado. La retroalimentación de sesión tiene 25 s en total, 12,5 s por intento.
4. **Evaluación de recordación activa en una llamada por sesión.** Todas las respuestas escritas de una sesión se evalúan juntas (`evaluate_recall_answer/v3`). Una salida con un identificador desconocido o repetido invalida la corrida completa; una respuesta sin evaluación falla sola.
5. **Texto no confiable en bloques de datos, con versiones de prompt inmutables.** `src/modules/ai/application/prompts/untrusted.ts` envuelve cada texto del estudiante en un bloque con nombre, elimina de ese texto las etiquetas de los bloques (repitiendo hasta que no quede ninguna) y reduce el título a una línea de 200 caracteres; la instrucción de sistema de cada prompt declara que los bloques son datos, nunca instrucciones. Un prompt publicado no se edita: cada cambio creó una versión nueva y retiró la anterior. Versiones en uso: `generate_flashcards/v2`, `generate_exam_questions/v2`, `generate_exam_variants/v2`, `generate_recall_questions/v2`, `evaluate_recall_answer/v3`, `session_feedback/v3` (flashcards) y `session_feedback/v4` (exámenes). Los títulos de cuadernos y páginas se guardan en una sola línea.
6. **Comprobación determinista de la evaluación contra la rúbrica, acotada solo en los dos extremos de la escala.** `checkEvaluation` (`src/modules/active-recall/domain/evaluation-check.ts`) conserva solo conceptos de la rúbrica, con la redacción de la rúbrica, y baja el puntaje a 1 como máximo cuando ningún concepto clave está presente y a 4 como máximo cuando falta alguno. La cota se aplica solo si el modelo ubicó todos los conceptos clave en una de sus dos listas; nunca sube un puntaje y conserva el original en `modelScore` cuando lo baja. El centro de la escala sigue siendo juicio del modelo.
7. **Topes de tamaño de la salida.** La rúbrica generada, la evaluación y la retroalimentación tienen topes en su esquema Zod (30 conceptos de 500 caracteres, textos de 4.000, listas de 15, 10 evaluaciones por llamada), iguales a lo que admite una rúbrica escrita a mano. Una salida que los supera es inválida.

### Acceso y cuentas

8. **Comprobación de acceso compartida en las Server Actions, con falla cerrada.** `requireOwner()` (`identity`) exige sesión, perfil legible y términos vigentes aceptados, y lo usan las acciones de `notebooks`, `ingestion`, `flashcards`, `exams`, `active-recall`, `scheduling` y `analytics`. Sin términos responde `IDENTITY_TERMS_REQUIRED`; si el perfil no se puede leer, `IDENTITY_PROFILE_UNAVAILABLE`. Una sesión ausente conserva el código `*_SESSION_REQUIRED` de cada módulo. El layout autenticado conserva su comportamiento: deja pasar cuando no puede leer el perfil, para mantener la interfaz durante una caída.
9. **Redirección `next` resuelta como un navegador.** `safeNext` resuelve el destino con `new URL` contra un origen de referencia, lo acepta solo si queda en ese origen y comprueba una segunda vez la cadena que devuelve. La comprobación por prefijo anterior aceptaba `/<tabulador>/host`, que un navegador normaliza a `//host`.
10. **Respuesta uniforme del registro.** Todo registro aceptado responde "Si el correo no tenía una cuenta, te enviamos un enlace de verificación. Revisa tu bandeja.", exista o no la cuenta; para una cuenta existente no se envía correo ni se registra ningún evento.
11. **El cambio de contraseña exige una sesión de recuperación reciente.** La única pantalla que cambia la contraseña es la de restablecimiento. `updatePassword` solo la acepta si el último paso `amr` del token verificado (`auth.getClaims()`) es `recovery` y tiene como máximo una hora; en otro caso responde `AUTH_RECOVERY_REQUIRED`, y una sesión que no se puede leer también se rechaza. La regla depende del flujo PKCE que usa Cogni (el enlace del correo pasa por `/auth/callback` y `exchangeCodeForSession`): Supabase marca una sesión de recuperación por PKCE con el método `recovery`; un flujo con `token_hash` y `verifyOtp` la marcaría `otp` y la regla rechazaría todo cambio. No se construyó un cambio de contraseña con la contraseña actual, porque ninguna pantalla lo pide.

### Aislamiento entre estudiantes

12. **Consultas acotadas por propietario más claves compuestas como aislamiento real.** Como el rol de la aplicación no pasa por Row Level Security, el aislamiento son las consultas: `findById(id, ownerId)` y `findByStoragePath(storagePath, ownerId)` en los puertos de `notebooks`, y `update` que solo escribe la fila del propietario de la entidad. Como segunda barrera, la migración `0016_owner_scoped_page_keys` añade las claves únicas `notebooks_id_owner_key` y `pages_id_owner_key` y reemplaza las claves foráneas de una columna por compuestas: `(notebook_id, owner_id)` en `pages` y `(page_id, owner_id)` en las doce tablas que cuelgan de una página. `ai_generations.page_id` conserva su clave de una columna con `ON DELETE SET NULL`.

### Configuración y cadena de suministro

13. **Guardas de producción ligadas a `VERCEL_ENV`.** Con `VERCEL_ENV=production` el esquema de entorno rechaza `AI_PROVIDER_MODE=fake` y `COGNI_DESIGN_PREVIEWS=1`, y `designPreviewsEnabled()` responde siempre falso. Se usa `VERCEL_ENV` y no `NODE_ENV` porque la suite e2e ejecuta una compilación de producción en modo `fake`.
14. **Cabeceras.** `Strict-Transport-Security: max-age=63072000; includeSubDomains` (sin `preload`), `Cross-Origin-Opener-Policy: same-origin-allow-popups` y `Cross-Origin-Resource-Policy: same-origin`. La CSP nombra el host exacto del proyecto de Supabase; el comodín `*.supabase.co` queda solo como respaldo cuando `NEXT_PUBLIC_SUPABASE_URL` falta o está mal formada.
15. **Acciones de CI fijadas por SHA y dependencias con versión exacta.** Las acciones de `.github/workflows` se refieren por SHA de commit con la versión en un comentario; `.github/dependabot.yml` propone cada semana sus actualizaciones y las de npm; `@sentry/nextjs`, `@supabase/ssr`, `@supabase/supabase-js`, `posthog-js` y `posthog-node` llevan versión exacta; `preinstall` ejecuta `npx --yes only-allow@1.2.2 pnpm`. Next.js sube de 16.4.1 a 16.4.6 por sus avisos de seguridad.
16. **Grabación de sesiones desactivada en el código.** `disable_session_recording: true` en `src/instrumentation-client.ts`, hasta que exista un consentimiento explícito.

## Consecuencias

- Un usuario, muchos usuarios o un proveedor colgado ya no pueden gastar la cuota sin tope: hay un techo por usuario, uno por sesión y uno para toda la aplicación, y ninguna llamada dura más que su tiempo máximo.
- Una sesión de recordación activa cuesta una llamada al modelo en vez de hasta diez. A cambio, el fragmento de página de cada respuesta es menor cuando la llamada lleva varias (se reparten un presupuesto de 6.500 tokens estimados, con un mínimo de 150 por fragmento), y un fallo de la llamada afecta a todas las respuestas de la corrida.
- Cuando el presupuesto de toda la aplicación se agota, nadie puede generar ni evaluar hasta el día siguiente (UTC), y la interfaz muestra su mensaje genérico de error: no hay un texto propio para `AI_DAILY_BUDGET_EXHAUSTED`.
- Las versiones de prompt anteriores ya no existen en el código; las filas de `ai_generations` anteriores conservan su `prompt_version` histórico.
- Cada Server Action añade una lectura del perfil. La interfaz no tiene un texto propio para `IDENTITY_TERMS_REQUIRED` ni para `IDENTITY_PROFILE_UNAVAILABLE`.
- El formulario de registro ya no avisa a quien intenta registrarse con un correo que ya tiene cuenta: recibe el mismo mensaje y ningún correo.
- La construcción de producción aplica la migración `0016` (`scripts/migrate-in-build.mjs`). Falla, sin cambiar nada, si alguna fila existente tiene un propietario distinto del de su página, y en ese caso detiene el despliegue.
- `Cross-Origin-Resource-Policy: same-origin` impide que otros orígenes incrusten recursos de Cogni. Un dominio propio de Supabase exigiría actualizar el host de la CSP.
- Las variables nuevas (`AI_DAILY_FEEDBACKS` y las tres `AI_GLOBAL_DAILY_*`) tienen valor por defecto: el despliegue no necesita definirlas salvo para cambiarlas.

### Riesgos residuales

- **Inyección de instrucciones.** Los bloques de datos la reducen pero no la impiden. No se eliminan etiquetas escritas con caracteres parecidos (ancho cero, ancho completo, cirílico o entidades HTML).
- **Nota inflada.** La cota actúa solo en los extremos: un modelo persuadido de marcar todos los conceptos como presentes no se corrige, y si sus listas no cubren toda la rúbrica no hay cota.
- **Límites por usuario que dejan pasar.** `@upstash/ratelimit` deja pasar la solicitud si Redis tarda más de 5 s; solo el presupuesto de toda la aplicación falla cerrado.
- **Carreras del límite de exámenes.** Entre la consulta y el consumo puede cobrarse una solicitud rechazada o quedar una repetición sin cobrar; el límite nunca se supera.
- **Corridas de evaluación.** Una corrida se descuenta aunque ningún proveedor llegue a responder: una caída y tres "Reintentar" bloquean la sesión hasta el día siguiente.
- **Cambio de contraseña fuera de la aplicación.** Con un token de acceso robado se puede llamar directamente a la API de Supabase Auth; cerrarlo requiere el ajuste "Secure password change" del proyecto de Supabase.
- **Enumeración de cuentas.** Un error del proveedor en el registro (por ejemplo, el límite de correos) y el mensaje de correo sin verificar del inicio de sesión todavía pueden distinguir cuentas. No se midió la diferencia de tiempo de respuesta.
- **Guarda de producción.** Se evalúa en la primera lectura del entorno de servidor, no al iniciar, y no actúa en un despliegue que no defina `VERCEL_ENV`.
- **Comprobación de acceso.** Las acciones de zona horaria de `identity` comprueban solo la sesión; en una navegación del cliente con términos pendientes, las lecturas de `notebooks` que lanzan terminan en la pantalla de error global en vez de redirigir a `/terminos`.

### Pendientes

- **Comprobado el 2026-11-25.** La migración `0016` está aplicada a la base de desarrollo; en producción la aplica el build al desplegar y falla, sin cambiar nada, si existe una fila con propietario distinto del de su página. Una prueba manual de restablecimiento con un enlace real (flujo PKCE) terminó con la contraseña cambiada, lo que confirma el método `recovery`.
- **Restablecimiento entre dispositivos.** El enlace solo funciona en el navegador que lo pidió. Cambiar a un enlace con `token_hash` exige ajustar la plantilla de correo de Supabase y aceptar el método `otp` en la regla; queda para después del lanzamiento por decisión del usuario.
- **Del usuario.** Añadir las cuatro variables nuevas a `.env.example` y corregir allí `AI_DAILY_GENERATIONS` y `AI_DAILY_EVALUATIONS`; activar "Secure password change" en Supabase.
- **No construido.** Eliminación de cuenta y exportación de datos (S5) y banner de consentimiento de cookies (S7), que pasan a la característica legal; tope de tamaño y profundidad del autoguardado, tabla de permisos de subida y cuota de almacenamiento por usuario, verificación de los bytes y eliminación de EXIF de las imágenes subidas, y traducción de los mensajes de error de proveedores y de autenticación a códigos (S8b).
- **Avisos abiertos.** F9 (corrida descontada sin llamada), F10 (carreras del límite de exámenes) y F11 (límites por usuario que dejan pasar con Redis lento), descritos arriba; caché de la lectura del perfil en `requireOwner`; textos propios para los códigos nuevos.

## Alternativas descartadas

- **Mantener los reintentos del AI SDK.** Multiplican las llamadas sin que la cuota local ni la auditoría las vean; el reintento propio ya cambia de proveedor.
- **Límite de toda la aplicación que deje pasar si Redis falla.** Un contador caído dejaría la cuota sin techo justo cuando no se puede medir; se prefirió negar el servicio de IA.
- **Mantener una llamada al modelo por respuesta en recordación activa.** Diez llamadas por sesión agotan la cuota gratuita con pocos usuarios; el aislamiento entre respuestas se conserva con un bloque por respuesta y la comprobación de identificadores.
- **Editar los prompts en su lugar.** Rompería la trazabilidad de `ai_generations.prompt_version`: dos textos distintos compartirían una versión.
- **Escapar `<` y `>` en lugar de eliminar las etiquetas de los bloques.** Altera el texto legítimo del estudiante (fórmulas, código) que el modelo debe leer.
- **Derivar el puntaje completo de las listas de conceptos.** Castigaría respuestas correctas cuando el modelo parafrasea o lista parcialmente los conceptos; por eso la cota actúa solo en los extremos y solo con listas completas.
- **Comprobar los términos solo en el layout o en el proxy.** No cubre una Server Action llamada directamente.
- **Dejar pasar en la Server Action cuando el perfil no se puede leer, como el layout.** Permitiría escrituras y llamadas a la IA de una cuenta cuya aceptación se desconoce.
- **Seguir validando `next` por prefijo, o con una lista de rutas permitidas.** El prefijo no ve lo que el navegador normaliza; la lista habría que mantenerla con cada ruta nueva.
- **Avisar "ya tienes una cuenta" en el registro.** Revela qué correos están registrados.
- **Exigir la contraseña actual para cambiarla.** No existe una pantalla de cambio de contraseña con sesión normal, y quien la olvidó no puede darla.
- **Confiar en Row Level Security para el aislamiento.** El rol de la conexión de servidor no pasa por ella y las tablas no tienen políticas propias, de modo que hoy no filtra nada para la aplicación.
- **Ligar las guardas de producción a `NODE_ENV`.** La suite e2e y cualquier `next build` local usan `NODE_ENV=production` con el proveedor falso.
- **Referir las acciones de CI por etiqueta.** Una etiqueta se puede mover a otro commit; el SHA no.
- **`pnpm exec only-allow` en `preinstall`.** No puede ejecutarse antes de la primera instalación.
