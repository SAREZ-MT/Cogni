// H6-E5 (odd/tasks/phase-8-design-flows.md): Notion's markdown shortcuts
// for two blocks the editor already has.
// - `>` + space opens a toggle: the existing `details` block (details.ts,
//   already in shared/kernel/tiptap-catalogue.ts and in plain-text.ts), with
//   the caret in its title. Notion uses `>` for toggles, not quotes.
// - `"` + space opens a quote. Typography's smart-quote rule turns the typed
//   `"` into `“` before the space arrives, so both forms match.
//
// StarterKit's Blockquote ships its own `>` rule; `withoutQuoteChevron`
// drops it (index.ts wraps StarterKit's own extension list), so `>` never
// falls through to a quote where the toggle rule declines (a list item).
import {
  type AnyExtension,
  Extension,
  InputRule,
  wrappingInputRule,
} from "@tiptap/core";

export const TOGGLE_SHORTCUT = /^\s*>\s$/;
export const QUOTE_SHORTCUT = /^\s*["“]\s$/;

export const MarkdownShortcuts = Extension.create({
  name: "markdownShortcuts",

  addInputRules() {
    const { schema } = this.editor;
    const rules: InputRule[] = [];
    if (schema.nodes.details) {
      rules.push(
        new InputRule({
          find: TOGGLE_SHORTCUT,
          handler: ({ range, chain, state }) => {
            // Only from a plain top-level paragraph: inside a toggle title,
            // a list item or a quote the `>` stays as typed text.
            const { $from } = state.selection;
            if ($from.depth !== 1 || $from.parent.type.name !== "paragraph")
              return null;
            chain().deleteRange(range).setDetails().run();
          },
        }),
      );
    }
    if (schema.nodes.blockquote) {
      rules.push(
        wrappingInputRule({
          find: QUOTE_SHORTCUT,
          type: schema.nodes.blockquote,
        }),
      );
    }
    return rules;
  },
});

export function withoutQuoteChevron(
  extensions: AnyExtension[],
): AnyExtension[] {
  return extensions.map((extension) =>
    extension.name === "blockquote"
      ? extension.extend({ addInputRules: () => [] })
      : extension,
  );
}
