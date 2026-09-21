"use client";

// Bubble menu wrapper around `HighlightPickerControls` (specs/editor/
// spec.md, "Paleta de resaltado de Cogni y callouts"). Only shown while
// there is a non-empty text selection, matching a typical "select text to
// format it" affordance.
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { HighlightPickerControls } from "./highlight-picker-controls";

export interface HighlightPickerProps {
  editor: Editor;
}

export function HighlightPicker({ editor }: HighlightPickerProps) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="cogni-highlight-picker"
      shouldShow={({ state }) => !state.selection.empty}
    >
      <HighlightPickerControls editor={editor} />
    </BubbleMenu>
  );
}
