# Marco legal

> Versión revisada del capítulo. Fecha de corte de la investigación: 28 de octubre de 2026. Sustituye al borrador del 15 de octubre de 2026 (`odd/logs/marco-legal-borrador.md`). Las normas colombianas se verificaron en sus fuentes oficiales (Secretaría General del Senado, Gestor Normativo de la Función Pública, sede electrónica de la Superintendencia de Industria y Comercio, Corte Constitucional, Dirección Nacional de Derecho de Autor, Comunidad Andina, Departamento Nacional de Planeación y MinTIC). Los puntos que no pudieron confirmarse en fuente primaria se señalan con la marca **(pendiente de verificación)**. Este capítulo no constituye asesoría jurídica; se recomienda la revisión de un abogado antes del lanzamiento público de la plataforma.
>
> Convención de citación: siguiendo la adaptación habitual de la norma APA 7 para materiales jurídicos, las leyes, decretos y sentencias se citan en el texto por su denominación y año (por ejemplo, Ley 1581 de 2012, art. 15) y se ordenan en la lista de referencias por esa denominación. Las demás obras se citan por autor y año.

## 1. Introducción

Cogni es una plataforma web gratuita de estudio, desarrollada como trabajo de grado por una persona natural domiciliada en Colombia y dirigida exclusivamente a personas mayores de dieciocho años. Cada usuario organiza su material en cuadernos y páginas, escribe notas o importa documentos PDF, DOCX y PPTX, y a partir de ese contenido un conjunto de modelos de inteligencia artificial (IA) genera tarjetas de memoria (*flashcards*), preguntas de recordación activa y exámenes de práctica. La plataforma programa repasos con el algoritmo de repetición espaciada SM-2, evalúa con IA las respuestas escritas de recordación activa y ofrece un calendario y un tablero de seguimiento.

Desde el punto de vista jurídico, el funcionamiento de Cogni involucra seis operaciones relevantes:

1. La recolección y el almacenamiento de datos personales de los usuarios: correo electrónico, credenciales gestionadas por el proveedor de autenticación, nombre visible derivado del correo, zona horaria, registros de estudio y versión y fecha de aceptación de los términos.
2. El envío del contenido que el usuario escribe o importa, y de sus respuestas escritas de recordación activa, a proveedores de IA ubicados fuera de Colombia que operan en su nivel gratuito.
3. La medición de eventos de uso con una herramienta de analítica y el registro de errores de la aplicación.
4. La aceptación electrónica de unas condiciones generales.
5. El tratamiento de obras protegidas por derecho de autor que los usuarios suben a la plataforma.
6. La eventual oferta de licencias a universidades y otras organizaciones.

La base técnica se verificó en el repositorio de código el 28 de octubre de 2026. El sistema se despliega con Next.js en Vercel (plan Hobby). Supabase provee autenticación (correo y contraseña, o Google OAuth), base de datos PostgreSQL con seguridad a nivel de fila y almacenamiento privado de archivos organizado por usuario. Upstash Redis guarda contadores de límites de uso identificados por el identificador interno del usuario, sin direcciones IP y con expiración de entre una hora y cuarenta y ocho horas. Sentry registra errores con `sendDefaultPii: false`, sin trazas de rendimiento ni grabación de sesiones. PostHog registra eventos de producto en su nube estadounidense con la autocaptura y las páginas vistas desactivadas; la grabación de sesiones y la captura de consola están apagadas en la configuración del proyecto desde el 26 de octubre de 2026, aunque el código no las desactiva de forma explícita. La capa de IA rota, en orden de respaldo, entre Groq (`openai/gpt-oss-120b`), Google Gemini (`gemini-3.5-flash-lite`, nivel gratuito), Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) y OpenRouter (dos modelos gratuitos que, a la fecha de corte, ya no tienen proveedores que los sirvan). Al proveedor se envía el texto de la página hasta unos 12 000 *tokens*; para evaluar una respuesta de recordación activa se envían la pregunta, la rúbrica, el fragmento más pertinente de la página y la respuesta escrita del estudiante.

El propósito del capítulo es identificar las normas que rigen esas operaciones, determinar con argumentos cuáles son aplicables y cuáles operan solo como referencia, y contrastar sus exigencias con el estado actual del sistema. El capítulo cierra con un resumen de la matriz de cumplimiento (desarrollada en `docs/legal/matriz-de-cumplimiento.md`) y con las conclusiones que se derivan para el diseño de la plataforma.

## 2. Marco constitucional

La Constitución Política de 1991 contiene seis disposiciones que enmarcan el proyecto:

- **Artículo 15.** "Todas las personas tienen derecho a su intimidad personal y familiar y a su buen nombre", y "tienen derecho a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre ellas en bancos de datos y en archivos de entidades públicas y privadas"; además, "en la recolección, tratamiento y circulación de datos se respetarán la libertad y demás garantías consagradas en la Constitución" (Constitución Política de Colombia, 1991, art. 15). De esta disposición surge el derecho fundamental de *habeas data*, que desarrolla la Ley Estatutaria 1581 de 2012.
- **Artículo 20.** Garantiza la libertad de "informar y recibir información veraz e imparcial". Es un fundamento indirecto para advertir con claridad que el contenido generado por IA es automático y puede ser inexacto.
- **Artículo 61.** "El Estado protegerá la propiedad intelectual por el tiempo y mediante las formalidades que establezca la ley". Fundamenta el régimen de derecho de autor aplicable a los documentos que suben los usuarios, al software y al documento de tesis.
- **Artículos 67 y 69.** La educación es un derecho y un servicio público con función social, y las universidades "podrán darse sus directivas y regirse por sus propios estatutos". Cogni no es una institución educativa ni otorga títulos, por lo que no presta el servicio público de educación; la autonomía universitaria explica que cada institución fije sus propias reglas de integridad académica, de propiedad intelectual de las tesis y de contratación (véase la sección 13).
- **Artículo 162.** Ningún proyecto de ley "podrá ser considerado en más de dos legislaturas". Explica el archivo de los proyectos de ley sobre IA (sección 10.2).
- **Artículo 333.** La actividad económica y la iniciativa privada son libres, y "nadie podrá exigir permisos previos ni requisitos, sin autorización de la ley". No se requiere licencia previa para poner en marcha un servicio de software educativo.

## 3. Protección de datos personales en Colombia

### 3.1 Fuentes normativas y vigencia

El régimen general está compuesto por la Ley Estatutaria 1581 de 2012, revisada previamente por la Corte Constitucional en la Sentencia C-748 de 2011, y por su reglamentación. Esta reglamentación se expidió originalmente en el Decreto 1377 de 2013 y en el Decreto 886 de 2014, y hoy se encuentra compilada en el Decreto Único Reglamentario del Sector Comercio, Industria y Turismo, Decreto 1074 de 2015, Libro 2, Parte 2, Título 2, Capítulos 25 (artículos 2.2.2.25.x) y 26 (artículos 2.2.2.26.x).

El borrador anterior de este capítulo indicaba que el Decreto 1377 de 2013 figuraba como "derogado parcialmente por el Decreto 1081 de 2015". El hecho jurídico determinante es otro: el artículo 3.1.1 del Decreto 1074 de 2015 ("Derogatoria Integral") derogó los decretos reglamentarios del sector que compiló, con fundamento en el artículo 3 de la Ley 153 de 1887 (Decreto 1074 de 2015, art. 3.1.1). La fuente vigente es, por tanto, el Decreto 1074 de 2015. En este capítulo se cita primero el artículo del decreto único y, entre paréntesis, el artículo original del Decreto 1377 cuando ayuda a la lectura.

La Sentencia C-748 de 2011 declaró exequible el proyecto de ley estatutaria con algunas excepciones relevantes para Cogni (Sentencia C-748 de 2011, Resuelve):

- Declaró exequibles, entre otros, los artículos 1 a 5, 7, 9 a 18, 21, 22, 24, 25, 28 y 32 a 34.
- En el artículo 8, literal e), retiró la expresión "sólo" y precisó que el titular también puede revocar la autorización y solicitar la supresión del dato cuando no exista un deber legal o contractual que le imponga permanecer en la base de datos.
- En el artículo 23, literal a), retiró la expresión "a favor de la Superintendencia de Industria y Comercio".
- En el artículo 26, literal f), retiró la expresión "necesarias o".
- Declaró inexequibles el literal a) del artículo 20, el artículo 27 y, por vicios de procedimiento, los artículos 29 a 31 del proyecto.

### 3.2 Ámbito de aplicación y roles

La ley se aplica a los datos personales registrados en cualquier base de datos que los haga susceptibles de tratamiento por entidades públicas o privadas y al tratamiento efectuado en territorio colombiano (Ley 1581 de 2012, art. 2). La excepción de las bases de datos de ámbito "exclusivamente personal o doméstico" no cobija a Cogni, porque la plataforma está abierta al público y almacena datos de otras personas.

El desarrollador, como persona natural que decide sobre las finalidades y los medios del tratamiento, es el **Responsable del Tratamiento**. Supabase, Vercel, Upstash, Sentry y PostHog actúan como **Encargados**, porque tratan los datos por cuenta del Responsable. Los proveedores de IA requieren un análisis diferenciado (sección 3.7): Groq y Cloudflare se comprometen a no usar el contenido para fines propios y encajan en la figura del Encargado; Google, en el nivel gratuito de Gemini, usa el contenido para mejorar sus productos y actúa como un receptor que trata los datos para fines propios. Google también actúa como responsable independiente cuando el usuario elige iniciar sesión con su cuenta de Google.

La universidad en la que se desarrolla el trabajo de grado no decide las finalidades ni los medios del tratamiento, por lo que no se le atribuye la calidad de Responsable. Esa calificación cambia cuando una institución licencia Cogni para sus estudiantes y decide sobre el tratamiento (sección 13).

### 3.3 Principios

El artículo 4 de la Ley 1581 de 2012 consagra los principios de legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad. Tres de ellos tienen consecuencias directas para el diseño de Cogni:

- **Libertad** (lit. c): "el Tratamiento sólo puede ejercerse con el consentimiento, previo, expreso e informado del Titular".
- **Acceso y circulación restringida** (lit. f): los datos personales "no podrán estar disponibles en Internet u otros medios de divulgación o comunicación masiva, salvo que el acceso sea técnicamente controlable".
- **Seguridad** (lit. g): la información debe manejarse "con las medidas técnicas, humanas y administrativas que sean necesarias para otorgar seguridad a los registros evitando su adulteración, pérdida, consulta, uso o acceso no autorizado o fraudulento".

El reglamento añade un criterio de minimización: la recolección "deberá limitarse a aquellos datos personales que son pertinentes y adecuados para la finalidad para la cual son recolectados" (Decreto 1074 de 2015, art. 2.2.2.25.2.1; antes Decreto 1377 de 2013, art. 4). Cogni lo aplica al no pedir nombre, documento ni fecha de nacimiento, al derivar el nombre visible del correo y al enviar a los modelos de IA solo el contenido académico, sin identificadores de cuenta.

### 3.4 Autorización

La ley exige "la autorización previa e informada del Titular, la cual deberá ser obtenida por cualquier medio que pueda ser objeto de consulta posterior" (Ley 1581 de 2012, art. 9). El reglamento fija tres reglas determinantes para el flujo de registro:

1. **Oportunidad.** La autorización debe solicitarse "a más tardar en el momento de la recolección" de los datos, informando los datos que se recolectarán y todas las finalidades específicas (Decreto 1074 de 2015, art. 2.2.2.25.2.2; antes Decreto 1377 de 2013, art. 5). Si cambia la finalidad, se requiere una nueva autorización.
2. **Modo.** La autorización puede constar por escrito, de forma oral o mediante conductas inequívocas, y "en ningún caso el silencio podrá asimilarse a una conducta inequívoca" (Decreto 1074 de 2015, art. 2.2.2.25.2.4; antes art. 7). Una casilla de verificación es válida si no viene marcada por defecto.
3. **Prueba.** El Responsable debe conservar prueba de la autorización (Decreto 1074 de 2015, art. 2.2.2.25.2.5; antes art. 8; Ley 1581 de 2012, art. 17, lit. b).

**Contraste con Cogni.** La aceptación se registra en el perfil con su versión y fecha (`terms_accepted_version`, `terms_accepted_at`), y una nueva versión obliga a aceptar de nuevo, lo cual es una base sólida de prueba. Sin embargo, la casilla de aceptación aparece en una puerta posterior al inicio de sesión; los formularios de registro e ingreso solo muestran un aviso. Para ese momento, el proveedor de autenticación ya recolectó el correo electrónico o los datos básicos de Google. Este orden no satisface la regla de oportunidad. Además, el texto vigente es de "términos de uso" y no contiene una autorización específica de tratamiento con el contenido que exige el artículo 12 de la ley. La corrección consiste en pedir la autorización, mediante una casilla no marcada y separada de la aceptación de los términos, antes de enviar el formulario de registro y antes de redirigir a Google, y en conservar como prueba la versión, un resumen criptográfico (*hash*) del texto, la fecha, el identificador del usuario y el mecanismo de autenticación.

### 3.5 Deber de informar, política de tratamiento y aviso de privacidad

Al solicitar la autorización, el Responsable debe informar de manera clara y expresa: el tratamiento y su finalidad; el carácter facultativo de las respuestas sobre datos sensibles; los derechos del titular; y la identificación, dirección física o electrónica y teléfono del Responsable (Ley 1581 de 2012, art. 12).

La **política de tratamiento** debe constar en medio físico o electrónico, en lenguaje claro y sencillo, e incluir como mínimo: nombre o razón social, domicilio, dirección, correo y teléfono del Responsable; el tratamiento y su finalidad; los derechos del titular; la persona o área que atiende peticiones, consultas y reclamos; el procedimiento para ejercer los derechos; y la fecha de entrada en vigencia y el período de vigencia de la base de datos (Decreto 1074 de 2015, art. 2.2.2.25.3.1; antes Decreto 1377 de 2013, art. 13). La ley exige, además, "adoptar un manual interno de políticas y procedimientos" (Ley 1581 de 2012, art. 17, lit. k).

El **aviso de privacidad** es la comunicación verbal o escrita que informa la existencia de la política, y debe darse a más tardar al momento de la recolección. Su contenido mínimo es la identificación y el contacto del Responsable, el tratamiento y su finalidad, los derechos del titular y los mecanismos para conocer la política y sus cambios sustanciales; el Responsable debe conservar el modelo de aviso utilizado (Decreto 1074 de 2015, arts. 2.2.2.25.3.2 a 2.2.2.25.3.4; antes Decreto 1377 de 2013, arts. 14 a 16). En un entorno web, ambas piezas coexisten: un aviso breve junto a la casilla de autorización y un enlace a la política completa.

**Contraste con Cogni.** A la fecha de corte no existe una política de tratamiento publicada en la aplicación, ni un aviso de privacidad, ni enlaces legales en el pie de página. Los términos remiten a "el correo del proyecto" sin identificar al Responsable, y omiten que se envían a los proveedores de IA los archivos DOCX y PPTX importados y las respuestas escritas de recordación activa. Este trabajo entrega los textos de la política y del aviso en `docs/legal/`; su publicación en la aplicación queda registrada como brecha.

### 3.6 Derechos del titular y procedimiento

El titular tiene derecho a conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización; ser informado sobre el uso de sus datos; presentar quejas ante la Superintendencia de Industria y Comercio (SIC); revocar la autorización o solicitar la supresión cuando no exista un deber legal o contractual de conservar el dato; y acceder gratuitamente a sus datos (Ley 1581 de 2012, art. 8).

La ley fija dos procedimientos con plazos distintos:

- **Consultas** (art. 14): se atienden en un término máximo de diez (10) días hábiles desde su recibo. Si no es posible, se informa al interesado el motivo y la nueva fecha, que no puede superar cinco (5) días hábiles siguientes al vencimiento del primer término.
- **Reclamos** (art. 15), para corrección, actualización, supresión o incumplimiento de deberes:
  1. Si el reclamo está incompleto, se requiere al interesado dentro de los cinco (5) días siguientes para que subsane las fallas. Si transcurren dos (2) meses sin respuesta, se entiende que desistió.
  2. Si quien recibe el reclamo no es competente, lo traslada en un término máximo de dos (2) días hábiles e informa al interesado.
  3. Recibido el reclamo completo, se incluye en la base de datos la leyenda "reclamo en trámite" y el motivo, en un término no mayor a dos (2) días hábiles, y se mantiene hasta que se decida.
  4. El término máximo para atender el reclamo es de quince (15) días hábiles desde el día siguiente a su recibo. Si no es posible, se informan los motivos y la nueva fecha, que no puede superar ocho (8) días hábiles siguientes al vencimiento del primer término. La cifra de ocho días corresponde al texto legal conocido; en la copia consultada en esta revisión la página se cortó antes de ese número **(pendiente de verificación)**.

El titular debe agotar el trámite ante el Responsable antes de presentar una queja ante la SIC (Ley 1581 de 2012, art. 16).

**Contraste con Cogni.** Los términos vigentes ofrecen la eliminación de la cuenta por solicitud al "correo del proyecto". No existe en la aplicación una función de autoservicio para eliminar la cuenta ni para exportar los datos, ni un campo o proceso para marcar un "reclamo en trámite". El canal por correo electrónico es admisible siempre que se documente el procedimiento y se respeten los plazos. Al eliminar el usuario del sistema de autenticación, la base de datos borra en cascada su perfil y todo su contenido, pero los archivos guardados en el almacenamiento (imágenes y documentos importados) no se eliminan automáticamente, por lo que la supresión exige hoy un paso manual.

### 3.7 Transferencia y transmisión internacional

La ley prohíbe la transferencia de datos personales a países que no proporcionen niveles adecuados de protección, salvo excepciones como la "autorización expresa e inequívoca" del titular (lit. a) o la necesidad para ejecutar un contrato entre el titular y el Responsable, siempre que se cuente con la autorización del titular (lit. e) (Ley 1581 de 2012, art. 26).

El reglamento distingue la **transferencia**, en la que el receptor es a su vez Responsable, de la **transmisión**, en la que el receptor es un Encargado que trata los datos por cuenta del Responsable. Las transmisiones internacionales "no requerirán ser informadas al Titular ni contar con su consentimiento cuando exista un contrato en los términos del artículo 2.2.2.25.5.2" (Decreto 1074 de 2015, art. 2.2.2.25.5.1; antes Decreto 1377 de 2013, art. 24). Ese contrato debe señalar el alcance y las actividades del tratamiento, y obligar al Encargado a tratar los datos conforme a los principios, salvaguardar la seguridad de las bases de datos, guardar confidencialidad y aplicar la política y las finalidades autorizadas por el titular (Decreto 1074 de 2015, art. 2.2.2.25.5.2; antes art. 25). De ahí se deriva una prueba práctica para cada acuerdo de tratamiento de datos (DPA) de los proveedores: si define el alcance y las actividades, si obliga al proveedor a seguir las instrucciones y finalidades del Responsable y si cubre seguridad y confidencialidad. Los DPA estándar de corte europeo suelen cumplir esos tres puntos. La SIC no se ha pronunciado sobre si un DPA estándar aceptado electrónicamente cumple el artículo 2.2.2.25.5.2, aunque en la práctica se acepta **(pendiente de verificación)**.

La SIC fijó los estándares de nivel adecuado y el listado de países en el Capítulo Tercero del Título V de su Circular Única. El listado se adoptó con la Circular Externa 005 de 2017 y se modificó con las circulares externas 008 de 2017 y 002 de 2018. Según la versión consolidada del Título V publicada en la sede electrónica de la SIC (actualizada por la Circular Externa 003 de 2020), el numeral 3.2 incluye a Alemania, Australia, Austria, Bélgica, Bulgaria, Chipre, Costa Rica, Croacia, Dinamarca, Eslovaquia, Eslovenia, Estonia, España, **Estados Unidos de América**, Finlandia, Francia, Grecia, Hungría, Irlanda, Islandia, Italia, Japón, Letonia, Lituania, Luxemburgo, Malta, México, Noruega, Países Bajos, Perú, Polonia, Portugal, Reino Unido, República Checa, República de Corea, Rumania, Serbia y Suecia, además de los países que la Comisión Europea haya declarado con nivel adecuado (Superintendencia de Industria y Comercio [SIC], 2020). No se encontró una modificación posterior del numeral 3.2 **(pendiente de verificación)**. Los parágrafos del numeral añaden tres reglas:

- **Parágrafo primero.** Aun cuando el país de destino sea adecuado, el Responsable debe poder demostrar medidas apropiadas y efectivas en virtud del principio de responsabilidad demostrada.
- **Parágrafo tercero.** El simple tránsito de datos por el territorio de otros países no constituye transferencia.
- **Parágrafo cuarto.** "Es posible realizar la transmisión de datos personales a los países que cuentan con un nivel adecuado de protección".

**Aplicación a Cogni.** Todos los proveedores procesan datos principalmente en Estados Unidos, que figura en el listado; algunos son multirregión (Unión Europea, Japón o Corea, también incluidos). Las consecuencias son dos:

- **Encargados** (Supabase, Vercel, Upstash, Sentry, PostHog, Groq y Cloudflare): el envío es una transmisión. El nivel adecuado del destino, sumado a un contrato de transmisión, hace innecesario el consentimiento específico para la transmisión, aunque las finalidades deben constar en la política. Supabase y Upstash incorporan su DPA en los términos de servicio; Groq lo incorpora en su acuerdo de servicios; PostHog lo ofrece también en el plan gratuito, pero debe generarse desde su aplicación; Sentry exige aceptarlo electrónicamente; Vercel solo lo ofrece en los planes Pro y Enterprise, de modo que **el plan Hobby carece de contrato de transmisión** (Supabase, 2026; Upstash, 2025; Groq, 2026; PostHog, s. f.; Sentry, s. f.; Vercel, 2026).
- **Receptores que usan los datos para fines propios** (Gemini en su nivel gratuito y los modelos gratuitos de OpenRouter cuyos proveedores puedan conservar o entrenar con los datos): el envío es una transferencia. Como Estados Unidos es adecuado, el artículo 26 no la prohíbe, pero la finalidad y el destinatario deben figurar en la autorización (Ley 1581 de 2012, arts. 4, lit. b, y 12) y el Responsable debe responder por ella según el parágrafo primero. Se recomienda una **autorización expresa y separada** para el "envío del contenido a proveedores de IA en Estados Unidos, algunos de los cuales pueden usarlo para mejorar sus servicios", que cubre a la vez la excepción del literal a) del artículo 26 y el deber de informar.

### 3.8 Datos sensibles

Los datos sensibles son los que afectan la intimidad del titular o cuyo uso indebido puede generar discriminación, como los de salud, orientación política o religiosa, vida sexual o datos biométricos (Ley 1581 de 2012, art. 5). Su tratamiento está prohibido salvo excepciones (art. 6), y ninguna actividad puede condicionarse a que el titular los suministre (Decreto 1074 de 2015, art. 2.2.2.25.2.3; antes Decreto 1377 de 2013, art. 6). Cogni no solicita datos sensibles, pero un usuario puede escribirlos en sus notas, por ejemplo apuntes sobre su propia condición médica o un caso clínico con datos reales. Los términos vigentes piden no incluir "datos personales sensibles ni datos de otras personas"; es una medida preventiva adecuada que no elimina el riesgo, sobre todo porque el nivel gratuito de Gemini prohíbe enviar cualquier información personal (sección 12.1).

### 3.9 Datos de niños, niñas y adolescentes

El tratamiento de datos de niños, niñas y adolescentes está proscrito salvo los de naturaleza pública (Ley 1581 de 2012, art. 7). El reglamento lo permite cuando responde a su interés superior, se asegura el respeto de sus derechos fundamentales y media la autorización del representante legal, previo ejercicio del derecho del menor a ser escuchado (Decreto 1074 de 2015, art. 2.2.2.25.2.9; antes Decreto 1377 de 2013, art. 12). La decisión de restringir Cogni a mayores de edad evita implementar ese régimen reforzado (sección 9).

### 3.10 Responsabilidad demostrada proporcional al tamaño

Los Responsables deben ser capaces de demostrar, a petición de la SIC, que han implementado medidas apropiadas y efectivas para cumplir la ley, y esas medidas deben ser "proporcional[es]" a la naturaleza jurídica del Responsable y su tamaño empresarial, la naturaleza de los datos, el tipo de tratamiento y los riesgos potenciales (Decreto 1074 de 2015, art. 2.2.2.25.6.1; antes Decreto 1377 de 2013, art. 26). Las políticas internas deben garantizar, como mínimo, una estructura administrativa proporcional al tamaño, mecanismos internos para poner en práctica las políticas, incluida la capacitación, y procesos para atender consultas, peticiones y reclamos (Decreto 1074 de 2015, art. 2.2.2.25.6.2). La SIC valora estas medidas al graduar las sanciones.

Esta proporcionalidad es el fundamento más sólido de un programa de cumplimiento "ligero pero documentado" para un desarrollador individual: una política publicada, un aviso, la prueba versionada de las autorizaciones, un registro de encargados con sus contratos, una evaluación de impacto breve sobre el uso de IA, un procedimiento de consultas y reclamos con plazos y un registro de incidentes. La guía de la SIC sobre responsabilidad demostrada de 2015 desarrolla el principio, pero no se consultó de nuevo en esta revisión **(pendiente de verificación)**; el texto vinculante es el del decreto.

### 3.11 Registro Nacional de Bases de Datos

El Registro Nacional de Bases de Datos (RNBD) es el directorio público de las bases de datos sujetas a tratamiento que operan en el país (Ley 1581 de 2012, art. 25). El deber de inscripción recae solo en "a) Sociedades y entidades sin ánimo de lucro que tengan activos totales superiores a 100.000 Unidades de Valor Tributario (UVT)" y en "b) Personas jurídicas de naturaleza pública" (Decreto 1074 de 2015, art. 2.2.2.26.1.2, que compila el Decreto 886 de 2014 modificado por el Decreto 090 de 2018). Una persona natural no está en ninguna de esas categorías, por lo que **el Responsable de Cogni no está obligado a inscribir sus bases de datos en el RNBD**, cualquiera que sea su patrimonio. Si el proyecto se constituyera como sociedad, el deber surgiría solo por encima del umbral de activos; el valor de la UVT de 2026 y la fecha exacta del Decreto 090 de 2018 no se verificaron **(pendiente de verificación)**. Esta exención no releva al Responsable del resto de deberes legales.

### 3.12 Régimen sancionatorio

La SIC puede imponer multas de carácter personal e institucional hasta por el equivalente de dos mil (2.000) salarios mínimos mensuales legales vigentes, "sucesivas mientras subsista el incumplimiento"; suspensión de actividades hasta por seis meses; cierre temporal; y cierre inmediato y definitivo de las operaciones con datos sensibles (Ley 1581 de 2012, art. 23). Las sanciones se aplican a las personas de naturaleza privada y se gradúan según la dimensión del daño, el beneficio obtenido, la reincidencia, la colaboración y el reconocimiento de la infracción, entre otros criterios (art. 24). La escala de Cogni hace improbable una sanción alta, pero el régimen le es aplicable.

### 3.13 Cookies y analítica

En Colombia no existe una norma específica sobre cookies. La posición difundida, atribuida a la SIC, es que si las cookies recogen datos personales se aplica la Ley 1581, de modo que debe informarse previamente y solicitarse la autorización (Asuntos Legales, s. f.; Instituto Nacional de Contadores Públicos [INCP], 2020). No se localizó un concepto oficial de la SIC sobre cookies en su sede electrónica **(pendiente de verificación)**.

Cogni usa cookies de sesión de Supabase (`sb-*`) y una cookie de flujo de autenticación (`cogni_auth_flow`, diez minutos), ambas estrictamente necesarias; dos cookies de preferencias de interfaz (`cogni-sidebar` y `cogni-techniques-panel`, un año); y la cookie y el almacenamiento local de PostHog para analítica. La analítica no es necesaria para prestar el servicio y, como asocia un identificador al dispositivo, debe informarse y someterse a consentimiento. Hoy no existe un aviso ni un mecanismo de consentimiento de cookies. Las medidas recomendadas son inicializar PostHog solo tras el consentimiento, desactivar de forma explícita la grabación de sesiones en el código (`disable_session_recording`) y publicar la política de cookies.

### 3.14 Habeas data financiero

La Ley 1266 de 2008 regula la información financiera, crediticia, comercial y de servicios destinada al cálculo del riesgo crediticio. No es aplicable a Cogni, que no reporta información a centrales de riesgo.

## 4. Comercio electrónico y validez de la aceptación electrónica

La Ley 527 de 1999 dispone que no se negarán efectos jurídicos, validez o fuerza obligatoria a la información por la sola razón de estar en forma de mensaje de datos (art. 5); que el requisito de escritura queda satisfecho si la información "es accesible para su posterior consulta" (art. 6); que la firma se equipara a un método que identifique al iniciador e indique su aprobación (art. 7); que los mensajes de datos son admisibles como prueba (art. 10); y que la oferta y su aceptación pueden expresarse mediante mensajes de datos (art. 14) (Ley 527 de 1999).

El Decreto 2364 de 2012, compilado en el Capítulo 47 del Decreto 1074 de 2015, define la firma electrónica como "códigos, contraseñas, datos biométricos, o claves criptográficas privadas, que permite identificar a una persona", siempre que sea confiable y apropiada; considera cumplido el requisito de firma con un mecanismo "tan confiable como apropiado"; y consagra la neutralidad tecnológica (Decreto 1074 de 2015, arts. 2.2.2.47.1 a 2.2.2.47.4).

Ninguna norma menciona la aceptación mediante casilla (*click-wrap*), y no se encontró una decisión de la SIC o de la Corte Suprema específica sobre ella **(pendiente de verificación)**. Por razonamiento, una cuenta autenticada con contraseña o con Google, una casilla sin marcar por defecto y el registro de la versión aceptada y su fecha son suficientes. A ello se suma un deber independiente del Estatuto del Consumidor: en los contratos celebrados por medios electrónicos, el productor "deberá dejar prueba de la aceptación del adherente a las condiciones generales" (Ley 1480 de 2011, art. 48).

**Contraste con Cogni.** El esquema actual versiona los términos (`TERMS_VERSION = "2026-10-04"`) y guarda la versión y la fecha aceptadas. Para reforzar la prueba se recomienda registrar también el resumen criptográfico del texto, el mecanismo de autenticación y el agente de usuario, y conservar publicada cada versión del texto.

## 5. Protección al consumidor

### 5.1 Aplicabilidad a un servicio gratuito

La Ley 1480 de 2011 define al consumidor como quien "adquiera, disfrute o utilice" un producto como destinatario final, y al proveedor como quien de manera habitual "ofrezca, suministre, distribuya o comercialice productos con o sin ánimo de lucro" (Ley 1480 de 2011, art. 5, nums. 3 y 11). La gratuidad no excluye por sí misma la aplicación del estatuto, y el usuario de Cogni "utiliza" el servicio como destinatario final. En contra, el artículo 49 define el comercio electrónico como la realización de actos "mercantiles", por lo que el capítulo de comercio electrónico (arts. 49 a 51) se activa plenamente con planes de pago. No se encontró un concepto de la SIC específico sobre servicios digitales gratuitos **(pendiente de verificación)**. La posición prudente, adoptada en este trabajo, es cumplir desde ahora las reglas generales sobre información, contratos de adhesión y cláusulas abusivas.

### 5.2 Contratos de adhesión y cláusulas abusivas

- **Información previa** (art. 37): las condiciones generales deben informarse "suficiente, anticipada y expresamente", en español, de forma "concreta[], clara[] y completa[]" y legible; las que no cumplan "se tendrán por no escritas".
- **Cláusulas abusivas** (art. 42): son las que producen un desequilibrio injustificado o afectan el tiempo, modo o lugar en que el consumidor puede ejercer sus derechos, y son "ineficaces de pleno derecho".
- **Cláusulas abusivas en particular** (art. 43): entre otras, las que limitan la responsabilidad legal del proveedor (num. 1); implican renuncia a los derechos del consumidor (num. 2); invierten la carga de la prueba (num. 3); trasladan la responsabilidad del proveedor al consumidor o a un tercero (num. 4); permiten al proveedor determinar unilateralmente si el producto es conforme (num. 7); presumen el consentimiento cuando de ello se deriven erogaciones (num. 9); imponen requisitos para terminar el contrato más exigentes que los de su celebración (num. 11); o impiden terminar en cualquier momento una renovación automática (num. 14).
- **Nulidad parcial** (art. 44): la cláusula ineficaz no anula el resto del contrato.

Las consecuencias para los términos de Cogni son tres. Primera, una cláusula general de exoneración ("Cogni no responde por nada") sería ineficaz; las advertencias sobre la IA deben formularse como información sobre el alcance del servicio y no como renuncia a deberes legales. Segunda, las limitaciones de responsabilidad deben ser razonables, operar "en la medida permitida por la ley" y no excluir el dolo, la culpa grave ni los deberes de protección de datos. Tercera, terminar la relación debe ser tan sencillo como registrarse (num. 11); una solicitud por correo es hoy más exigente que el registro en línea, por lo que la eliminación de la cuenta desde la aplicación es una brecha de prioridad alta.

### 5.3 Deberes de información en comercio electrónico y planes futuros

El artículo 50 exige a los proveedores que comercializan por medios electrónicos informar su identidad (nombre, NIT, dirección de notificación judicial, teléfono y correo), describir adecuadamente las prestaciones del servicio (lit. b, modificado por la Ley 2439 de 2024), informar el derecho de retracto y su procedimiento, y publicar las condiciones generales de forma permanente y descargable (Ley 1480 de 2011, art. 50). Los literales posteriores al d) no se leyeron completos **(pendiente de verificación)**. Mientras el servicio sea gratuito, se adopta como referencia la identificación del Responsable y un canal de contacto, que en todo caso exige el artículo 12 de la Ley 1581.

Para planes de pago futuros serán relevantes el derecho de retracto de cinco días hábiles en ventas a distancia y su excepción para servicios cuya prestación comenzó con el acuerdo del consumidor (art. 47, modificado por la Ley 2439 de 2024), la reversión del pago (art. 51, reglamentado en el Capítulo 51 del Decreto 1074 de 2015) y el régimen de ventas a distancia (Decreto 1074 de 2015, arts. 2.2.2.37.x). La fecha exacta de la Ley 2439 de 2024 no se verificó **(pendiente de verificación)**. Una oferta habitual de pago exigiría además inscripción en el registro mercantil, RUT, facturación electrónica y una revisión tributaria con un contador **(pendiente de verificación)**.

### 5.4 Jurisdicción, competencia y arbitraje

- **Competencia territorial.** El Código General del Proceso fija como fuero general el domicilio del demandado y, en los procesos contractuales, también el lugar de cumplimiento; además, "la estipulación de domicilio contractual para efectos judiciales se tendrá por no escrita" (Ley 1564 de 2012, art. 28, nums. 1 y 3). Una cláusula que fije, por ejemplo, "los jueces de Bogotá" como foro exclusivo es ineficaz.
- **Acción de protección al consumidor.** El consumidor puede acudir a la SIC, con competencia en todo el territorio y a prevención con los jueces, o al juez del lugar donde se realizó la relación de consumo (Ley 1480 de 2011, art. 58). Una cláusula que restrinja esas opciones caería también bajo el artículo 42.
- **Arbitraje.** El numeral 12 del artículo 43 de la Ley 1480, que calificaba como abusivas las cláusulas compromisorias, fue derogado por el artículo 118 de la Ley 1563 de 2012. No existe hoy una prohibición expresa, pero un pacto arbitral obligatorio en un contrato de adhesión gratuito probablemente se consideraría abusivo bajo el artículo 42, porque afecta el lugar y el modo de ejercer los derechos. No se encontró una decisión de la SIC o de la Corte sobre el punto **(pendiente de verificación)**.

En consecuencia, los términos de Cogni para usuarios se rigen por la ley colombiana, no incluyen arbitraje obligatorio, renuncia a acciones colectivas ni foro exclusivo, preservan la competencia de la SIC y ofrecen una etapa amistosa voluntaria. El arbitraje solo se contempla como opción en las condiciones institucionales entre empresas o instituciones (sección 13).

## 6. Mensajes comerciales: Ley 2300 de 2023

La Ley 2300 de 2023, vigente desde el 10 de octubre de 2023, regula los canales, horarios y periodicidad del contacto con consumidores. Sus artículos 1 a 3 se dirigen a la cobranza y fijan el horario de contacto de lunes a viernes de 7:00 a. m. a 7:00 p. m. y sábados de 8:00 a. m. a 3:00 p. m., sin contactos los domingos ni festivos. El artículo 5 extiende las reglas al envío de mensajes publicitarios por SMS, aplicaciones o web, correo electrónico y llamadas (Ley 2300 de 2023, arts. 3 y 5). Tres reglas del artículo 5 son relevantes:

- **Parágrafo segundo, mensajes relacionados con el servicio.** No puede obligarse al consumidor a aceptar mensajes comerciales "salvo aquellos asuntos estrictamente relacionados con el bien o servicio adquirido". Este es el fundamento legal para tratar los correos transaccionales (verificación de la cuenta, restablecimiento de contraseña, avisos sobre el servicio) como ajenos al régimen de aceptación previa, lo que resuelve en buena medida la duda que el borrador anterior marcaba como no verificada.
- **Parágrafo segundo, bases de datos alimentadas por promociones.** Requieren que el consumidor lo sepa y lo acepte de manera explícita, y un mecanismo "ágil, sencillo y eficiente" para cancelar la recepción en cualquier momento.
- **Parágrafo tercero, horarios.** Los mensajes publicitarios, incluido el correo electrónico, solo pueden enviarse dentro de los horarios del artículo 3.

Combinada con la Ley 1581, la publicidad es una finalidad distinta que requiere un consentimiento separado y no marcado por defecto, un enlace de cancelación y una programación en hora colombiana dentro de los horarios legales. Si los recordatorios de repaso buscaran promover el uso en lugar de prestar el servicio contratado, convendría tratarlos como publicidad; no se encontró doctrina de la SIC sobre el punto **(pendiente de verificación)**. A la fecha de corte, Cogni no envía correos publicitarios ni opera una lista de espera; la obligación es condicional.

## 7. Propiedad intelectual

### 7.1 Contenido aportado por los usuarios

La Ley 23 de 1982 protege las obras literarias, científicas y artísticas y concede al autor el derecho exclusivo de reproducción "permanente o temporal [...] incluyendo el almacenamiento temporal en forma electrónica" y de puesta a disposición del público (Ley 23 de 1982, art. 12, modificado por la Ley 1915 de 2018, art. 3). La Decisión Andina 351 de 1993, de aplicación directa y preferente, define al autor como la "persona física que realiza la creación intelectual" (Decisión 351 de 1993, art. 3). Los PDF, DOCX y PPTX que importan los usuarios pueden ser obras de terceros (libros, artículos, diapositivas docentes), y las notas que escriben suelen ser obras propias.

Cogni no publica ni distribuye esos contenidos: los almacena en un espacio privado de cada usuario y los procesa para producir material de estudio personal. Aun así, el almacenamiento persistente y el envío del texto a los proveedores de IA son actos de reproducción. Las excepciones legales no los cubren:

- La Decisión 351 somete toda excepción a la regla de los tres pasos: no atentar contra la normal explotación de la obra ni causar un perjuicio injustificado a los legítimos intereses del titular (art. 21). La excepción educativa del artículo 22, literal b), se limita a la reproducción reprográfica de artículos o breves extractos para la enseñanza o exámenes **en instituciones educativas**, sin fines de lucro (Decisión 351 de 1993, arts. 21 y 22). Cogni no es una institución educativa y procesa documentos completos.
- La copia privada de la Ley 23 de 1982 ampara un solo ejemplar realizado por el propio interesado para su uso privado y sin fines de lucro (art. 37); respalda la copia del usuario, no el procesamiento por Cogni. La ilustración para la enseñanza del artículo 32 se refiere a publicaciones o emisiones sin fines de lucro y tampoco encaja.
- La excepción de reproducción electrónica temporal se limita a copias "transitoria[s] o accesoria[s]" que forman parte de un proceso tecnológico (Ley 1915 de 2018, art. 16, lit. a); cubre memorias caché, no el almacenamiento persistente ni el envío a un proveedor de IA.

La vía adecuada es, por tanto, **contractual**: el usuario conserva la titularidad de su contenido, declara que tiene derecho a usar el material que importa o que lo hace para su estudio personal, y otorga a Cogni una licencia limitada, no exclusiva, gratuita y revocable, solo para almacenarlo, procesarlo y enviarlo a los proveedores de IA con el fin de prestar el servicio, que termina con la eliminación del contenido. Se descarta expresamente el modelo de licencias perpetuas e irrevocables que incluyen el entrenamiento de IA, como el de Knowt (Knowt, 2025).

### 7.2 Procedimiento de notificación y retiro

Colombia no tiene un régimen legal de puerto seguro ni de notificación y retiro para los proveedores de alojamiento; no se encontró en la Ley 1915 de 2018 **(pendiente de verificación, por tratarse de una afirmación negativa)**. Aun así, un procedimiento contractual de notificación y retiro, contranotificación y terminación de cuentas de infractores reiterados demuestra diligencia, y coincide con las buenas prácticas del artículo 512 de la ley de derechos de autor de Estados Unidos (*Digital Millennium Copyright Act*, DMCA) y del artículo 16 del Reglamento de Servicios Digitales de la Unión Europea (Legal Information Institute, s. f.-a; Reglamento (UE) 2022/2065, art. 16). Cogni lo adopta en su política de derechos de autor. El registro de un agente designado ante la Oficina de Derechos de Autor de Estados Unidos solo se justificaría si el número de usuarios en ese país fuera significativo.

### 7.3 Contenido generado por IA

La Dirección Nacional de Derecho de Autor (DNDA) sostiene que los productos de la IA "no son susceptibles de inscripción en el Registro Nacional del Derecho de Autor", que "solo son protegidas como obras la[s] creaciones producto de la inteligencia humana" y que "solo las personas físicas son reconocidas como autores". La DNDA enumera las resoluciones en que ha aplicado ese criterio: en 2023, las resoluciones 095, 137, 147, 185 y 421; en 2024, las resoluciones 139, 143, 144, 262 y 263; y en 2025, las resoluciones 042, 055, 058, 069, 079, 133, 152, 153 y 154 (Dirección Nacional de Derecho de Autor [DNDA], s. f.). El contenido de la Resolución 154 de 2025, difundida por la prensa como el caso de las "52 imágenes", solo se conoció por fuentes secundarias **(pendiente de verificación)**.

En consecuencia, las tarjetas, preguntas, exámenes y retroalimentaciones generados probablemente no son obras protegidas en cabeza de Cogni ni del usuario, salvo una intervención creativa humana suficiente. Los términos indican que el material generado se entrega para el estudio del usuario, que Cogni no reclama autoría sobre él y que no garantiza su exactitud. En el plano contractual, Cloudflare reconoce al cliente la titularidad de entradas y salidas, y Groq se obliga a no usarlas para entrenar modelos sin permiso (Cloudflare, 2026a; Groq, 2026).

### 7.4 Software y titularidad del trabajo de grado

Los programas de ordenador "se protegen en los mismos términos que las obras literarias", tanto en código fuente como en código objeto (Decisión 351 de 1993, art. 23). El artículo 20 de la Ley 23 de 1982, modificado por el artículo 28 de la Ley 1450 de 2011, presume la transferencia de los derechos patrimoniales al encargante o empleador solo cuando la obra se crea en cumplimiento de un contrato de prestación de servicios o de trabajo, y "para que opere esta presunción se requiere que el contrato conste por escrito". El artículo 336 de la Ley 1955 de 2019 no derogó expresamente esa disposición. Un estudiante que desarrolla su trabajo de grado no está, en principio, en ninguno de esos supuestos, por lo que conserva los derechos patrimoniales y morales sobre el software y el documento, sin perjuicio del reglamento de propiedad intelectual de su universidad (Constitución Política de Colombia, 1991, art. 69) y de las licencias de depósito que firme. Se recomienda revisar ese reglamento antes de la entrega.

## 8. Delitos informáticos y deberes de seguridad

La Ley 1273 de 2009 creó el bien jurídico "de la protección de la información y de los datos" y tipificó, entre otros, el acceso abusivo a un sistema informático (art. 269A), la interceptación de datos informáticos (art. 269C), el daño informático (art. 269D), el uso de software malicioso (art. 269E), la violación de datos personales (art. 269F) y la suplantación de sitios web para capturar datos personales (art. 269G) (Ley 1273 de 2009). El artículo 269F sanciona con prisión de 48 a 96 meses y multa de 100 a 1.000 salarios mínimos a quien, "sin estar facultado para ello, con provecho propio o de un tercero", obtenga, compile, sustraiga, ofrezca, venda, intercambie, envíe o use datos personales. La ley protege la plataforma frente a ataques de terceros y, a la vez, refuerza la importancia de contar con una autorización válida y documentada.

Los deberes de seguridad se derivan del régimen de datos: el principio de seguridad (Ley 1581 de 2012, art. 4, lit. g), el deber de conservar la información "bajo las condiciones de seguridad necesarias" (art. 17, lit. d) y el de informar a la SIC cuando se presenten violaciones a los códigos de seguridad y existan riesgos en la administración de la información (art. 17, lit. n). La Circular Externa 002 de 2024 añade que las medidas de seguridad en sistemas de IA "deben ser auditables por las autoridades" (SIC, 2024, instrucción VIII).

Cogni aplica seguridad a nivel de fila en la base de datos, almacenamiento privado por usuario, cabeceras de seguridad (política de seguridad de contenido con *nonce*, `X-Frame-Options: DENY`, `nosniff`, política de referente estricta y política de permisos) y registro de errores sin datos personales por defecto. Como buena práctica no vinculante, la guía NIST SP 800-63B-4 recomienda una longitud mínima de 15 caracteres para contraseñas usadas como único factor (8 si forman parte de una autenticación multifactor), admitir al menos 64 caracteres, no imponer reglas de composición ni cambios periódicos y contrastar las contraseñas con listas de valores comprometidos (National Institute of Standards and Technology [NIST], 2025). Cogni exige hoy un mínimo de 8 caracteres sin segundo factor.

## 9. Mayoría de edad y restricción a mayores de 18 años

En Colombia es mayor de edad quien ha cumplido dieciocho años (Ley 27 de 1977, art. 1); el texto se confirmó en copias institucionales y no en la Secretaría del Senado **(pendiente de verificación)**. El Código de la Infancia y la Adolescencia considera sujetos titulares de sus derechos a "todas las personas menores de 18 años" y presume la minoría de edad en caso de duda (Ley 1098 de 2006, art. 3).

La Ley 2489 de 2025, sobre "entornos digitales sanos y seguros para los niños, niñas y adolescentes", es una ley marco de política: su artículo 9 dispone que el Gobierno "articulará acciones para que la industria del software contribuya" a la protección de los menores, y su artículo 4 menciona herramientas de "autenticación o verificación de edad" para los padres. Su texto no impone deberes directos y sancionables a una plataforma privada (Ley 2489 de 2025). Se reporta que el Decreto 769 del 16 de julio de 2026 la reglamenta, pero su texto no pudo consultarse **(pendiente de verificación)**; conviene revisar si impone deberes de verificación de edad a plataformas con probabilidad de acceso por menores.

La decisión del 28 de octubre de 2026 de restringir Cogni a mayores de 18 años, sin flujo de consentimiento parental, se justifica por cinco razones concurrentes:

1. **Régimen de datos de menores.** El tratamiento de datos de menores exige interés superior, autorización del representante legal y el derecho del menor a ser escuchado (sección 3.9). Un proyecto individual no cuenta con mecanismos para verificar la representación legal.
2. **Capacidad para contratar.** La aceptación de los términos es un acto jurídico que exige capacidad plena.
3. **Condiciones de los proveedores.** Gemini exige 18 años y prohíbe aplicaciones dirigidas o con probabilidad de ser usadas por menores de 18; Groq, OpenRouter y Cloudflare también exigen la mayoría de edad o hacen responsable al cliente de la protección de menores (Google, 2026; Groq, 2026; OpenRouter, 2026).
4. **Contexto regulatorio en evolución.** La Ley 2489 de 2025 y su reglamentación orientan a la industria hacia la verificación de edad; un servicio solo para adultos con un filtro de edad es la postura más segura.
5. **Público objetivo.** Las funciones están pensadas para estudiantes de educación superior.

**Mecanismo de verificación.** El sistema actual pide marcar una casilla que dice "Confirmo que tengo 18 años o más y acepto los términos de uso". Esa autodeclaración agrupa la declaración de edad con la aceptación de los términos y revela la respuesta esperada. La Comisión Federal de Comercio de Estados Unidos recomienda que el filtro de edad sea neutral: que permita indicar la edad con exactitud, no incentive la falsedad e impida volver atrás para indicar otra edad (Federal Trade Commission [FTC], s. f.). Aunque la regla COPPA no se aplica a Cogni (sección 11.3), la recomendación es trasladable: pedir la fecha de nacimiento sin indicar el umbral, bloquear el registro de menores y, por minimización, guardar solo el resultado de la verificación y su fecha.

## 10. Inteligencia artificial

### 10.1 Circular Externa 002 de 2024 de la SIC

El 21 de agosto de 2024, la SIC expidió la Circular Externa 002, dirigida a los sujetos vigilados en su rol de autoridad de protección de datos, con el asunto "Lineamientos sobre el Tratamiento de Datos personales en Sistemas de Inteligencia Artificial" (SIC, 2024). La circular parte de que las leyes estatutarias 1266 de 2008 y 1581 de 2012 son "normas neutrales temática y tecnológicamente" que se aplican al tratamiento de datos para desarrollar, probar, monitorear o implementar sistemas de IA. Sus instrucciones son:

- **I.** El tratamiento "presupone la necesidad de realizar una ponderación" con cuatro criterios: idoneidad, necesidad, razonabilidad y proporcionalidad en sentido estricto.
- **II.** Ante la falta de certeza sobre los daños potenciales, debe abstenerse del tratamiento o adoptar medidas precautorias.
- **III.** La identificación y clasificación de riesgos son elementos esenciales de la responsabilidad demostrada.
- **IV.** "Previo al diseño y desarrollo de la IA, y en la medida en que sea probable que los productos [...] entrañen un alto riesgo", debe efectuarse un estudio de impacto de privacidad con, al menos, la descripción de las operaciones, la evaluación de riesgos y las medidas de mitigación.
- **V.** Los datos deben ser veraces, completos, exactos, actualizados, comprobables y comprensibles.
- **VI.** La privacidad diferencial se menciona como técnica de privacidad desde el diseño.
- **VII.** El titular tiene derecho a obtener información sobre el tratamiento en cualquier momento.
- **VIII.** Las medidas de seguridad deben ser auditables por las autoridades.
- **IX.** La información accesible al público no es por ello de naturaleza pública.
- **X.** El tratamiento debe prever estrategias pertinentes, eficientes y demostrables para garantizar los derechos de los titulares.

No se encontró una circular posterior de la SIC específica sobre IA en 2025 y 2026.

**Aplicación a Cogni.** Cogni usa modelos de terceros y no entrena modelos propios. La finalidad no es perfilar ni tomar decisiones sobre personas, sino transformar contenido académico en material de estudio. Aun así, el contenido puede incluir datos personales incidentales y uno de los proveedores en nivel gratuito lo usa para sus propios fines. El estudio de impacto completo solo es obligatorio cuando el alto riesgo es "probable", lo que no parece ser el caso; se recomienda, de todos modos, documentar una evaluación breve de dos o tres páginas con la ponderación de los cuatro criterios, los riesgos (uso del contenido por el proveedor, inexactitud del contenido generado, datos sensibles incidentales) y las medidas (advertencias, minimización, ausencia de identificadores de cuenta en las instrucciones al modelo, límites de uso).

### 10.2 Política pública y proyectos de ley en Colombia

El documento CONPES 4144, "Política Nacional de Inteligencia Artificial", fue aprobado el 14 de febrero de 2025 (Consejo Nacional de Política Económica y Social [CONPES], 2025). Es un instrumento de política pública y no impone obligaciones a particulares.

El Proyecto de Ley 043 de 2025 Senado y 324 de 2025 Cámara, radicado por el Gobierno para regular la IA, fue archivado por tránsito de legislatura el 20 de junio de 2026 según el registro de Congreso Visible (Congreso Visible, s. f.), lo que es coherente con el artículo 162 de la Constitución. El archivo no se confirmó en la Gaceta del Congreso **(pendiente de verificación)**. El 21 de julio de 2026 se radicó el Proyecto de Ley 025 de 2026 Cámara, "por medio de la cual se regula la inteligencia artificial en Colombia para garantizar su desarrollo ético y responsable", con un enfoque basado en riesgo (Cámara de Representantes, 2026). Es un proyecto en trámite que no crea obligaciones. No hay una ley de IA vigente en Colombia a la fecha de corte; al tratarse de una afirmación negativa, no es verificable en una fuente oficial consolidada **(pendiente de verificación)**.

A falta de normas específicas, el deber de etiquetar el contenido generado por IA y de advertir su posible inexactitud se apoya en la descripción adecuada del servicio (Ley 1480 de 2011, art. 50, lit. b), en el principio de veracidad (Ley 1581 de 2012, art. 4, lit. d) y en las políticas de los proveedores de modelos (sección 12).

### 10.3 Reglamento Europeo de Inteligencia Artificial como referencia

El Reglamento (UE) 2024/1689 se aplica, entre otros, a los proveedores y responsables del despliegue de terceros países cuando la salida del sistema "se utilice en la Unión" (Reglamento (UE) 2024/1689, art. 2.1.c). Al integrar modelos de terceros en un sistema propio que pone en servicio con su nombre, Cogni sería proveedor de un sistema de IA y no solo responsable del despliegue.

El calendario fue modificado por el Reglamento (UE) 2026/1744 (*Digital Omnibus* sobre IA), publicado en el Diario Oficial el 24 de julio de 2026 y en vigor desde el 27 de julio de 2026 (Nicfab, 2026; White & Case, 2026). Según esas fuentes, el texto oficial no pudo consultarse en EUR-Lex **(pendiente de verificación)**:

| Fecha | Obligación |
|---|---|
| 2 de febrero de 2025 | Prácticas prohibidas (art. 5) |
| 2 de agosto de 2025 | Modelos de IA de uso general, gobernanza y sanciones |
| 27 de julio de 2026 | Nueva redacción del art. 4: "adoptar medidas para apoyar" la alfabetización en IA |
| 2 de agosto de 2026 | Aplicación general, incluidas las obligaciones de transparencia del art. 50 |
| 2 de diciembre de 2026 | Fin del período de gracia para el marcado legible por máquina del art. 50.2 en sistemas comercializados antes del 2 de agosto de 2026 |
| 2 de diciembre de 2027 | Sistemas de alto riesgo del anexo III (antes 2 de agosto de 2026) |
| 2 de agosto de 2028 | Sistemas de alto riesgo del anexo I |

El anexo III, punto 3, califica como de alto riesgo los sistemas destinados a determinar el acceso o la admisión a instituciones educativas, a "evaluar los resultados del aprendizaje, también cuando dichos resultados se utilicen para orientar el proceso de aprendizaje", a evaluar el nivel educativo adecuado y a detectar comportamientos prohibidos durante los exámenes (Reglamento (UE) 2024/1689, anexo III). Los cuestionarios de práctica autodirigidos por un adulto fuera de una institución no encajan en ese punto. El riesgo aparecería con licencias institucionales en las que una universidad usara la evaluación con IA para calificar o para orientar el aprendizaje de sus estudiantes; incluso entonces, el artículo 6.3 permite documentar que el sistema no es de alto riesgo cuando realiza una tarea procedimental o preparatoria que no influye sustancialmente en el resultado **(pendiente de verificación del texto del art. 6.3)**. Por eso, las condiciones institucionales de Cogni limitan el uso a la práctica formativa y prohíben su uso para evaluación sumativa, admisión o decisiones sobre estudiantes.

**Aplicabilidad a Cogni.** Cogni no se ofrece en la Unión Europea y sus términos excluyen el Espacio Económico Europeo, el Reino Unido y Suiza, por lo que el reglamento no le es aplicable. Se adopta el artículo 50 como buena práctica: la interfaz debe identificar el contenido generado por IA y advertir que puede contener errores.

## 11. Normativa internacional aplicable o de referencia

### 11.1 Unión Europea

**Reglamento General de Protección de Datos (RGPD).** Se aplica a responsables no establecidos en la Unión cuando el tratamiento se relaciona con la oferta de bienes o servicios a interesados en la Unión, pagados o no (art. 3.2.a), o con el control de su comportamiento en la Unión (art. 3.2.b) (Reglamento (UE) 2016/679). El considerando 23 aclara que la mera accesibilidad del sitio web no basta y menciona como indicios el uso de "una lengua o una moneda utilizada generalmente en uno o varios Estados miembros" con posibilidad de encargar bienes y servicios en esa lengua, o la mención de clientes en la Unión. Las Directrices 3/2018 del Comité Europeo de Protección de Datos (versión 2.1 del 12 de noviembre de 2019) desarrollan esos factores (European Data Protection Board [EDPB], 2019).

El borrador anterior omitía un matiz: el español **sí** es una lengua de uso general en un Estado miembro (España). El argumento de no aplicabilidad debe apoyarse, por tanto, en otra frase del mismo considerando: el uso de una lengua "generalmente utilizada en el tercer país en el que esté establecido el responsable" es insuficiente por sí solo, y el español es la lengua de Colombia. A ello se suman la ausencia de euros, de dominios y de referencias europeas, y la exclusión expresa del Espacio Económico Europeo, el Reino Unido y Suiza. El segundo criterio, el control del comportamiento, exige según el considerando 24 un seguimiento en internet con fines como la elaboración de perfiles; la analítica de producto de PostHog sobre un visitante situado en la Unión es un desencadenante débil, pero no nulo. Con estas condiciones, **el RGPD no es aplicable**; un bloqueo geográfico y una analítica mínima y consentida mantienen remoto el riesgo. Si alguna vez se aplicara, el artículo 27 exigiría designar un representante en la Unión, porque el tratamiento de Cogni no es ocasional.

El RGPD sirve como referencia para las bases jurídicas (art. 6), la información al interesado (art. 13), los contratos con encargados (art. 28) y las transferencias (arts. 44 a 49). El marco de privacidad de datos entre la Unión y Estados Unidos (Decisión (UE) 2023/1795) sigue vigente; la desestimación de la demanda de anulación en el asunto *Latombe* (3 de septiembre de 2025) se conoce por fuentes secundarias **(pendiente de verificación)**. Colombia no cuenta con una decisión de adecuación de la Unión.

**Directiva sobre la privacidad y las comunicaciones electrónicas (2002/58/CE), art. 5.3.** Almacenar o leer información en el equipo del usuario requiere consentimiento previo, salvo que sea estrictamente necesario para el servicio solicitado. Las cookies de sesión son necesarias; la persistencia de PostHog requiere consentimiento. Se usa como referencia para la política de cookies; la redacción no se cotejó en EUR-Lex **(pendiente de verificación)**.

**Reglamento de Servicios Digitales (Reglamento (UE) 2022/2065).** Solo se aplica a intermediarios con una "conexión sustancial" con la Unión (art. 3). No es aplicable a Cogni. Si lo fuera, Cogni sería un servicio de alojamiento de datos, no una plataforma en línea, con deberes de puntos de contacto, representante legal, condiciones claras, mecanismo de notificación y acción (art. 16) y declaración de motivos (art. 17). Cogni toma como buena práctica la notificación y acción y la declaración de motivos.

**Acta Europea de Accesibilidad (Directiva (UE) 2019/882).** Aplicable desde el 28 de junio de 2025 a ciertos productos y servicios, con exención para microempresas prestadoras de servicios **(pendiente de verificación)**. No es aplicable a Cogni.

### 11.2 América Latina

| Jurisdicción | Instrumento | Criterio extraterritorial | Situación de Cogni |
|---|---|---|---|
| Brasil | Lei 13.709/2018 (LGPD), art. 3 | Oferta de bienes o servicios o tratamiento de datos de personas ubicadas en Brasil | No aplicable mientras no se ofrezca en Brasil; el texto oficial no pudo consultarse **(pendiente de verificación)** |
| México | Nueva LFPDPPP, publicada el 20 de marzo de 2025, en vigor desde el 21 de marzo de 2025; supervisión trasladada a la Secretaría Anticorrupción y Buen Gobierno | Aplicación en el territorio nacional; no se confirmó una cláusula de oferta dirigida | No aplicable; referencia regional |
| Chile | Ley 21.719, publicada el 13 de diciembre de 2024, en vigor desde el 1 de diciembre de 2026 (un proyecto propone aplazarla a 2027) | Según fuentes secundarias, alcanza a responsables extranjeros que ofrezcan bienes o servicios o monitoreen a personas en Chile **(pendiente de verificación)** | No aplicable salvo que se dirija a Chile |
| Perú | Ley 29733 y nuevo reglamento (D. S. 016-2024-JUS) | No verificado **(pendiente de verificación)** | No aplicable; referencia |
| Argentina | Ley 25.326 | Sin cláusula extraterritorial expresa **(pendiente de verificación)** | No aplicable; referencia |
| Iberoamérica | Estándares de Protección de Datos Personales de la Red Iberoamericana (2017) | Derecho blando | Referencia de buenas prácticas |

Todos estos regímenes usan un criterio de "dirección" o de "ubicación en el territorio" similar al europeo. Un sitio en español es más plausiblemente "dirigido" a países hispanohablantes de América Latina que a la Unión Europea. Por eso, los términos de Cogni declaran que el servicio está dirigido a personas en Colombia, y se recomienda mantener la comunicación y el soporte centrados en Colombia hasta contar con un plan de cumplimiento para otros países.

### 11.3 Estados Unidos

- **COPPA** (15 U.S.C. § 6501 y ss.; 16 C.F.R. parte 312). Se aplica a servicios dirigidos a menores de 13 años o con conocimiento efectivo. La regla enmendada entró en vigor el 23 de junio de 2025 con fecha de cumplimiento del 22 de abril de 2026, según fuentes secundarias **(pendiente de verificación)**. No es aplicable a un servicio para adultos con filtro de edad; se mantiene la supresión de cuentas cuando se conozca que pertenecen a un menor.
- **CCPA/CPRA** (Cal. Civ. Code § 1798.140). Se aplica a empresas con ánimo de lucro que superan ciertos umbrales, entre ellos ingresos brutos anuales superiores a USD 26 625 000 desde el 1 de enero de 2025 (California Privacy Protection Agency, s. f.). No es aplicable.
- **FERPA** (20 U.S.C. § 1232g; 34 C.F.R. § 99.31). Solo relevante para contratos con instituciones estadounidenses: un proveedor puede recibir registros educativos como "funcionario escolar" si presta un servicio que la institución haría con sus empleados, está bajo su control directo en el uso y mantenimiento de los registros y respeta los límites de redivulgación (Legal Information Institute, s. f.-b). Como el uso de proveedores gratuitos que aprovechan el contenido es incompatible con ese control directo, un plan institucional para instituciones estadounidenses exigiría proveedores de IA de pago que no usen los datos. Aplicación condicional.
- **CAN-SPAM** (15 U.S.C. § 7701 y ss.). Se aplica a correos comerciales dirigidos a destinatarios en Estados Unidos con independencia del país del remitente. Aplicación condicional, solo si hay correos publicitarios a esos destinatarios.
- **DMCA, art. 512(c).** Puerto seguro para el alojamiento de contenido de usuarios, sujeto a retiro expedito, agente designado y política de infractores reiterados (17 U.S.C. § 512). Protección opcional (sección 7.2).
- **Sección 230** (47 U.S.C. § 230). Inmunidad frente al contenido de terceros en tribunales estadounidenses; no cubre la propiedad intelectual y es dudoso que cubra el contenido que genera la propia IA del servicio **(pendiente de verificación)**. Referencia.
- **Ley de privacidad de las comunicaciones de California (CIPA).** Hay litigios masivos por grabación de sesiones y píxeles de analítica. Cogni tiene apagada la grabación de sesiones y la captura de consola, por lo que el riesgo residual es muy bajo. Referencia.
- **Leyes estatales de IA.** La ley de IA de Colorado de 2024 (SB 24-205) fue derogada y reemplazada por la SB 26-189, firmada el 14 de mayo de 2026, centrada en decisiones automatizadas consecuenciales (Colorado General Assembly, 2026). Cogni no toma decisiones consecuenciales; no es aplicable.

## 12. Obligaciones contractuales con proveedores

Los términos de los proveedores son obligaciones contractuales que el Responsable acepta al usar sus servicios. Su incumplimiento puede ocasionar la suspensión del servicio y, frente a los titulares, comprometer el principio de seguridad y el deber de informar. Varias de ellas deben trasladarse a los usuarios.

### 12.1 Google Gemini API

Los Términos Adicionales de la API de Gemini, vigentes desde el 23 de marzo de 2026 y actualizados el 28 de abril de 2026, establecen (Google, 2026):

- **Edad:** el usuario de las API debe tener 18 años o más, y no se pueden crear aplicaciones dirigidas o con probabilidad de ser usadas por menores de 18 años.
- **Regiones:** solo pueden usarse servicios pagos cuando se ofrecen clientes de la API a usuarios en el Espacio Económico Europeo, Suiza o el Reino Unido, y solo pueden ofrecerse dentro de las regiones disponibles.
- **Uso de datos en servicios no pagos:** Google usa el contenido enviado y las respuestas generadas para prestar, mejorar y desarrollar sus productos, y revisores humanos pueden leerlo.
- **Prohibición de datos personales:** "Do not submit sensitive, confidential, or personal information to the Unpaid Services."
- **Servicios pagos:** solo cuando se accede mediante un proyecto de Cloud con una cuenta de facturación activa; en ese caso Google no usa las solicitudes ni las respuestas para mejorar sus productos.
- **Uso profesional:** los servicios son para fines profesionales o comerciales, no de consumo. La cláusula vincula a Cogni como cliente de la API y es compatible con su uso para operar un servicio.
- **Uso prohibido:** se incorpora la Política de Uso Prohibido de IA Generativa de Google, que veda, entre otros, presentar contenido generado por IA como hecho solo por humanos para engañar (Google, 2024).

**Análisis.** La edad y la exclusión regional están recogidas en los términos de Cogni, pero la exclusión carece de control técnico. La cláusula de datos personales es la más problemática: el contenido que envía Cogni (notas, documentos importados y respuestas escritas) puede contener datos personales, aunque no se envían identificadores de cuenta. Los términos trasladan al usuario la carga de no incluir datos sensibles ni de terceros, pero la cláusula de Google prohíbe cualquier información personal, incluso los datos no sensibles del propio usuario. **El uso del nivel gratuito de Gemini con contenido libre presenta un riesgo contractual que las advertencias no eliminan.** Las alternativas son migrar Gemini a un nivel pago, relegarlo y priorizar proveedores que no usan los datos (Groq, Cloudflare), o depurar automáticamente los datos personales antes del envío, lo que reduce el riesgo sin eliminarlo.

### 12.2 Groq

El acuerdo de servicios de Groq, modificado el 22 de junio de 2026, exige 18 años (sec. 2); hace al cliente responsable de sus usuarios autorizados (sec. 3.2) y de las salidas y su exactitud (sec. 4.2); prohíbe a Groq usar entradas o salidas para entrenar modelos sin permiso (sec. 4.2); dispone que, si la aplicación es "likely to reach minors", el cliente asume solo el cumplimiento (sec. 6.3); e incorpora un DPA que prevalece (secs. 3.4 y 17.11) (Groq, 2026). Su política de uso aceptable debe trasladarse a los usuarios. El modelo `openai/gpt-oss-120b` se distribuye con licencia Apache 2.0, cuyas condiciones se refieren a la reproducción y distribución de copias, de modo que su uso mediante una API no genera obligaciones de aviso. La política de uso de OpenAI para gpt-oss no se verificó **(pendiente de verificación)**.

### 12.3 Cloudflare Workers AI y Llama 3.3

Las condiciones específicas de la plataforma de desarrolladores de Cloudflare, actualizadas el 28 de septiembre de 2026, califican los modelos como productos de terceros, obligan a cumplir sus licencias y políticas de uso aceptable y hacen al cliente "solely responsible" de las salidas y de los actos de sus usuarios finales. Cloudflare no usa el contenido procesado por Workers AI para entrenar modelos y no conserva entradas ni salidas después de la solicitud, salvo que se active el registro de AI Gateway (Cloudflare, 2026a, 2026b). El modelo es `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, sujeto a la licencia comunitaria de Llama 3.3 y a su política de uso aceptable, que prohíbe, entre otros, el uso ilegal, la violación de la privacidad, la infracción de propiedad intelectual y presentar salidas de IA como hechas por humanos, y obliga a "appropriately disclose to end users any known dangers of your AI system" (Meta, s. f.). De ahí deriva el deber de Cogni de advertir los riesgos conocidos (inexactitud, sesgo). La obligación de mostrar la atribución "Built with Llama" en un servicio alojado no se verificó en esta revisión **(pendiente de verificación)**; se adopta como precaución de bajo costo.

### 12.4 OpenRouter

Los términos de OpenRouter, actualizados el 31 de agosto de 2026, exigen 18 años, obligan al cliente a exigir que sus usuarios usen el servicio y los modelos conforme a esos términos y a los de cada modelo (secs. 5.1 y 5.2), y hacen al cliente "solely responsible" de sus incumplimientos (sec. 5.5). Ciertos proveedores pueden conservar o entrenar con las entradas; si se desactiva el entrenamiento en la configuración de la cuenta, OpenRouter no enruta a proveedores que entrenan, con ajustes separados para modelos gratuitos y de pago (OpenRouter, 2026; OpenRouter, s. f.). Los términos se rigen por la ley de Nueva York con arbitraje y renuncia a acciones colectivas, lo que vincula a Cogni como cliente, no a sus usuarios. A la fecha de corte, los dos modelos gratuitos configurados en Cogni no tienen proveedores que los sirvan, por lo que deben sustituirse o retirarse, verificando la política de datos del nuevo proveedor.

### 12.5 Encargados de infraestructura

| Proveedor | Situación del contrato de transmisión | Fuente |
|---|---|---|
| Supabase | DPA versión 1 del 1 de agosto de 2026, incorporado a los términos de servicio, con cláusulas contractuales tipo de la Unión; región de datos elegida por el cliente | Supabase (2026) |
| Vercel (Hobby) | Sin DPA: solo para planes Pro y Enterprise (vigente desde el 31 de marzo de 2026). Las pautas de uso justo limitan el plan Hobby a uso personal no comercial, compatible con un proyecto académico gratuito | Vercel (2026); Vercel (s. f.) |
| PostHog | DPA disponible en el plan gratuito, autogenerado desde la aplicación; debe generarse y archivarse | PostHog (s. f.) |
| Sentry | DPA efectivo solo desde su aceptación electrónica; tratamiento en Estados Unidos y otros países | Sentry (s. f.) |
| Upstash | DPA incorporado a los términos (abril de 2025), con cláusulas tipo y marco de privacidad | Upstash (2025) |
| Google (inicio de sesión) | Responsable independiente para el inicio de sesión con Google; se aplica su política de datos de usuario de las API **(pendiente de verificación)** | — |

## 13. Educación superior y licencias institucionales

Las universidades estatales son entes universitarios autónomos con régimen especial, y sus contratos "se regirán por las normas del derecho privado", salvo los empréstitos (Ley 30 de 1992, arts. 57 y 93). Una licencia vendida a una universidad pública no se tramita, en general, bajo la Ley 80 de 1993, sino conforme al estatuto de contratación de la institución. La Ley 1150 de 2007, artículo 13, exige a las entidades con régimen especial aplicar los principios de la función administrativa y de la gestión fiscal y el régimen de inhabilidades e incompatibilidades, y es usual la publicación en el SECOP **(pendiente de verificación)**. Las universidades privadas contratan bajo el derecho civil y comercial.

Un acuerdo institucional cambia los roles del tratamiento: si la institución decide las finalidades (asigna estudiantes, consulta su progreso), se convierte en **Responsable** y Cogni en su **Encargado**, lo que exige un contrato de transmisión conforme al artículo 2.2.2.25.5.2 del Decreto 1074 de 2015. No se encontró una norma del Ministerio de Educación sobre plataformas educativas o integridad académica con IA que vincule a los proveedores **(pendiente de verificación, por tratarse de una afirmación negativa)**; esas reglas están en los estatutos de cada universidad. Las condiciones institucionales de Cogni recogen estas conclusiones e incluyen un anexo de tratamiento de datos, la limitación al uso formativo (sección 10.3), un arbitraje opcional y la advertencia de que, mientras sea un trabajo de grado, no hay compromisos de nivel de servicio.

## 14. Accesibilidad

La Ley Estatutaria 1618 de 2013 obliga a las entidades públicas de todos los órdenes a garantizar el acceso de las personas con discapacidad a la información y a las comunicaciones, y extiende el deber de diseño universal a las entidades públicas y privadas que prestan servicios públicos (Ley 1618 de 2013, art. 14). La Resolución 1519 de 2020 del MinTIC exige a los sujetos obligados por la Ley 1712 de 2014 (entidades públicas y particulares que cumplen funciones públicas o administran recursos públicos) cumplir el nivel AA de las Pautas de Accesibilidad para el Contenido Web (WCAG) desde el 1 de enero de 2022 (Ministerio de Tecnologías de la Información y las Comunicaciones [MinTIC], 2020); el detalle del anexo se consultó en fuentes secundarias **(pendiente de verificación)**.

Ninguna de estas normas vincula directamente a Cogni, que no es entidad pública ni presta un servicio público. Una universidad pública que licencie Cogni podría exigir contractualmente ese nivel. El proyecto adopta como estándar de calidad las WCAG 2.2 nivel AA, recomendación vigente del W3C desde octubre de 2023, que añade criterios como foco no oculto, tamaño mínimo de objetivo de 24 × 24 píxeles, alternativas al arrastre y autenticación accesible (World Wide Web Consortium [W3C], 2023). Su adopción como norma ISO/IEC 40500:2025 no se verificó **(pendiente de verificación)**. La Ley 1341 de 2009 fija principios generales del sector TIC, pero Cogni es una aplicación y no un proveedor de redes ni de servicios de telecomunicaciones, por lo que su régimen de habilitación no se le aplica.

## 15. Resumen de la matriz de cumplimiento

La matriz completa, con requisito, norma, estado, brecha, acción y prioridad, está en `docs/legal/matriz-de-cumplimiento.md`. Su resumen a la fecha de corte es el siguiente:

| Área | Estado | Brechas principales |
|---|---|---|
| Autorización de datos | Pendiente | Se pide después de recolectar el correo; falta una autorización separada para el envío a proveedores de IA |
| Política, aviso y procedimiento de derechos | Textos redactados; sin publicar | Publicar páginas y enlaces del pie; operar el procedimiento con plazos y la marca "reclamo en trámite" |
| Supresión y portabilidad | Parcial | Sin eliminación ni exportación en la aplicación; los archivos del almacenamiento no se borran al eliminar la cuenta |
| Contratos de transmisión | Parcial | Generar el DPA de PostHog, aceptar el de Sentry; Vercel Hobby no tiene DPA |
| Cookies y analítica | Pendiente | Sin aviso ni consentimiento para PostHog; desactivar la grabación de sesiones en el código |
| Proveedores de IA | Parcial | Gemini gratuito frente a la prohibición de datos personales; modelos de OpenRouter sin servicio; trasladar las políticas de uso |
| Consumidor y términos | Parcial | Actualizar el texto (DOCX y PPTX, respuestas de recordación, contacto, nueva versión); terminación tan fácil como el registro |
| Ámbito territorial | Parcial | Exclusión contractual sin bloqueo geográfico |
| Menores | Parcial | Filtro de edad no neutral |
| RNBD | No aplica | Persona natural |
| RGPD, Reglamento de IA, COPPA, CCPA, LGPD | No aplica | Mantener la exclusión territorial y la buena práctica |

## 16. Conclusiones

**Primera.** La Ley Estatutaria 1581 de 2012 y su reglamento, hoy compilado en el Decreto 1074 de 2015, son el núcleo normativo aplicable a Cogni. El desarrollador es el Responsable del Tratamiento y no está exento del régimen por tratarse de un proyecto académico ni gratuito; solo está exento de inscribir sus bases en el RNBD. La responsabilidad demostrada es proporcional a su tamaño, lo que permite un programa de cumplimiento ligero, pero documentado.

**Segunda.** La principal brecha está en el momento y el contenido de la autorización. El registro debe solicitarla antes de enviar el formulario y antes de redirigir a Google, con una casilla no marcada y separada de la aceptación de los términos, que identifique al Responsable, las finalidades, los derechos y el envío del contenido a proveedores de IA en el exterior. La prueba debe conservar la versión, el resumen criptográfico del texto, la fecha y el mecanismo.

**Tercera.** Este trabajo entrega la política de tratamiento, el aviso de privacidad, la política de cookies y el procedimiento de consultas y reclamos con los plazos legales (10 + 5 y 15 + 8 días hábiles). Publicarlos en la aplicación y operar el procedimiento cierra la mayoría de los pendientes de la matriz con un costo bajo.

**Cuarta.** El uso de proveedores de IA en niveles gratuitos es viable en Colombia, porque Estados Unidos figura en el listado de países adecuados de la SIC, pero genera dos tensiones. La contractual: Gemini prohíbe enviar información personal a su nivel gratuito y el contenido libre puede contenerla. La de transparencia: cuando el proveedor usa el contenido para sus fines, el envío es una transferencia que debe informarse y autorizarse de forma expresa. A ello se suma el deber de trasladar a los usuarios las políticas de uso de los modelos y de advertirles sus riesgos conocidos.

**Quinta.** El Estatuto del Consumidor se aplica con prudencia a un servicio gratuito ofrecido de forma habitual. En consecuencia, los términos no contienen exoneraciones generales de responsabilidad, arbitraje obligatorio, renuncia a acciones colectivas ni foro exclusivo, y la terminación debe ser tan sencilla como el registro.

**Sexta.** La vía para el contenido de los usuarios es contractual, porque ninguna excepción legal cubre su almacenamiento ni su envío a la IA: el usuario conserva la titularidad y otorga una licencia limitada, revocable y solo para operar el servicio. El material generado por IA no es registrable como obra según la DNDA.

**Séptima.** La restricción a mayores de 18 años está bien fundamentada en el derecho colombiano y en los términos de los proveedores, pero su mecanismo de verificación debe convertirse en un filtro de edad neutral, separado de la aceptación de los términos.

**Octava.** El RGPD, el Reglamento Europeo de IA, el Reglamento de Servicios Digitales, COPPA, CCPA, la LGPD y las demás leyes latinoamericanas no son aplicables a Cogni mientras mantenga su exclusión territorial y no se dirija a esos mercados; las normas colombianas de accesibilidad no lo vinculan. Todas sirven como referencias de buenas prácticas. Si Cogni ofrece licencias institucionales, la institución pasa a ser Responsable, el uso debe limitarse a la práctica formativa y los proveedores de IA deben ser de pago y sin uso de los datos.

**Novena.** Quedan puntos por verificar antes de la sustentación, listados en `docs/legal/README.md`: entre ellos, el archivo del Proyecto de Ley 043 de 2025 en la Gaceta, el texto del Decreto 769 de 2026, el plazo de prórroga de ocho días del artículo 15 en la fuente consultada, el texto oficial del Reglamento (UE) 2026/1744 y la atribución "Built with Llama".

## 17. Referencias

Asuntos Legales. (s. f.). *Conozca los aspectos legales que debe tener en cuenta al usar cookies en sitios web*. Recuperado el 15 de octubre de 2026, de https://www.asuntoslegales.com.co/consumidor/conozca-los-aspectos-legales-que-debe-tener-en-cuenta-al-usar-cookies-en-sitios-web-3375211

California Privacy Protection Agency. (s. f.). *Updated monetary thresholds in CCPA*. Recuperado el 28 de octubre de 2026, de https://cppa.ca.gov/regulations/cpi_adjustment.html

Cámara de Representantes. (2026). *Proyecto de Ley 025 de 2026 Cámara, por medio de la cual se regula la inteligencia artificial en Colombia para garantizar su desarrollo ético y responsable*. https://www.camara.gov.co/wp-content/uploads/2026/07/proyectos-ley/documentos/proyecto-36127/P.L.025-2026SC-INTELIGENCIA-ARTIFICIAL.pdf

Cloudflare. (2026a). *Service-specific terms: Developer platform* (actualización del 28 de septiembre de 2026). https://www.cloudflare.com/service-specific-terms-developer-platform/

Cloudflare. (2026b). *Workers AI: Privacy*. Recuperado el 28 de octubre de 2026, de https://developers.cloudflare.com/workers-ai/platform/privacy/

Código General del Proceso. Ley 1564 de 2012. 12 de julio de 2012. http://www.secretariasenado.gov.co/senado/basedoc/ley_1564_2012.html

Colorado General Assembly. (2026). *SB26-189*. https://leg.colorado.gov/bills/sb26-189

Congreso Visible. (s. f.). *Proyecto de Ley 043 de 2025 Senado: por medio de la cual se regula la inteligencia artificial en Colombia*. Universidad de los Andes. Recuperado el 28 de octubre de 2026, de https://congresovisible.uniandes.edu.co/proyectos-de-ley/ppor-medio-de-la-cual-se-regula-la-inteligencia-artificial-en-colombia-para-garantizar-su-desarrollo-etico-responsable-competitivo-e-innovador-y-se-dictan-otras-disposiciones-regula-la-inteligencia-artificial/14674/

Consejo Nacional de Política Económica y Social. (2025). *Documento CONPES 4144: Política Nacional de Inteligencia Artificial*. Departamento Nacional de Planeación. https://colaboracion.dnp.gov.co/CDT/Conpes/Econ%C3%B3micos/4144.pdf

Constitución Política de Colombia. (1991). Secretaría General del Senado. http://www.secretariasenado.gov.co/senado/basedoc/constitucion_politica_1991.html

Decisión 351 de 1993. Régimen común sobre derecho de autor y derechos conexos. Comisión del Acuerdo de Cartagena. 17 de diciembre de 1993. https://www.comunidadandina.org/StaticFiles/DocOf/DEC351.pdf

Decreto 1074 de 2015. Por medio del cual se expide el Decreto Único Reglamentario del Sector Comercio, Industria y Turismo. 26 de mayo de 2015. https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=76608

Dirección Nacional de Derecho de Autor. (s. f.). *Pronunciamientos sobre IA*. Recuperado el 28 de octubre de 2026, de https://www.derechodeautor.gov.co/es/pronunciamientos-sobre-ia

European Data Protection Board. (2019). *Guidelines 3/2018 on the territorial scope of the GDPR (Article 3)* (versión 2.1). https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-32018-territorial-scope-gdpr-article-3-version_en

Federal Trade Commission. (s. f.). *Complying with COPPA: Frequently asked questions*. Recuperado el 15 de octubre de 2026, de https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions

Google. (2024). *Generative AI prohibited use policy* (última modificación: 17 de diciembre de 2024). https://policies.google.com/terms/generative-ai/use-policy

Google. (2026). *Gemini API additional terms of service* (vigentes desde el 23 de marzo de 2026). https://ai.google.dev/gemini-api/terms

Groq. (2026). *Groq services agreement* (modificado el 22 de junio de 2026). https://console.groq.com/docs/legal/services-agreement

Instituto Nacional de Contadores Públicos. (2020). *Protección de datos de las cookies*. https://incp.org.co/novedades/2020/10/proteccion-de-datos-de-las-cookies/

Knowt. (2025). *Terms of service* (vigentes desde el 29 de mayo de 2025). https://knowt.com/terms

Legal Information Institute. (s. f.-a). *17 U.S. Code § 512: Limitations on liability relating to material online*. Cornell Law School. Recuperado el 28 de octubre de 2026, de https://www.law.cornell.edu/uscode/text/17/512

Legal Information Institute. (s. f.-b). *34 CFR § 99.31: Under what conditions is prior consent not required to disclose information?* Cornell Law School. Recuperado el 28 de octubre de 2026, de https://www.law.cornell.edu/cfr/text/34/99.31

Ley 23 de 1982. Sobre derechos de autor. 28 de enero de 1982. https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=3431

Ley 27 de 1977. Por la cual se fija la mayoría de edad a los 18 años. D. O. No. 34.902. https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=4965

Ley 30 de 1992. Por la cual se organiza el servicio público de la educación superior. http://www.secretariasenado.gov.co/senado/basedoc/ley_0030_1992.html

Ley 527 de 1999. Por medio de la cual se define y reglamenta el acceso y uso de los mensajes de datos, del comercio electrónico y de las firmas digitales. 18 de agosto de 1999. D. O. No. 43.673. http://www.secretariasenado.gov.co/senado/basedoc/ley_0527_1999.html

Ley 1098 de 2006. Por la cual se expide el Código de la Infancia y la Adolescencia. http://www.secretariasenado.gov.co/senado/basedoc/ley_1098_2006.html

Ley 1273 de 2009. Por medio de la cual se modifica el Código Penal, se crea un nuevo bien jurídico tutelado denominado "de la protección de la información y de los datos". 5 de enero de 2009. D. O. No. 47.223. http://www.secretariasenado.gov.co/senado/basedoc/ley_1273_2009.html

Ley 1450 de 2011. Por la cual se expide el Plan Nacional de Desarrollo, 2010-2014. http://www.secretariasenado.gov.co/senado/basedoc/ley_1450_2011.html

Ley 1480 de 2011. Por medio de la cual se expide el Estatuto del Consumidor. 12 de octubre de 2011. D. O. No. 48.220. http://www.secretariasenado.gov.co/senado/basedoc/ley_1480_2011.html

Ley 1563 de 2012. Por medio de la cual se expide el Estatuto de Arbitraje Nacional e Internacional. http://www.secretariasenado.gov.co/senado/basedoc/ley_1563_2012.html

Ley 1581 de 2012. Por la cual se dictan disposiciones generales para la protección de datos personales. 17 de octubre de 2012. http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html

Ley 1618 de 2013. Por medio de la cual se establecen las disposiciones para garantizar el pleno ejercicio de los derechos de las personas con discapacidad. http://www.secretariasenado.gov.co/senado/basedoc/ley_1618_2013.html

Ley 1915 de 2018. Por la cual se modifica la Ley 23 de 1982 y se establecen otras disposiciones en materia de derecho de autor y derechos conexos. 12 de julio de 2018. D. O. No. 50.652. http://www.secretariasenado.gov.co/senado/basedoc/ley_1915_2018.html

Ley 1955 de 2019. Por el cual se expide el Plan Nacional de Desarrollo 2018-2022. http://www.secretariasenado.gov.co/senado/basedoc/ley_1955_2019_pr007.html

Ley 2300 de 2023. Por medio de la cual se establecen medidas que protejan el derecho a la intimidad de los consumidores. 10 de julio de 2023. D. O. No. 52.452. http://www.secretariasenado.gov.co/senado/basedoc/ley_2300_2023.html

Ley 2489 de 2025. Por medio de la cual se dictan disposiciones para la promoción de entornos digitales sanos y seguros para los niños, niñas y adolescentes. 17 de julio de 2025. D. O. No. 53.185. https://normograma.mintic.gov.co/mintic/compilacion/docs/ley_2489_2025.htm

Meta. (s. f.). *Llama 3.3 acceptable use policy*. Recuperado el 28 de octubre de 2026, de https://dev.meta.ai/llama/llama3_3/use-policy

Ministerio de Tecnologías de la Información y las Comunicaciones. (2020). *Resolución 1519 de 2020, por la cual se definen los estándares y directrices para publicar la información señalada en la Ley 1712 de 2014*. https://www.cerlatam.com/normatividad/normas-nacionales-de-colombia/mintic-resolucion-1519-de-2020/

National Institute of Standards and Technology. (2025). *Digital identity guidelines: Authentication and authenticator management* (NIST SP 800-63B-4). https://pages.nist.gov/800-63-4/sp800-63b.html

Nicfab. (2026). *Digital Omnibus on AI published in the Official Journal*. https://www.nicfab.eu/en/posts/digital-omnibus-ai-official-journal/

OpenRouter. (2026). *Terms of service* (actualizados el 31 de agosto de 2026). https://openrouter.ai/terms

OpenRouter. (s. f.). *Provider logging and data policies*. Recuperado el 28 de octubre de 2026, de https://openrouter.ai/docs/guides/privacy/provider-logging

PostHog. (s. f.). *Privacy and GDPR compliance*. Recuperado el 28 de octubre de 2026, de https://posthog.com/docs/privacy/gdpr-compliance

Reglamento (UE) 2016/679. Reglamento general de protección de datos. Parlamento Europeo y Consejo de la Unión Europea. 27 de abril de 2016. https://eur-lex.europa.eu/eli/reg/2016/679/oj (considerandos consultados en https://gdpr-info.eu/recitals/no-23/ y https://gdpr-info.eu/recitals/no-24/)

Reglamento (UE) 2022/2065. Reglamento de Servicios Digitales. Parlamento Europeo y Consejo de la Unión Europea. 19 de octubre de 2022. https://eur-lex.europa.eu/eli/reg/2022/2065/oj (artículos consultados en https://www.eu-digital-services-act.com/)

Reglamento (UE) 2024/1689. Reglamento de Inteligencia Artificial. Parlamento Europeo y Consejo de la Unión Europea. 13 de junio de 2024. https://eur-lex.europa.eu/eli/reg/2024/1689/oj (anexo III consultado en https://artificialintelligenceact.eu/annex/3/)

Reglamento (UE) 2026/1744. Por el que se modifica el Reglamento (UE) 2024/1689 (Digital Omnibus sobre IA). https://eur-lex.europa.eu/eli/reg/2026/1744/oj

Sentencia C-748 de 2011. Corte Constitucional de Colombia (M. P. Jorge Ignacio Pretelt Chaljub). https://www.corteconstitucional.gov.co/relatoria/2011/c-748-11.htm

Sentry. (s. f.). *Data processing addendum*. Recuperado el 28 de octubre de 2026, de https://sentry.io/legal/dpa/

Superintendencia de Industria y Comercio. (2020). *Circular Única, Título V: Protección de datos personales* (versión actualizada por la Circular Externa 003 del 30 de marzo de 2020). https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/052020/Ti%CC%81tulo%20V%20Proteccion%20Datos%20Circular%2003%20del%2030%20de%20marzo%202020%29.pdf

Superintendencia de Industria y Comercio. (2024). *Circular Externa 002 de 2024: Lineamientos sobre el tratamiento de datos personales en sistemas de inteligencia artificial* (21 de agosto de 2024). https://sedeelectronica.sic.gov.co/sites/default/files/normativa/Circular%20Externa%20No.%20002%20del%2021%20de%20agosto%20de%202024.pdf

Supabase. (2026). *Data processing addendum* (versión 1, 1 de agosto de 2026). https://supabase.com/legal/dpa

Upstash. (2025). *Data processing addendum* (abril de 2025). https://upstash.com/trust/dpa.pdf

Vercel. (2026). *Data processing addendum* (vigente desde el 31 de marzo de 2026). https://vercel.com/legal/dpa

Vercel. (s. f.). *Fair use guidelines*. Recuperado el 15 de octubre de 2026, de https://vercel.com/docs/limits/fair-use-guidelines

White & Case. (2026). *EU AI Omnibus enters into force, amending the AI Act*. https://www.whitecase.com/insight-alert/eu-ai-omnibus-enters-force-amending-ai-act

World Wide Web Consortium. (2023). *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/
