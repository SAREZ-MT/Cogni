// ":" emoji popup (goal doc §2, "Emoji: gitHubEmojis, suggestion trigger
// ':'"). `@tiptap/extension-emoji`'s own `Emoji` node already wires a full
// `char`/`command`/`allow` Suggestion (confirmed by reading
// node_modules/@tiptap/extension-emoji/dist/index.js's `addOptions()`: its
// default `command` inserts `{ type: "emoji", attrs: props }` plus a
// trailing space and restores the stored marks) — this only supplies the
// two pieces that default is missing: `items` (filtered gitHubEmojis) and
// `render` (mounts editor/ui/command-menu.tsx instead of no UI at all).
// `.configure({ suggestion: {...} })` deep-merges into that default
// (@tiptap/core's `mergeDeep`, confirmed in node_modules/@tiptap/core/dist/
// index.js), so `char`/`command`/`allow`/`pluginKey` stay exactly as
// shipped. The template's own polished `EmojiDropdownMenu` UI component is
// paid-template chrome, deferred to E2.
import { type EmojiItem, gitHubEmojis } from "@tiptap/extension-emoji";
import type { CommandMenuItem } from "../command-menu";
import { createCommandMenuRender } from "./create-command-menu-render";

// cmdk/CommandMenu isn't virtualized — gitHubEmojis ships ~1900 entries, so
// an empty query caps to a reasonably small, still-useful first page instead
// of mounting every row.
const MAX_RESULTS = 40;

export interface EmojiMenuItem extends CommandMenuItem {
  name: string;
}

// gitHubEmojis names are snake_case English descriptions ("grinning_face");
// humanized here for the tile's muted secondary line (E2b scope C: "glyph
// in the tile + `:shortcode:` label (+ English name muted)").
function humanizeEmojiName(name: string): string {
  return name.replace(/_/g, " ");
}

function toMenuItem(emoji: EmojiItem): EmojiMenuItem {
  return {
    id: emoji.name,
    name: emoji.name,
    label: `:${emoji.shortcodes[0]}:`,
    iconGlyph: emoji.emoji,
    keywords: [...emoji.shortcodes, ...(emoji.tags ?? [])],
    description: humanizeEmojiName(emoji.name),
    group: emoji.group || "Emoji",
  };
}

export function filterEmojiItems(query: string): EmojiMenuItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return gitHubEmojis.slice(0, MAX_RESULTS).map(toMenuItem);
  const matches = gitHubEmojis.filter((emoji) => {
    const haystack = [emoji.name, ...emoji.shortcodes, ...(emoji.tags ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
  return matches.slice(0, MAX_RESULTS).map(toMenuItem);
}

// Passed as `Emoji.configure({ suggestion: createEmojiSuggestion() })` in
// extensions/index.ts.
export function createEmojiSuggestion() {
  return {
    items: ({ query }: { query: string }) => filterEmojiItems(query),
    render: createCommandMenuRender<EmojiMenuItem, { name: string }>(
      (item) => ({ name: item.name }),
    ),
  };
}
