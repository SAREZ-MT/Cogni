# ADR 0004 — Capa de IA con proveedores gratuitos, rotación por cuota y límites por usuario

| Campo | Valor |
|---|---|
| Fecha | 2026-10-04 |
| Estado | Aceptado |
| Reemplaza | Parcialmente el punto 6 del ADR 0001 (lista de cinco proveedores) y la tabla de §4.3 y los límites de §8.3 del documento maestro 1.1.0 |

## Contexto

La Fase 3 construye la capa de IA definida en §8 del documento maestro. El producto debe atender a unos 20 usuarios recurrentes por día con costo cero y sin registrar ningún método de pago. Los tiers gratuitos cambian sin aviso, por lo que la capa se diseña asumiendo que cualquier proveedor puede fallar o agotar su cuota en cualquier momento.

Al implementar la fase se verificó cada proveedor candidato contra su condición de uso gratuito:

- Mistral exige registrar un método de pago para activar su tier de uso.
- Cerebras exige tarjeta.
- GitHub Models fue retirado como opción gratuita.
- Together, Chutes, Scaleway, Vertex AI, NVIDIA, Cohere y Hugging Face quedaron fuera por límites insuficientes, requisitos de pago o condiciones no compatibles con un producto abierto a usuarios.
- Usar varios proyectos de Google AI Studio para multiplicar la cuota infringe sus términos de servicio, por lo que se usa un único proyecto.

## Decisión

1. **Objetivo.** 20 usuarios diarios, costo cero, sin método de pago en ningún proveedor.
2. **Proveedores y orden de fallback para generación** (tabla única en `src/modules/ai/infrastructure/provider-registry.ts`; los límites `rpm` y `rpd` son valores por defecto del código):

   | Prioridad | Proveedor | Modelo | rpm / rpd en el código |
   |---|---|---|---|
   | 1 | Google AI Studio (`@ai-sdk/google`) | `gemini-2.5-flash-lite` | 10 / 20 |
   | 2 | Cloudflare Workers AI (endpoint compatible con OpenAI, `@ai-sdk/openai-compatible`) | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 30 / 300 |
   | 3 | OpenRouter (`@openrouter/ai-sdk-provider`) | `qwen/qwen3.8-27b:free` | 20 / 50 |
   | 4 | OpenRouter | `nvidia/nemotron-3-super-120b-a12b:free` | 20 / 50 |

   Groq (`@ai-sdk/groq`, `openai/gpt-oss-120b`, 30 / 1000) queda registrado solo para propósitos de evaluación; no participa en la generación de la Fase 3. Solo entran en la rotación los proveedores cuyas claves están configuradas.
3. **AI SDK v7** (`ai@7.0.127`) con `generateObject` y esquema Zod como única forma de obtener una salida. Nota: `generateObject` figura como obsoleto (`@deprecated`) en `ai@7.0.127` a favor de `generateText` con `Output.object`. La migración queda pendiente y debe hacerse antes de que se elimine la función.
4. **Upstash Redis**: una única base gratuita `cogni`. Todas las claves llevan el prefijo `REDIS_KEY_PREFIX` (`cogni:dev` en local y previews, `cogni:prod` en producción):
   - Cuota diaria por proveedor: `{prefijo}:ai:quota:{proveedor}:{yyyy-mm-dd}` con TTL de 48 h.
   - Cuota por minuto: `{prefijo}:ai:quota:{proveedor}:{yyyy-mm-dd-hh-mm}` con TTL de 120 s.
   - Circuit breaker: `{prefijo}:ai:breaker:{proveedor}`, estado en JSON con TTL de 1 h. Tres fallos consecutivos marcan al proveedor como no sano durante 10 minutos.
   - Límite por usuario: `@upstash/ratelimit` con ventana fija de un día bajo `{prefijo}:ai:gen`.
5. **Límite por usuario**: 6 generaciones por usuario por día, configurable con `AI_DAILY_GENERATIONS`. La interfaz muestra "Te quedan N generaciones hoy".
6. **Tope de página**: unas 12.000 unidades de contexto (`AI_PAGE_TOKEN_CAP`, estimación por palabras). Si la página lo supera, se conserva el inicio del texto hasta el tope y la interfaz muestra un aviso con la cantidad de palabras usadas. No hay selector de sección ni división en partes.
7. **Generación por técnica y bajo demanda**: el usuario pulsa "Generar" en una página; no hay generación por lotes ni en segundo plano.
8. **Modo falso**: `AI_PROVIDER_MODE=fake` sustituye todos los proveedores por uno determinista y mantiene cuotas, breaker y límite en memoria. Lo usan CI y los e2e, que así no necesitan ninguna clave. Los proveedores reales solo se ejercitan con el script manual `scripts/ai-smoke.mts`.
9. **Términos de uso**: los términos de Gemini (mayores de 18 años, no para menores, regiones EEE/Reino Unido/Suiza solo con servicio de pago, contenido del tier gratuito usado por Google) deben figurar en los términos de uso del registro. Se construye como una funcionalidad separada posterior a la Fase 3.

## Consecuencias

- Con las cuotas del código, la capacidad diaria de generación es del orden de 20 + 300 + 50 + 50 solicitudes entre todos los usuarios, suficiente para 20 usuarios con 6 generaciones cada uno solo mientras Cloudflare esté disponible.
- Si todos los proveedores están agotados o no sanos, el usuario recibe `GENERATION_FAILED`; nunca se inventa un resultado.
- Los límites por usuario (6 por día) son conservadores y están pendientes de ampliarse; la primera palanca prevista es cargar 10 USD en OpenRouter, que eleva el límite diario de los modelos `:free`. Hacerlo requiere un método de pago y por lo tanto una decisión nueva.
- Los identificadores de modelo de OpenRouter y los límites `rpm`/`rpd` son valores de código, no leídos del catálogo en tiempo de ejecución; si un proveedor cambia un modelo, se edita la tabla única del registro.
- El script de verificación manual consume cuota real (dos llamadas) y marca claves de cuota en Redis que se restauran con `--restore`.
- Un cambio de proveedor o de modelo no toca los módulos de negocio: todos pasan por `ai.application` y el AI SDK solo puede importarse en `src/modules/ai/infrastructure` (regla de dependency-cruiser).

## Alternativas descartadas

- **Mistral y Cerebras como respaldo** (ADR 0001, §4.3): exigen método de pago o tarjeta.
- **GitHub Models, Together, Chutes, Scaleway, Vertex AI, NVIDIA, Cohere y Hugging Face**: sin tier gratuito utilizable en producción o con condiciones incompatibles con el presupuesto cero.
- **Varios proyectos de Google AI Studio**: multiplicaría la cuota pero infringe los términos de servicio.
- **Selector de sección o división en partes para páginas largas**: más interfaz y más llamadas por una necesidad que el truncado con aviso cubre en la versión inicial.
- **Caché genérica en Redis**: Upstash se usa solo para límites, cuotas y estado del breaker (§4.2).
