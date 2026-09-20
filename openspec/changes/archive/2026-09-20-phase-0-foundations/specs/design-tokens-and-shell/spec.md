# design-tokens-and-shell Specification

## Purpose

Aplicación de los tokens visuales de Cogni como tema de Tailwind, inicialización de shadcn/ui sobre esos tokens, shell autenticado vacío y layout público de autenticación, con accesibilidad WCAG 2.1 AA.

## Requirements

### Requirement: Tokens de diseño en el tema de Tailwind

`src/app/globals.css` MUST declarar los tokens de `docs/design-system/colors_and_type.css` dentro de un bloque `@theme` de Tailwind v4, sin `tailwind.config.js`. MUST incluir al menos: canvas `#EDEAE4`, superficie blanca `#FFFFFF`, sidebar `#FAFAF8`, borde subtle `#EDEAE4` y light `#E5E2DC`, texto primario `#1C1917`, texto muted `#A8A29E`, acento violeta `#7C3AED` / `#8B5CF6` / `#F5F3FF` / `#6D28D9`, la paleta pastel de resaltado con su variante `-fg`, los semánticos `#10B981` / `#F59E0B` / `#EF4444` / `#3B82F6`, radios 10/12/16/20 px y pill, y las variables de layout `sidebar-width: 240px`, `sidebar-collapsed: 64px`, `topbar-height: 52px`.

#### Scenario: Token disponible como utilidad

- GIVEN `globals.css` con el bloque `@theme`
- WHEN un componente usa la utilidad del color de canvas
- THEN el valor computado es `#EDEAE4`

#### Scenario: Ausencia de valores literales

- GIVEN cualquier componente del shell
- WHEN se inspeccionan sus clases y estilos
- THEN no contiene códigos hexadecimales en línea y usa solo tokens

### Requirement: Tipografías cargadas

La aplicación MUST cargar DM Sans para texto y JetBrains Mono para código, con una pila de reserva del sistema.

#### Scenario: Familia aplicada al cuerpo

- GIVEN la aplicación en ejecución
- WHEN se inspecciona el `body`
- THEN su familia resuelve a DM Sans con reserva sans-serif

### Requirement: shadcn/ui inicializado sobre los tokens de Cogni

shadcn/ui MUST inicializarse con variables CSS y MUST NOT aplicar el preset por defecto (`--defaults` / tema `base-nova`). `components.json` MUST dejar vacío el campo `tailwind.config`.

#### Scenario: Botón primario casi negro

- GIVEN el componente `Button` de shadcn/ui con variante primaria
- WHEN se renderiza
- THEN su fondo resuelve a `#1C1917` y no al violeta de acento

### Requirement: Shell autenticado

El grupo de rutas `(app)` MUST renderizar un shell con canvas gris cálido, área de contenido blanca de radio 20 px, sidebar de 240 px colapsable a 64 px y topbar de 52 px con menú de usuario que incluye cierre de sesión.

#### Scenario: Shell renderizado para sesión activa

- GIVEN un usuario autenticado
- WHEN visita la raíz del grupo `(app)`
- THEN ve sidebar, topbar y área de contenido con las medidas declaradas

#### Scenario: Colapso del sidebar

- GIVEN el shell con sidebar expandido
- WHEN el usuario activa el control de colapso
- THEN el sidebar mide 64 px, conserva sus iconos y la preferencia persiste al navegar

#### Scenario: Cierre de sesión desde el topbar

- GIVEN el menú de usuario abierto
- WHEN el usuario elige cerrar sesión
- THEN la sesión termina y queda en la pantalla de inicio de sesión

### Requirement: Layout público de autenticación

El grupo `(public)` MUST usar el patrón de panel partido: panel izquierdo `#1C1917` con destellos violeta radiales y panel derecho `#FAFAF8` con el formulario.

#### Scenario: Pantalla de acceso en escritorio

- GIVEN un visitante sin sesión
- WHEN abre la pantalla de inicio de sesión en ancho de escritorio
- THEN ve los dos paneles con los fondos declarados

#### Scenario: Pantalla de acceso en móvil

- GIVEN un visitante sin sesión en un ancho menor a 768 px
- WHEN abre la pantalla de inicio de sesión
- THEN el formulario ocupa el ancho completo y no hay desplazamiento horizontal

### Requirement: Copy de interfaz en español con "tú"

Todo texto de interfaz MUST estar en español con tratamiento de "tú", en oración con minúscula inicial salvo nombres propios, y MUST NOT incluir emoji.

#### Scenario: Revisión de textos del shell

- GIVEN las pantallas de la fase 0
- WHEN se revisan sus textos visibles
- THEN están en español con "tú", sin Title Case y sin emoji

### Requirement: Accesibilidad de la interfaz base

El shell y las pantallas de autenticación MUST cumplir contraste WCAG 2.1 AA, objetivos táctiles de 44 px mínimos, foco visible y MUST respetar `prefers-reduced-motion`.

#### Scenario: Contraste y objetivos

- GIVEN el shell renderizado
- WHEN se audita contraste y tamaño de los controles interactivos
- THEN todo texto alcanza AA y ningún control queda por debajo de 44 px

#### Scenario: Movimiento reducido

- GIVEN un usuario con `prefers-reduced-motion: reduce`
- WHEN navega por el shell
- THEN las transiciones no esenciales quedan desactivadas

### Requirement: Shell sin funcionalidad de producto

El shell de la fase 0 MUST mostrar únicamente un estado vacío y MUST NOT incluir cuadernos, editor, técnicas de estudio, calendario ni dashboard.

#### Scenario: Estado vacío

- GIVEN un usuario recién verificado
- WHEN entra al shell
- THEN ve un mensaje de estado vacío y ninguna función de producto
