import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { exitSuggestion } from "@tiptap/suggestion";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommandMenu, type CommandMenuItem } from "../command-menu";
import {
  SLASH_COMMAND_ITEMS,
  type SlashCommandItem,
} from "./slash-command-items";

export function filterItems(query: string): SlashCommandItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return SLASH_COMMAND_ITEMS;
  return SLASH_COMMAND_ITEMS.filter((item) => {
    const haystack = [item.label, ...(item.keywords ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

// S7 (odd/tasks/app-shell-restyle.md, drift #3): once `allowSpaces: true`
// lets the query keep growing past the first space (so "/encabezado 2" and
// "/lista con" can still match), an ordinary sentence typed right after
// "/" ("/vamos a estudiar biología hoy") must not leave an empty, useless
// menu open forever — Notion's own slash menu closes the same way. Only
// closes once NOTHING matches AND the query already looks like prose (a
// space, or long), never while a short prefix could still become a real
// command.
const CLOSE_ON_EMPTY_MATCH_QUERY_LENGTH = 12;

export function shouldCloseSlashMenu(
  query: string,
  items: SlashCommandItem[],
): boolean {
  if (items.length > 0) return false;
  return (
    query.includes(" ") || query.length > CLOSE_ON_EMPTY_MATCH_QUERY_LENGTH
  );
}

// Explicit key (instead of the Suggestion utility's own default) so
// `exitSuggestion` below can target this exact plugin instance.
const SlashCommandPluginKey = new PluginKey("slashCommand");

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
    const { editor } = this;
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
        editor,
        char: "/",
        pluginKey: SlashCommandPluginKey,
        // Drift #3 (odd/tasks/app-shell-restyle.md): Notion-style — "/
        // encabezado 2" and "/lista con" must keep matching past the
        // first space, instead of the default `allowSpaces: false`
        // closing the menu right there.
        allowSpaces: true,
        items: ({ query }) => filterItems(query),
        command: ({ editor: activeEditor, range, props }) => {
          (props as SlashCommandItem).run(activeEditor, range);
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
            // S7 fix (odd/tasks/app-shell-restyle.md): @tiptap/suggestion
            // calls this TWICE per keystroke — once with a transient
            // `props.items: []` snapshot taken BEFORE it re-evaluates the
            // `items` option above for the new query, then again once that
            // resolves. Deciding whether to close from `props.items`
            // directly sees that transient empty call and exits the
            // suggestion even when the query genuinely matches something
            // ("/encabezado 2" closed right before Enter could select it).
            // `filterItems` is the exact same synchronous function the
            // `items` option itself uses, so recomputing it here from
            // `props.query` is always consistent with what `props.items`
            // settles to once @tiptap/suggestion's second call lands — it
            // just isn't stale in between.
            const items = filterItems(props.query);
            if (shouldCloseSlashMenu(props.query, items)) {
              cleanup();
              exitSuggestion(editor.view, SlashCommandPluginKey);
              return;
            }
            renderMenu(
              items,
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
