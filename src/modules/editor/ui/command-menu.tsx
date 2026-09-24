"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { IconTile, type IconTileProps } from "@/shared/ui/icon-tile";
import { cn } from "@/shared/ui/utils";

export interface CommandMenuItem {
  id: string;
  label: string;
  keywords?: string[];
  // S6a (odd/tasks/app-shell-restyle.md), Editor directive: the restyled
  // "/" menu shows an icon tile, an optional description line and a group
  // heading per item, matching the Tiptap docs Notion-style editor. All
  // three stay optional so a caller (or this file's own tests) can keep
  // passing the plain `{ id, label, keywords }` shape unchanged.
  icon?: LucideIcon;
  description?: string;
  group?: string;
  // E2b scope C (emoji/mention popups, same CommandMenu chrome as the "/"
  // menu): a literal glyph (an emoji character) shown inside the tile
  // instead of a LucideIcon — mutually exclusive with `icon`, `icon` wins
  // if both are somehow set.
  iconGlyph?: string;
  // E2b scope C: tints the tile with a design-system tone (mention rows
  // use the target page's notebook pastel color) instead of the default
  // neutral `bg-hover`. Reuses IconTile's own tone union so a caller can
  // only pass a real design-system tone.
  iconTone?: IconTileProps["tone"];
}

export interface CommandMenuProps {
  items: CommandMenuItem[];
  query: string;
  onSelect: (item: CommandMenuItem) => void;
  onClose: () => void;
}

// specs/editor/spec.md, "Menú de comandos `/`": the "/" popup itself never
// has DOM focus (the user keeps typing in the Tiptap document), so this
// component listens for arrow/Enter/Escape globally while mounted instead
// of relying on cmdk's own input-focused keyboard handling. It is a plain
// presentational component with no Tiptap import, embeddable either inside
// the real editor (editor/ui/tiptap/slash-command.tsx) or, as here, tested
// in isolation.
export function CommandMenu({
  items,
  query,
  onSelect,
  onClose,
}: CommandMenuProps) {
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) => {
      const haystack = [item.label, ...(item.keywords ?? [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, query]);

  // Groups the already-filtered items by their declared `group`, keeping
  // each group's first-appearance order (a plain Map preserves insertion
  // order) — this is what keeps the rendered group order stable across
  // re-filters instead of resorting alphabetically. Items without a
  // `group` fall into one heading-less bucket ("") so callers that never
  // pass it (this file's own pre-S6a tests) render exactly as before.
  const groups = useMemo(() => {
    const byGroup = new Map<string, CommandMenuItem[]>();
    for (const item of filtered) {
      const key = item.group ?? "";
      const bucket = byGroup.get(key);
      if (bucket) bucket.push(item);
      else byGroup.set(key, [item]);
    }
    return [...byGroup.entries()];
  }, [filtered]);

  // S6a review follow-up (R3-grouped-order-divergence, folded into S6b):
  // `selectedIndex` MUST walk the same order the list below actually
  // renders (bucketed by group), not the flat pre-filter `filtered` array.
  // When the source data's groups aren't already contiguous (unlike the
  // real SLASH_COMMAND_ITEMS, grouped contiguously by construction) those
  // two orders diverge, and ArrowDown would highlight an item that isn't
  // the one visually right below the current selection. Bucketing once
  // here and indexing that flattened order keeps keyboard navigation and
  // the visual highlight in sync regardless of the source order.
  const orderedItems = useMemo(
    () => groups.flatMap(([, groupItems]) => groupItems),
    [groups],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset the selection whenever the query changes (a new keystroke re-
  // filters the list). Adjusting state during render instead of a
  // useEffect avoids a wasted extra render (react.dev, "Adjusting state
  // when a prop changes").
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setSelectedIndex(0);
  }

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      // Capture-phase + stopPropagation: while the menu is open, these keys
      // never reach the Tiptap editor underneath (no newline on Enter, no
      // cursor movement on the arrows).
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((current) =>
          orderedItems.length === 0 ? 0 : (current + 1) % orderedItems.length,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((current) =>
          orderedItems.length === 0
            ? 0
            : (current - 1 + orderedItems.length) % orderedItems.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const item = orderedItems[selectedIndex];
        if (item) onSelect(item);
        return;
      }
      if (event.key === "Escape") {
        // Intentionally does NOT stop propagation: when this menu is
        // mounted by editor/ui/tiptap/slash-command.ts, @tiptap/suggestion
        // has its own Escape handling on the editor view (clearing its
        // internal "active" match state and firing onExit, which is what
        // actually unmounts this component's portal). Swallowing the event
        // here would leave that internal state stuck. Standalone usage
        // (this component's own tests) only needs onClose to be called.
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown, true);
    return () => window.removeEventListener("keydown", handleKeydown, true);
  }, [orderedItems, selectedIndex, onSelect, onClose]);

  return (
    <Command
      data-testid="command-menu"
      className="min-w-64 max-h-80 overflow-y-auto rounded-lg border border-border-default bg-card p-1 shadow-md"
      // cmdk recomputes `data-selected` on its Item from this controlled
      // value, always overwriting a plain `data-selected` prop passed
      // straight to CommandItem — that was the bug (PR5b finding, flagged
      // as advisory in PR3b): the highlight never followed ArrowDown.
      // Driving cmdk's own selection API keeps keyboard and mouse
      // (onValueChange fires on pointer move too) in sync with one state.
      value={orderedItems[selectedIndex]?.id}
      onValueChange={(value) => {
        const index = orderedItems.findIndex((item) => item.id === value);
        if (index !== -1) setSelectedIndex(index);
      }}
    >
      <CommandList>
        {filtered.length === 0 ? (
          <CommandEmpty>no se encontraron bloques</CommandEmpty>
        ) : (
          groups.map(([group, groupItems]) => (
            <CommandGroup
              key={group || "__ungrouped__"}
              heading={group || undefined}
            >
              {groupItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  className="data-[selected=true]:bg-active data-[selected=true]:text-fg-active gap-2"
                  onSelect={() => onSelect(item)}
                >
                  {(item.icon || item.iconGlyph) && (
                    <IconTile
                      data-testid={`command-menu-item-icon-${item.id}`}
                      size="28"
                      radius="md"
                      tone={item.iconTone}
                      className={cn("shrink-0", !item.iconTone && "bg-hover")}
                    >
                      {item.icon ? (
                        <item.icon
                          aria-hidden="true"
                          size={15}
                          strokeWidth={1.75}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="text-[15px] leading-none"
                        >
                          {item.iconGlyph}
                        </span>
                      )}
                    </IconTile>
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13.5px]">{item.label}</span>
                    {item.description && (
                      <span className="text-fg-muted truncate text-xs">
                        {item.description}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))
        )}
      </CommandList>
    </Command>
  );
}
