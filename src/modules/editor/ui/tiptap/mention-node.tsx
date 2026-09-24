// "@" mention popup (goal doc §2): mentions the current user's pages and
// links to them. `@tiptap/extension-mention`'s default node already wires a
// full `char`/`command`/`allow`/keyboard-shortcut Suggestion (confirmed by
// reading node_modules/@tiptap/extension-mention/dist/index.js) whose
// default `command` inserts `{ id, label, mentionSuggestionChar }` attrs —
// this file only extends those attrs with `notebookId` (needed to build the
// page's real route, which the default `id`/`label` shape has no room for)
// and overrides the node-level `renderHTML` to render an `<a href>` instead
// of the default plain `<span>`. `createMentionSuggestion` supplies the
// `items`/`render` pair the default `suggestion` option is missing, the
// same `.configure({ suggestion: {...} })` deep-merge pattern
// emoji-suggestion.tsx uses. The template's own polished `MentionList` UI
// component is paid-template chrome, deferred to E2.
import { mergeAttributes } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import { FileText } from "lucide-react";
import type { MentionCandidate, MentionPort } from "../../domain/mention-port";
import type { CommandMenuItem } from "../command-menu";
import { createCommandMenuRender } from "./create-command-menu-render";

export interface MentionMenuItem extends CommandMenuItem {
  candidate: MentionCandidate;
}

export const CogniMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      notebookId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-notebook-id"),
        renderHTML: (attributes: { notebookId?: unknown }) => {
          if (!attributes.notebookId) return {};
          return { "data-notebook-id": attributes.notebookId };
        },
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = (node.attrs.label as string | null) ?? node.attrs.id;
    const notebookId = node.attrs.notebookId as string | null;
    const pageId = node.attrs.id as string | null;
    const href =
      notebookId && pageId ? `/notebooks/${notebookId}/pages/${pageId}` : null;
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-type": this.name,
        ...(href ? { href } : {}),
      }),
      `@${label}`,
    ];
  },
});

// E2b scope C (mention popup restyle): "IconTile with the notebook's pastel
// tone + page title + notebook name muted". The generic FileText icon
// (rather than an emoji glyph) marks the row as "a page", tinted by
// IconTile's own tone class — a null notebookColor (no color set on that
// notebook) falls back to command-menu.tsx's default neutral `bg-hover`.
function toMenuItem(candidate: MentionCandidate): MentionMenuItem {
  return {
    id: candidate.id,
    label: candidate.title,
    description: candidate.notebookTitle,
    icon: FileText,
    iconTone: candidate.notebookColor ?? undefined,
    candidate,
  };
}

// Passed as `CogniMention.configure({ suggestion:
// createMentionSuggestion(mentionPort) })` in extensions/index.ts. A null
// port (no composition-root wiring, e.g. a standalone unit-test editor)
// resolves to an always-empty list rather than throwing.
export function createMentionSuggestion(mentionPort: MentionPort | null) {
  return {
    items: async ({ query }: { query: string }): Promise<MentionMenuItem[]> => {
      if (!mentionPort) return [];
      const candidates = await mentionPort.search(query);
      return candidates.map(toMenuItem);
    },
    render: createCommandMenuRender<
      MentionMenuItem,
      { id: string; label: string; notebookId: string }
    >(
      (item) => ({
        id: item.candidate.id,
        label: item.candidate.title,
        notebookId: item.candidate.notebookId,
      }),
      { emptyText: "No hay páginas para mencionar" },
    ),
  };
}
