# design-tokens-and-shell Specification (Delta)

## MODIFIED Requirements

### Requirement: Sidebar con árbol de cuadernos y páginas

El sidebar del grupo `(app)` MUST mostrar el árbol de cuadernos activos y sus páginas activas del owner autenticado, ordenados por `position`, reemplazando el estado vacío de la fase 0. Un owner sin cuadernos MUST ver el mensaje de estado vacío de `notebooks` ("Aún no tienes cuadernos. Crea uno para empezar.") en lugar del estado vacío genérico de la fase 0. El menú de acciones de cada cuaderno MUST incluir la entrada "Importar PDF" junto a las acciones existentes, accesible por teclado y por puntero, con un ícono de Lucide y sin emoji. Una página cuya importación está en estado no terminal MUST distinguirse en el árbol con un indicador visual discreto (por ejemplo un ícono o marca de estado con el token de texto muted) y un nombre accesible que informe que se está importando; al llegar a un estado terminal el indicador MUST desaparecer sin recargar.
(Previously: el menú del cuaderno no ofrecía importación y el árbol no distinguía páginas en importación.)

#### Scenario: Árbol visible para owner con contenido (e2e)

- GIVEN un usuario autenticado con cuadernos y páginas activas
- WHEN entra al shell
- THEN el sidebar muestra el árbol de cuadernos y páginas en orden de `position`

#### Scenario: Reescritura de `shell-empty-state.spec.ts` (e2e)

- GIVEN `tests/e2e/shell-empty-state.spec.ts` reescrito para esta fase
- WHEN se ejecuta contra un owner sin cuadernos
- THEN valida el mensaje de estado vacío de `notebooks` y el control para crear el primer cuaderno, sin asumir el shell vacío de la fase 0

#### Scenario: Entrada "Importar PDF" en el menú del cuaderno (e2e)

- GIVEN un cuaderno activo en el sidebar
- WHEN el usuario abre su menú de acciones con el teclado
- THEN existe la opción "Importar PDF" navegable con flechas y activable con `Enter`

#### Scenario: Página en importación marcada en el árbol (unit)

- GIVEN un árbol con una página cuyo job está en `processing`
- WHEN se renderiza el sidebar
- THEN esa página muestra el indicador de importación con un nombre accesible en español y las demás páginas no lo muestran

## ADDED Requirements

### Requirement: Indicador de progreso de importación

La vista de página con importación en curso MUST mostrar un indicador de progreso construido con los tokens del sistema de diseño (superficie blanca, radios declarados, texto primario y muted, acento violeta para el estado activo, semántico verde para éxito, rojo para error y ámbar para el aviso), sin códigos hexadecimales en línea. El indicador MUST representar seis estados con texto en español con "tú", en oración con minúscula inicial y sin emoji: "subiendo el archivo…" (subida directa en curso), "en cola" (job `queued`), "procesando el PDF…" (job `processing`), "listo" (job `done` sin páginas omitidas), "error" (job `failed`, mostrando el `error` del job) y "aviso de páginas sin texto" (job `done` con `pages_without_text` mayor que 0, mostrando "N páginas no tenían texto y se omitieron" con el número real). Los estados activos MUST exponer `role="status"` con `aria-live="polite"`; el estado de error MUST exponer `role="alert"`. Las animaciones del indicador MUST respetar `prefers-reduced-motion`.

#### Scenario: Estados renderizados desde el estado del job (unit)

- GIVEN el componente del indicador
- WHEN se renderiza con cada uno de los estados `uploading`, `queued`, `processing`, `done`, `failed` y `done` con `pages_without_text` 3
- THEN muestra respectivamente "subiendo el archivo…", "en cola", "procesando el PDF…", "listo", el `error` del job y "3 páginas no tenían texto y se omitieron"

#### Scenario: Regiones accesibles (unit)

- GIVEN el indicador en estado `processing` y luego en `failed`
- WHEN se inspecciona el DOM
- THEN el primero tiene `role="status"` con `aria-live="polite"` y el segundo `role="alert"`

#### Scenario: Ausencia de valores literales (unit)

- GIVEN el componente del indicador en cualquiera de sus estados
- WHEN se inspeccionan sus clases y estilos
- THEN no contiene códigos hexadecimales en línea y usa solo tokens de `@theme`

#### Scenario: Movimiento reducido (unit)

- GIVEN `prefers-reduced-motion: reduce`
- WHEN se renderiza el indicador en estado `processing`
- THEN no aplica animación continua y conserva el texto de estado

### Requirement: Polling del estado de importación

Mientras el job de una página abierta está en `queued` o `processing`, la interfaz MUST consultar su estado mediante la Server Action de consulta con TanStack Query a intervalos regulares de 2 000 ms como máximo (decisión 2). El polling MUST detenerse cuando el job llega a `done` o `failed`, cuando la página deja de estar montada o cuando la consulta responde que la página no tiene importación. Un error transitorio de la consulta MUST NOT detener el polling ni mostrar el estado de error del job; la interfaz SHOULD conservar el último estado conocido y reintentar en el siguiente intervalo. Si tras 90 segundos el job sigue sin estado terminal, la interfaz SHOULD mostrar un aviso de que la importación está tardando más de lo esperado y continuar consultando. MUST NOT usarse Trigger.dev Realtime ni exponerse ninguna credencial de Trigger.dev al cliente.

#### Scenario: Consultas hasta estado terminal (unit)

- GIVEN una página con job en `queued` y un doble de la consulta que responde `queued`, `processing`, `processing`, `done`
- WHEN la vista permanece abierta
- THEN se realizan exactamente cuatro consultas separadas por 2 000 ms o menos y ninguna consulta adicional tras recibir `done`

#### Scenario: Detención al desmontar (unit)

- GIVEN una página con job en `processing`
- WHEN el usuario navega a otra página antes del estado terminal
- THEN no se realizan más consultas para la página anterior

#### Scenario: Error transitorio de la consulta (unit)

- GIVEN un doble de la consulta que falla una vez y luego responde `processing`
- WHEN vence el intervalo
- THEN la interfaz conserva el estado previo, no muestra el estado de error del job y la siguiente consulta se realiza en el intervalo normal

#### Scenario: Sin credenciales en el cliente (unit)

- GIVEN el bundle de cliente de la aplicación
- WHEN se inspeccionan las variables accesibles y las peticiones salientes durante el polling
- THEN no existe ninguna clave de Trigger.dev y todas las consultas van a la Server Action de la aplicación
