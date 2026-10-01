import { act, cleanup, screen } from "@testing-library/react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmojiSuggestion, filterEmojiItems } from "./emoji-suggestion";

describe("filterEmojiItems", () => {
  it("returns a capped first page for an empty query", () => {
    const items = filterEmojiItems("   ");
    expect(items).toHaveLength(40);
  });

  it("matches by shortcode, case-insensitively and ignoring surrounding spaces", () => {
    const items = filterEmojiItems("  SMILE ");
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item) => item.name === "smile")).toBe(true);
  });

  it("caps a broad query to 40 results", () => {
    expect(filterEmojiItems("a").length).toBeLessThanOrEqual(40);
    expect(filterEmojiItems("a")).toHaveLength(40);
  });

  it("returns nothing for a query that matches no emoji", () => {
    expect(filterEmojiItems("zzzz-no-such-emoji")).toEqual([]);
  });

  it("maps an emoji to a menu item with the glyph in the tile, the shortcode as label and the humanized name muted", () => {
    const [smile] = filterEmojiItems("smile").filter(
      (item) => item.name === "smile",
    );
    expect(smile.id).toBe("smile");
    expect(smile.iconGlyph).toBe("😄");
    expect(smile.label).toMatch(/^:.+:$/);
    expect(smile.description).toBe("smile");
    expect(smile.keywords).toContain("smile");
    expect(smile.group).toBeTruthy();
  });
});

describe("emoji menu item description", () => {
  it("humanizes snake_case names into spaced words", () => {
    const item = filterEmojiItems("smiley").find((i) => i.name.includes("_"));
    expect(item).toBeDefined();
    expect(item?.description).toBe(item?.name.replace(/_/g, " "));
    expect(item?.description).not.toContain("_");
  });
});

describe("createEmojiSuggestion", () => {
  it("resolves items from the query through the same filter", () => {
    const suggestion = createEmojiSuggestion();
    expect(suggestion.items({ query: "smile" })).toEqual(
      filterEmojiItems("smile"),
    );
    expect(typeof suggestion.render).toBe("function");
  });
});

describe("emoji popup empty state", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("says no emoji matched, not that no block was found", async () => {
    const renderer = createEmojiSuggestion().render?.();
    const props = {
      items: [],
      query: "zzzz-no-such-emoji",
      command: vi.fn(),
      mount: vi.fn((element: HTMLElement) => {
        document.body.appendChild(element);
        return () => element.remove();
      }),
    } as unknown as SuggestionProps;

    await act(async () => renderer?.onStart?.(props));

    expect(screen.getByText("Sin emojis para esa búsqueda")).toBeVisible();
    expect(
      screen.queryByText("No se encontraron bloques"),
    ).not.toBeInTheDocument();
  });
});
