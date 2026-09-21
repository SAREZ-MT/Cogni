"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";

export interface CommandMenuItem {
  id: string;
  label: string;
  keywords?: string[];
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
          filtered.length === 0 ? 0 : (current + 1) % filtered.length,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((current) =>
          filtered.length === 0
            ? 0
            : (current - 1 + filtered.length) % filtered.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const item = filtered[selectedIndex];
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
  }, [filtered, selectedIndex, onSelect, onClose]);

  return (
    <Command
      data-testid="command-menu"
      className="w-64 rounded-lg border border-border bg-popover shadow-lg"
    >
      <CommandList>
        {filtered.length === 0 ? (
          <CommandEmpty>no se encontraron bloques</CommandEmpty>
        ) : (
          <CommandGroup heading="bloques">
            {filtered.map((item, index) => (
              <CommandItem
                key={item.id}
                data-selected={index === selectedIndex}
                onSelect={() => onSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
