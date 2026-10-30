"use client";

// H7 (editor polish round 2): the bubble toolbar's "Texto" menu — font
// family and size for the selected text (text-style-options.ts). One
// dropdown with two radio groups, like the toolbar's "Convertir en" and
// "Alineación" menus; each family is previewed in its own face.
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { ChevronDown, Type } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { focusEditorView } from "./focus-editor-view";
import {
  applyFontFamily,
  applyFontSize,
  currentFontFamily,
  currentFontSize,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
} from "./text-style-options";

// Radio values must be strings; the default options store no value.
const DEFAULT_VALUE = "default";

export interface TextStyleMenuProps {
  editor: Editor;
  triggerClassName: string;
}

export function TextStyleMenu({
  editor,
  triggerClassName,
}: TextStyleMenuProps) {
  const { family, size } = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      family: currentFontFamily(current).value ?? DEFAULT_VALUE,
      size: currentFontSize(current).value ?? DEFAULT_VALUE,
    }),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Texto: fuente y tamaño"
          data-testid="bubble-toolbar-text-style"
          className={triggerClassName}
        >
          <Type aria-hidden="true" size={16} strokeWidth={1.75} />
          <ChevronDown aria-hidden="true" size={12} strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="editor-surface max-h-(--radix-dropdown-menu-content-available-height) min-w-52 overflow-y-auto p-1"
      >
        <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-fg-muted">
          Fuente
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={family}
          onValueChange={(value) => {
            const option = FONT_FAMILY_OPTIONS.find(
              (candidate) => (candidate.value ?? DEFAULT_VALUE) === value,
            );
            if (!option) return;
            applyFontFamily(editor, option.value);
            focusEditorView(editor);
          }}
        >
          {FONT_FAMILY_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.label}
              value={option.value ?? DEFAULT_VALUE}
              data-testid={`text-style-family-${option.label}`}
              className="editor-font-preview text-[13.5px]"
              style={option.value ? { fontFamily: option.value } : undefined}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-fg-muted">
          Tamaño
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={size}
          onValueChange={(value) => {
            const option = FONT_SIZE_OPTIONS.find(
              (candidate) => (candidate.value ?? DEFAULT_VALUE) === value,
            );
            if (!option) return;
            applyFontSize(editor, option.value);
            focusEditorView(editor);
          }}
        >
          {FONT_SIZE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.label}
              value={option.value ?? DEFAULT_VALUE}
              data-testid={`text-style-size-${option.label}`}
              className="text-[13.5px]"
            >
              {option.label}
              <span className="ml-auto pl-4 text-xs tabular-nums text-fg-muted">
                {option.value ? option.value.replace("px", "") : "16"}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
