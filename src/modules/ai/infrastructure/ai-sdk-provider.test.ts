import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAiSdkProvider } from "./ai-sdk-provider";

const schema = z.object({ cards: z.array(z.string()) });
const model = { fake: "language-model" } as never;

function request() {
  return {
    schema,
    system: "sys",
    prompt: "prompt",
    temperature: 0.4,
    maxOutputTokens: 800,
  };
}

describe("createAiSdkProvider", () => {
  it("exposes the id and model id of the port", () => {
    const provider = createAiSdkProvider({
      id: "gemini-flash-lite",
      modelId: "gemini-2.5-flash-lite",
      model,
      generateObject: vi.fn(),
    });
    expect(provider.id).toBe("gemini-flash-lite");
    expect(provider.model).toBe("gemini-2.5-flash-lite");
  });

  it("passes schema, prompts, temperature and token cap to generateObject", async () => {
    const generateObject = vi.fn().mockResolvedValue({
      object: { cards: ["a"] },
      usage: { inputTokens: 11, outputTokens: 7 },
    });
    const provider = createAiSdkProvider({
      id: "p",
      modelId: "m",
      model,
      generateObject,
    });
    await provider.generateObject(request());

    expect(generateObject).toHaveBeenCalledWith({
      model,
      schema,
      system: "sys",
      prompt: "prompt",
      temperature: 0.4,
      maxOutputTokens: 800,
    });
  });

  it("maps the object, usage and measured latency", async () => {
    let t = 1000;
    const generateObject = vi.fn().mockImplementation(async () => {
      t += 42;
      return {
        object: { cards: ["a"] },
        usage: { inputTokens: 11, outputTokens: 7 },
      };
    });
    const provider = createAiSdkProvider({
      id: "p",
      modelId: "m",
      model,
      generateObject,
      nowMs: () => t,
    });
    const response = await provider.generateObject(request());
    expect(response).toEqual({
      object: { cards: ["a"] },
      usage: { inputTokens: 11, outputTokens: 7 },
      latencyMs: 42,
    });
  });

  it("defaults undefined usage to zero", async () => {
    const generateObject = vi.fn().mockResolvedValue({
      object: {},
      usage: { inputTokens: undefined, outputTokens: undefined },
    });
    const provider = createAiSdkProvider({
      id: "p",
      modelId: "m",
      model,
      generateObject,
    });
    const response = await provider.generateObject(request());
    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("lets SDK errors propagate", async () => {
    const generateObject = vi.fn().mockRejectedValue(new Error("boom"));
    const provider = createAiSdkProvider({
      id: "p",
      modelId: "m",
      model,
      generateObject,
    });
    await expect(provider.generateObject(request())).rejects.toThrow("boom");
  });
});
