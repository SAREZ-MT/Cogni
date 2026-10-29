"use client";

// H7 (editor polish round 2): the bubble toolbar's "Texto" menu — the font
// family of the selected text (text-style-options.ts), each family
// previewed in its own face. H8-2: the size has its own compact menu right
// next to it (`FontSizeMenu`), whose trigger shows the current size, so the
// sizes no longer sit below the long font list.
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { ChevronDown, Type } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { focusEditorView } from "./focus-editor-view";
import {
  applyFontFamily,
  applyFontSize,
  currentFontFamily,
  currentFontSize,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  type FontSizeOption,
} from "./text-style-options";

// Radio values must be strings; the default options store no value.
const DEFAULT_VALUE = "default";

// Normal stores no size; its pixel value is the editor's 16px body.
function sizeInPixels(option: FontSizeOption): string {
  return option.value ? option.value.replace("px", "") : "16";
}

export interface TextStyleMenuProps {
  editor: Editor;
  triggerClassName: string;
}

export function TextStyleMenu({
  editor,
  triggerClassName,
}: TextStyleMenuProps) {
  const family = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      currentFontFamily(current).value ?? DEFAULT_VALUE,
  });

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Fuente"
              data-testid="bubble-toolbar-text-style"
              className={triggerClassName}
            >
              <Type aria-hidden="true" size={16} strokeWidth={1.75} />
              <ChevronDown aria-hidden="true" size={12} strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Fuente</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="editor-surface max-h-(--radix-dropdown-menu-content-available-height) min-w-48 overflow-y-auto p-1"
      >
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FontSizeMenu({ editor, triggerClassName }: TextStyleMenuProps) {
  const sizeLabel = useEditorState({
    editor,
    selector: ({ editor: current }) => currentFontSize(current).label,
  });
  const current =
    FONT_SIZE_OPTIONS.find((option) => option.label === sizeLabel) ??
    FONT_SIZE_OPTIONS[1];

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Tamaño de texto: ${current.label}`}
              data-testid="bubble-toolbar-font-size"
              className={triggerClassName}
            >
              <span className="min-w-[2ch] text-center text-[13px] tabular-nums">
                {sizeInPixels(current)}
              </span>
              <ChevronDown aria-hidden="true" size={12} strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Tamaño</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="editor-surface min-w-40 p-1"
      >
        <DropdownMenuRadioGroup
          value={current.value ?? DEFAULT_VALUE}
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
              className="text-[13.5px] whitespace-nowrap"
            >
              {option.label}
              <span className="ml-auto pl-4 text-xs tabular-nums text-fg-muted">
                {sizeInPixels(option)}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
