# Política de uso aceptable y de inteligencia artificial de Cogni

- **Versión:** 1.0
- **Fecha de última actualización:** [PENDIENTE: fecha de entrada en vigor]
- **Responsable:** [PENDIENTE: nombre completo], persona natural, cédula de ciudadanía [PENDIENTE: cédula]

> **En resumen**
>
> - Usa Cogni para estudiar, de forma legal y respetuosa.
> - Cogni funciona con modelos de IA de terceros. Al usarlo aceptas también sus políticas de uso, que resumimos aquí.
> - La IA puede equivocarse, omitir información o reflejar sesgos. Verifica siempre el material generado.
> - Lo que envías a la IA puede ser usado por algunos proveedores para mejorar sus productos. No incluyas datos sensibles, confidenciales ni de otras personas.

Esta política forma parte de los [Términos y condiciones](terminos-y-condiciones.md).

## 1. Usos prohibidos

No puedes usar Cogni para:

1. cometer o promover actividades ilegales, o generar contenido que la ley prohíba;
2. subir contenido que infrinja derechos de autor, marcas u otros derechos de terceros, salvo que tengas permiso o la ley lo permita;
3. subir datos personales de otras personas sin autorización, o datos sensibles propios o ajenos;
4. acosar, amenazar, discriminar o incitar al odio o a la violencia;
5. generar o subir contenido sexual que involucre a menores de edad, o contenido sexual no consentido;
6. obtener instrucciones para fabricar armas, explosivos o sustancias peligrosas, o para causar daño a personas o a sistemas;
7. crear o difundir desinformación, fraudes o suplantaciones;
8. presentar el contenido generado por IA como hecho solo por una persona con el fin de engañar, incluido el fraude académico (véase el [Código de integridad académica](codigo-de-integridad-academica.md));
9. usar el material generado como base única de decisiones médicas, legales, financieras o de otro tipo profesional, o de decisiones automatizadas que afecten derechos de otras personas;
10. intentar acceder sin permiso a cuentas, datos o sistemas, incluidos los de Cogni y sus proveedores; eludir los límites de uso; o introducir software malicioso;
11. extraer de forma automatizada el contenido o las respuestas de los modelos, o usarlos para desarrollar modelos que compitan con los de los proveedores;
12. revender, sublicenciar o dar acceso a terceros a tu cuenta o al servicio;
13. intentar que los modelos ignoren sus salvaguardas (*jailbreak*) o produzcan contenido prohibido por esta política.

## 2. Políticas de los proveedores de IA que también aceptas

Los proveedores de IA exigen que traslademos sus reglas a quienes usan Cogni. Al aceptar los términos de Cogni aceptas también cumplir, en lo que te aplique:

| Proveedor o modelo | Política | Enlace |
|---|---|---|
| Google Gemini | Términos adicionales de la API de Gemini y Política de uso prohibido de IA generativa de Google | https://ai.google.dev/gemini-api/terms y https://policies.google.com/terms/generative-ai/use-policy |
| Groq (`openai/gpt-oss-120b`) | Acuerdo de servicios y Política de uso aceptable de Groq | https://console.groq.com/docs/legal/services-agreement y https://console.groq.com/docs/legal/ai-policy |
| Cloudflare Workers AI (Meta Llama 3.3 70B) | Condiciones de la plataforma de desarrolladores de Cloudflare, Licencia comunitaria de Llama 3.3 y Política de uso aceptable de Llama 3.3 | https://www.cloudflare.com/service-specific-terms-developer-platform/ y https://dev.meta.ai/llama/llama3_3/use-policy |
| OpenRouter (modelos gratuitos) | Términos de OpenRouter y condiciones de cada modelo al que enruta | https://openrouter.ai/terms |

Si una de esas políticas es más estricta que esta, se aplica la más estricta. Si las incumples, el proveedor puede suspender el servicio a Cogni, y nosotros podemos suspender tu cuenta según la sección 5.

## 3. Aviso de transparencia sobre la IA

### 3.1 Dónde se usa la IA en Cogni

- Generar tarjetas de memoria, preguntas de recordación activa y exámenes de práctica a partir de tus páginas.
- Evaluar tus respuestas escritas de recordación activa y redactar retroalimentación.

Todo el material producido por la IA es generado automáticamente. Cogni no usa la IA para tomar decisiones sobre ti, para perfilarte ni para calificarte de forma oficial.

### 3.2 Qué datos recibe la IA

- El texto de tus notas y páginas, hasta un límite de unos 12 000 *tokens* por solicitud.
- El texto extraído de los PDF, DOCX y PPTX que importas.
- Para evaluar la recordación activa: la pregunta, la rúbrica, el fragmento más pertinente de la página y tu respuesta escrita.

No enviamos tu correo, tu nombre ni tu identificador de cuenta en las instrucciones al modelo.

### 3.3 Proveedores y uso de los datos

Cogni intenta los proveedores en orden y pasa al siguiente si uno no está disponible.

| Proveedor | Modelo | Uso en Cogni | Qué hace con tu contenido |
|---|---|---|---|
| Groq | `openai/gpt-oss-120b` | Evaluación y retroalimentación | Declara que no lo usa para entrenar modelos sin permiso del cliente |
| Google Gemini (nivel gratuito) | `gemini-3.5-flash-lite` | Todas las funciones | Lo usa, junto con las respuestas, para prestar, mejorar y desarrollar productos de Google; personas de Google pueden revisarlo |
| Cloudflare Workers AI | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Generación de material | Declara que no lo usa para entrenar modelos y que no conserva entradas ni salidas tras la solicitud |
| OpenRouter | Modelos gratuitos de terceros (la lista puede cambiar) | Generación de material | Algunos proveedores a los que enruta pueden guardarlo o entrenar con él |

Todos operan principalmente en Estados Unidos. La lista completa de proveedores está en la [lista de subencargados](subencargados.md).

### 3.4 Riesgos conocidos

El material generado por IA:

- **puede contener errores**: afirmaciones falsas, cifras o fechas incorrectas, o respuestas correctas marcadas como incorrectas;
- **puede omitir** información importante de tu material o agregar información que no está en él;
- **puede reflejar sesgos** presentes en los datos con los que se entrenaron los modelos;
- **puede variar**: la misma solicitud puede producir resultados distintos, sobre todo cuando cambia el proveedor;
- **no es una evaluación oficial**: las evaluaciones de tus respuestas son formativas, para practicar, y no certifican conocimientos ni sustituyen a tus docentes;
- **no es consejo profesional** en salud, derecho, finanzas ni otras áreas.

Contrasta siempre el material con tus fuentes. Si encuentras un error, no estudies con ese material y, si quieres, avísanos a [PENDIENTE: correo de privacidad].

### 3.5 Privacidad

Como algunos proveedores pueden usar tu contenido para sus propios fines, **no incluyas datos personales sensibles, información confidencial ni datos personales de otras personas** en tus notas, documentos o respuestas. Más detalles en la [Política de tratamiento de datos personales](politica-de-tratamiento-de-datos.md).

## 4. Atribuciones

- Built with Llama. Llama 3.3 está licenciado bajo la Llama 3.3 Community License, Copyright © Meta Platforms, Inc. Todos los derechos reservados.
- `gpt-oss-120b` es un modelo de OpenAI distribuido bajo la licencia Apache 2.0.
- Gemini es una marca de Google LLC. Groq, Cloudflare y OpenRouter son marcas de sus respectivos titulares.

Cogni no está afiliado a estos proveedores ni cuenta con su patrocinio.

## 5. Incumplimientos

Si incumples esta política, según la gravedad podemos retirar el contenido afectado, limitar funciones o suspender o terminar tu cuenta, conforme a la sección 13 de los [Términos y condiciones](terminos-y-condiciones.md). Salvo urgencia, te avisaremos antes, te explicaremos el motivo y podrás responder.

Para reportar un uso indebido escribe a [PENDIENTE: correo de privacidad].
