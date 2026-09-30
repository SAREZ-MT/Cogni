import { act, screen } from "@testing-library/react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandMenuItem } from "../command-menu";
import { createCommandMenuRender } from "./create-command-menu-render";

interface Item extends CommandMenuItem {
  payload: string;
}

const items: Item[] = [
  { id: "a", label: "Alfa", payload: "payload-a" },
  { id: "b", label: "Beta", payload: "payload-b" },
];

function buildProps(overrides: Partial<SuggestionProps<Item, unknown>> = {}): {
  props: SuggestionProps<Item, unknown>;
  unmountMenu: () => void;
} {
  const unmountMenu = vi.fn();
  const props = {
    items,
    query: "",
    command: vi.fn(),
    mount: vi.fn((element: HTMLElement) => {
      document.body.appendChild(element);
      return () => {
        unmountMenu();
        element.remove();
      };
    }),
    ...overrides,
  } as unknown as SuggestionProps<Item, unknown>;
  return { props, unmountMenu };
}

describe("createCommandMenuRender", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts the command menu into the element handed to Suggestion", async () => {
    const renderer = createCommandMenuRender<Item, unknown>()();
    const { props } = buildProps();

    await act(async () => renderer.onStart?.(props));

    expect(props.mount).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Alfa")).toBeVisible();
    expect(screen.getByText("Beta")).toBeVisible();
  });

  it("re-renders with the updated query on onUpdate", async () => {
    const renderer = createCommandMenuRender<Item, unknown>()();
    const { props } = buildProps();
    await act(async () => renderer.onStart?.(props));

    await act(async () =>
      renderer.onUpdate?.({ ...props, query: "alf" } as typeof props),
    );

    expect(screen.queryByText("Beta")).toBeNull();
    expect(screen.getByText("Alfa")).toBeVisible();
  });

  it("maps the selected item through toCommandProps, never passing the raw item", async () => {
    const renderer = createCommandMenuRender<Item, { value: string }>(
      (item) => ({ value: item.payload }),
    )();
    const { props } = buildProps();
    await act(async () => renderer.onStart?.(props));

    await act(async () => {
      screen.getByText("Beta").click();
    });

    expect(props.command).toHaveBeenCalledWith({ value: "payload-b" });
  });

  it("passes the raw item through when no mapper is given", async () => {
    const renderer = createCommandMenuRender<Item, Item>()();
    const { props } = buildProps();
    await act(async () => renderer.onStart?.(props));

    await act(async () => {
      screen.getByText("Alfa").click();
    });

    expect(props.command).toHaveBeenCalledWith(items[0]);
  });

  it("unmounts the menu on exit and ignores later updates", async () => {
    const renderer = createCommandMenuRender<Item, unknown>()();
    const { props, unmountMenu } = buildProps();
    await act(async () => renderer.onStart?.(props));

    await act(async () => renderer.onExit?.(props));

    expect(unmountMenu).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Alfa")).toBeNull();
    await act(async () => renderer.onUpdate?.(props));
    expect(screen.queryByText("Alfa")).toBeNull();
  });
});
