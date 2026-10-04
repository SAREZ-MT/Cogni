// Public API of the "ai" module. No cross-module import may reach past this
// file (documento-maestro §5.3.5).
export * from "./application";
export * from "./domain";
export {
  type AiServerApi,
  createAiServerApi,
} from "./server-api";
