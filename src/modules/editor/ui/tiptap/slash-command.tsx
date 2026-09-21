import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommandMenu, type CommandMenuItem } from "../command-menu";
import {
  SLASH_COMMAND_ITEMS,
  type SlashCommandItem,
} from "./slash-command-items";

function filterItems(query: string): SlashCommandItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return SLASH_COMMAND_ITEMS;
  return SLASH_COMMAND_ITEMS.filter((item) => {
    const haystack = [item.label, ...(item.keywords ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

// specs/editor/spec.md, "Menú de comandos `/`": writing "/" at the start of
// a line or after a space opens the menu; arrows move the selection, Enter
// inserts and removes the command text, Escape closes without changes.
// Uses @tiptap/suggestion for trigger detection/positioning and mounts the
// framework-agnostic editor/ui/command-menu.tsx as the actual popup — this
// file is the only bridge between the two, and lives under editor/ui/tiptap
// as required by the editor-tiptap-only-in-ui dependency-cruiser rule.
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    let root: Root | null = null;
    let element: HTMLDivElement | null = null;
    let unmount: (() => void) | null = null;

    function cleanup() {
      unmount?.();
      unmount = null;
      root?.unmount();
      root = null;
      element = null;
    }

    function renderMenu(
      items: CommandMenuItem[],
      query: string,
      onSelect: (item: CommandMenuItem) => void,
      onClose: () => void,
    ) {
      root?.render(
        createElement(CommandMenu, { items, query, onSelect, onClose }),
      );
    }

    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        items: ({ query }) => filterItems(query),
        command: ({ editor, range, props }) => {
          (props as SlashCommandItem).run(editor, range);
        },
        render: () => ({
          onStart: (props) => {
            element = document.createElement("div");
            root = createRoot(element);
            renderMenu(
              props.items as SlashCommandItem[],
              props.query,
              (item) => props.command(item),
              () => cleanup(),
            );
            unmount = props.mount(element);
          },
          onUpdate: (props) => {
            if (!root) return;
            renderMenu(
              props.items as SlashCommandItem[],
              props.query,
              (item) => props.command(item),
              () => cleanup(),
            );
          },
          onExit: () => {
            cleanup();
          },
        }),
      }),
    ];
  },
});
