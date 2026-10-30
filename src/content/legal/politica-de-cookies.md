# Política de cookies de Cogni

- **Versión:** 1.0
- **Fecha de última actualización:** [PENDIENTE: fecha de entrada en vigor]
- **Responsable:** [PENDIENTE: nombre completo], persona natural, cédula de ciudadanía [PENDIENTE: cédula]

> **En resumen**
>
> - Usamos cookies necesarias para que inicies sesión, cookies de preferencias para recordar cómo dejaste la interfaz y una herramienta de analítica (PostHog) para saber qué funciones se usan.
> - No usamos cookies de publicidad ni de redes sociales.
> - Puedes borrar o bloquear las cookies desde tu navegador. Si bloqueas las necesarias, no podrás iniciar sesión.

## 1. Qué son las cookies y el almacenamiento local

Las cookies son pequeños archivos que un sitio guarda en tu navegador. El almacenamiento local (*localStorage*) es un espacio similar que el navegador ofrece a los sitios. En esta política llamamos "cookies" a ambos.

## 2. Categorías

- **Necesarias:** permiten iniciar sesión y mantenerla. Sin ellas Cogni no funciona.
- **Preferencias:** recuerdan cómo dejaste ciertos elementos de la interfaz.
- **Analítica:** nos ayudan a entender qué funciones se usan para mejorar Cogni. No son necesarias para prestarte el servicio.

## 3. Cookies que usamos

| Nombre | Categoría | Quién la pone | Finalidad | Duración |
|---|---|---|---|---|
| `sb-…` (cookies de sesión de Supabase) | Necesaria | Cogni, mediante Supabase | Mantener tu sesión iniciada de forma segura | [PENDIENTE: duración de las cookies sb-*] |
| `cogni_auth_flow` | Necesaria | Cogni | Completar de forma segura el inicio de sesión al volver del enlace de verificación o de Google. Es `httpOnly` y solo se envía a la ruta `/auth/callback` | 10 minutos |
| `cogni-sidebar` | Preferencias | Cogni | Recordar si la barra lateral está expandida o contraída | 1 año |
| `cogni-techniques-panel` | Preferencias | Cogni | Recordar si el panel "Técnicas" del editor está expandido o contraído | 1 año |
| `ph_<clave>_posthog` (cookie y almacenamiento local) | Analítica | Cogni, mediante PostHog (Estados Unidos) | Asociar los eventos de uso a un identificador del dispositivo y, tras iniciar sesión, a tu identificador interno | [PENDIENTE: duración de la cookie de PostHog] |

La analítica está configurada para recoger lo mínimo: no captura automáticamente los clics ni las páginas vistas, y la grabación de sesiones y la captura de la consola del navegador están desactivadas. Los eventos que registramos son el registro, el inicio de sesión, la importación de documentos (número de páginas, formato y duración), las solicitudes de generación y la aceptación de términos.

## 4. Contenido de terceros

Si insertas un video de YouTube en una de tus páginas, se carga desde el dominio `youtube-nocookie.com`, el modo de privacidad mejorada de YouTube. Al reproducirlo, Google puede guardar información en tu navegador según su propia política.

Cogni no usa fuentes tipográficas de servicios externos: las sirve desde su propio servidor.

## 5. Tu consentimiento

Las cookies necesarias se usan porque sin ellas no es posible prestarte el servicio que pides. Las de preferencias solo guardan el estado de la interfaz.

Para la analítica te pediremos tu consentimiento antes de activarla y podrás retirarlo en cualquier momento. Mientras habilitamos ese mecanismo, puedes impedir la analítica con las opciones de la sección 6 o escribirnos a [PENDIENTE: correo de privacidad].

## 6. Cómo borrar o bloquear las cookies

Puedes ver, borrar o bloquear las cookies y el almacenamiento local desde la configuración de tu navegador:

- **Chrome:** Configuración > Privacidad y seguridad > Cookies de terceros y datos de sitios.
- **Firefox:** Ajustes > Privacidad y seguridad > Cookies y datos del sitio.
- **Safari:** Ajustes > Privacidad > Gestionar datos de sitios web.
- **Edge:** Configuración > Cookies y permisos del sitio.

Las extensiones que bloquean rastreadores también pueden impedir la analítica. Si bloqueas las cookies necesarias, no podrás iniciar sesión.

## 7. Más información

El tratamiento de los datos que se obtienen con las cookies se rige por la [Política de tratamiento de datos personales](/legal/privacidad). Si cambiamos las cookies que usamos, actualizaremos esta política.
