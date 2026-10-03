import { describe, expect, it } from "vitest";
import {
  nextProviders,
  type ProviderEntry,
  type SelectionContext,
  selectProvider,
} from "./provider";

function entry(over: Partial<ProviderEntry> & { id: string }): ProviderEntry {
  return {
    model: `${over.id}-model`,
    capabilities: ["generate_flashcards"],
    rpm: 10,
    rpd: 100,
    priority: 1,
    ...over,
  };
}

function ctx(over: Partial<SelectionContext> = {}): SelectionContext {
  return {
    purpose: "generate_flashcards",
    unhealthyIds: new Set(),
    usage: {},
    ...over,
  };
}

const gemini = entry({ id: "gemini", priority: 1 });
const cloudflare = entry({ id: "cloudflare", priority: 2 });
const openrouter = entry({ id: "openrouter", priority: 3 });

describe("selectProvider", () => {
  it("picks the lowest priority number regardless of list order", () => {
    expect(selectProvider([openrouter, gemini, cloudflare], ctx())?.id).toBe(
      "gemini",
    );
  });

  it("skips entries that do not support the purpose", () => {
    const groq = entry({
      id: "groq",
      priority: 0,
      capabilities: ["evaluate_recall_answer"],
    });
    expect(selectProvider([groq, gemini], ctx())?.id).toBe("gemini");
  });

  it("skips an entry whose daily quota is exhausted", () => {
    const usage = { gemini: { day: 100, minute: 0 } };
    expect(selectProvider([gemini, cloudflare], ctx({ usage }))?.id).toBe(
      "cloudflare",
    );
  });

  it("skips an entry whose per-minute quota is exhausted", () => {
    const usage = { gemini: { day: 5, minute: 10 } };
    expect(selectProvider([gemini, cloudflare], ctx({ usage }))?.id).toBe(
      "cloudflare",
    );
  });

  it("keeps an entry one request below both limits", () => {
    const usage = { gemini: { day: 99, minute: 9 } };
    expect(selectProvider([gemini, cloudflare], ctx({ usage }))?.id).toBe(
      "gemini",
    );
  });

  it("treats an entry with no recorded usage as unused", () => {
    expect(selectProvider([gemini], ctx({ usage: {} }))?.id).toBe("gemini");
  });

  it("skips unhealthy entries", () => {
    const unhealthyIds = new Set(["gemini"]);
    expect(
      selectProvider([gemini, cloudflare], ctx({ unhealthyIds }))?.id,
    ).toBe("cloudflare");
  });

  it("skips excluded entries", () => {
    expect(
      selectProvider([gemini, cloudflare], ctx({ exclude: ["gemini"] }))?.id,
    ).toBe("cloudflare");
  });

  it("returns null when nothing qualifies", () => {
    expect(selectProvider([], ctx())).toBeNull();
    expect(
      selectProvider([gemini], ctx({ unhealthyIds: new Set(["gemini"]) })),
    ).toBeNull();
  });
});

describe("nextProviders", () => {
  it("returns every eligible entry ordered by priority", () => {
    const usage = { cloudflare: { day: 100, minute: 0 } };
    const ids = nextProviders(
      [openrouter, cloudflare, gemini],
      ctx({ usage }),
    ).map((e) => e.id);
    expect(ids).toEqual(["gemini", "openrouter"]);
  });

  it("does not mutate the input list", () => {
    const list = [openrouter, gemini];
    nextProviders(list, ctx());
    expect(list.map((e) => e.id)).toEqual(["openrouter", "gemini"]);
  });
});
