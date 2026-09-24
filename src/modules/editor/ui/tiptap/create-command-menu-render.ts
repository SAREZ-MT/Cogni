// Shared @tiptap/suggestion `render()` factory for the two E1 popups that
// follow the exact same shape as slash-command.tsx's hand-rolled one
// (emoji-suggestion.tsx's ":" trigger, mention-suggestion.tsx's "@"
// trigger): mount editor/ui/command-menu.tsx's framework-agnostic list into
// a React root Suggestion hands a detached element, and keep it in sync on
// every `onUpdate`. slash-command.tsx keeps its own copy (it has extra
// close-on-prose behaviour none of these need) rather than being rebuilt on
// top of this — this file only removes the duplication between the two
// *new* popups. Typed directly against @tiptap/suggestion's own
// `SuggestionOptions`/`SuggestionProps` (not a hand-rolled structural type)
// so it satisfies whatever concrete `TSelected` a caller's `.configure({
// suggestion })` needs (e.g. Mention's `MentionNodeAttrs`).

import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommandMenu, type CommandMenuItem } from "../command-menu";

// `toCommandProps` maps a selected menu item to whatever attrs the target
// node extension's default `command()` expects (e.g. Mention's `{id,
// label}`) — never the raw item itself, which may carry a non-serializable
// `icon` component that has no business inside a persisted node attribute.
export function createCommandMenuRender<
  TItem extends CommandMenuItem,
  TCommandProps = TItem,
>(
  toCommandProps: (item: TItem) => TCommandProps = (item) =>
    item as unknown as TCommandProps,
  // E3 #3 (bug report): lets each popup (emoji-suggestion.tsx, mention-
  // node.tsx) override command-menu.tsx's default "No se encontraron
  // bloques" empty state with copy that actually matches what it's
  // searching — a slash-menu-flavored message made no sense for "no emoji
  // matched" or "no page to mention".
  options: { emptyText?: string } = {},
): NonNullable<SuggestionOptions<TItem, TCommandProps>["render"]> {
  return () => {
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

    function renderMenu(props: SuggestionProps<TItem, TCommandProps>) {
      root?.render(
        createElement(CommandMenu, {
          items: props.items,
          query: props.query,
          onSelect: (item) => props.command(toCommandProps(item as TItem)),
          onClose: cleanup,
          emptyText: options.emptyText,
        }),
      );
    }

    return {
      onStart: (props) => {
        element = document.createElement("div");
        root = createRoot(element);
        renderMenu(props);
        unmount = props.mount(element);
      },
      onUpdate: (props) => {
        if (!root) return;
        renderMenu(props);
      },
      onExit: () => cleanup(),
    };
  };
}
