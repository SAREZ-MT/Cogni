# Lista de subencargados y proveedores de Cogni

- **Versión:** 1.0
- **Fecha de última actualización:** [PENDIENTE: fecha de entrada en vigor]
- **Responsable:** [PENDIENTE: nombre completo], persona natural, cédula de ciudadanía [PENDIENTE: cédula]

> **En resumen**
>
> - Estos son los proveedores que tratan datos para que Cogni funcione, qué datos reciben, en qué país y con qué garantías.
> - Estados Unidos, donde operan la mayoría, figura en el listado de países con nivel adecuado de protección de la Superintendencia de Industria y Comercio.
> - Google Gemini (nivel gratuito) y algunos modelos de OpenRouter usan el contenido para fines propios: para ellos el envío es una transferencia que autorizas de forma expresa.

## 1. Infraestructura

| Proveedor | Servicio | Datos que trata | País o región | Rol | Contrato y garantías |
|---|---|---|---|---|---|
| Supabase | Autenticación, base de datos PostgreSQL y almacenamiento de archivos | Correo, credenciales, perfil, aceptaciones, todo el contenido y la actividad de estudio, archivos importados | [PENDIENTE: región de Supabase] | Encargado | DPA versión 1 del 1 de agosto de 2026, incorporado a sus términos de servicio; cláusulas contractuales tipo de la UE (módulos 2 y 3) |
| Vercel (plan Hobby) | Alojamiento de la aplicación y tareas programadas diarias | Solicitudes web, direcciones IP y registros de ejecución en tránsito | Estados Unidos y otras regiones | Encargado | **Sin DPA**: Vercel solo lo ofrece en los planes Pro y Enterprise |
| Upstash | Contadores de límites de uso | Identificador interno del usuario; sin direcciones IP; expiran entre 1 y 48 horas | [PENDIENTE: región de Upstash] | Encargado | DPA de abril de 2025 incorporado a sus términos; cláusulas tipo y marco de privacidad UE-EE. UU. |
| PostHog | Analítica de producto | Identificador interno, identificador del dispositivo y eventos de uso | Estados Unidos | Encargado | DPA disponible en el plan gratuito, autogenerado desde su aplicación. **Pendiente de generar y archivar** |
| Sentry | Registro de errores | Informes técnicos de errores, sin datos personales por defecto | Estados Unidos y otros países | Encargado | DPA efectivo solo tras su aceptación electrónica. **Pendiente de aceptar** |
| Proveedor de correo de autenticación | Envío de correos de verificación y recuperación de contraseña | Correo electrónico | [PENDIENTE: proveedor de correo transaccional y su país] | Encargado | [PENDIENTE: confirmar si es el servicio de correo incluido en Supabase] |
| Cloudflare | Registro del dominio y DNS | Ningún dato de usuarios más allá del tránsito técnico | Global | — | Términos de Cloudflare |

## 2. Inteligencia artificial

| Proveedor | Modelo | Datos que recibe | País | Uso del contenido | Rol | Contrato y garantías |
|---|---|---|---|---|---|---|
| Groq | `openai/gpt-oss-120b` | Texto de páginas; en recordación activa, pregunta, rúbrica, fragmento y respuesta escrita | Estados Unidos | No entrena con entradas ni salidas sin permiso del cliente | Encargado | Acuerdo de servicios modificado el 22 de junio de 2026, con DPA incorporado |
| Cloudflare Workers AI | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Texto de páginas y documentos importados | Estados Unidos y otras regiones | No entrena ni conserva entradas ni salidas tras la solicitud | Encargado | Condiciones de la plataforma de desarrolladores del 28 de septiembre de 2026 |
| Google Gemini (nivel gratuito) | `gemini-3.5-flash-lite` | Texto de páginas y documentos importados; en recordación activa, pregunta, rúbrica, fragmento y respuesta escrita | Estados Unidos | Lo usa para prestar, mejorar y desarrollar productos de Google; posible revisión humana | Receptor que trata para fines propios (transferencia) | Términos adicionales de la API de Gemini del 23 de marzo de 2026. Sin DPA en el nivel gratuito |
| OpenRouter | Modelos gratuitos de terceros | Texto de páginas y documentos importados | Estados Unidos | Algunos proveedores a los que enruta pueden guardar o entrenar con el contenido | Receptor que puede tratar para fines propios (transferencia) | Términos de OpenRouter del 31 de agosto de 2026. **Los dos modelos configurados no tienen proveedores activos a la fecha; pendiente de sustituirlos** |

## 3. Terceros independientes

| Tercero | Cuándo interviene | Rol |
|---|---|---|
| Google (inicio de sesión) | Si eliges entrar con tu cuenta de Google | Responsable independiente |
| YouTube (`youtube-nocookie.com`) | Si insertas y reproduces un video en una página | Responsable independiente |

## 4. Cambios

Avisaremos los cambios en esta lista actualizando su fecha. Si un cambio implica un nuevo destinatario que use los datos para fines propios, te pediremos una nueva autorización.
