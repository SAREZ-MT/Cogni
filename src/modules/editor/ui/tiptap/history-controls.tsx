"use client";

// H7 (editor polish round 2): subtle undo/redo arrows beside the page's
// "Editada…" status line (editor.tsx portals them with the autosave
// status). They run the editor's own history (StarterKit's UndoRedo), are
// disabled when there is nothing to undo or redo, and name their
// shortcuts in a tooltip and `aria-keyshortcuts`.
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Redo2, Undo2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { focusEditorView } from "./focus-editor-view";

const BUTTON_CLASS =
  "flex size-7 items-center justify-center rounded-md text-fg-muted outline-none transition-colors duration-150 hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35";

export interface HistoryControlsProps {
  editor: Editor;
}

export function HistoryControls({ editor }: HistoryControlsProps) {
  const { canUndo, canRedo } = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  function run(command: "undo" | "redo") {
    if (command === "undo") editor.chain().undo().run();
    else editor.chain().redo().run();
    focusEditorView(editor);
  }

  return (
    <TooltipProvider>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this is a toolbar-like pair. */}
      <div
        role="group"
        aria-label="Historial"
        data-testid="history-controls"
        className="inline-flex items-center gap-0.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Deshacer cambio"
              aria-keyshortcuts="Meta+Z Control+Z"
              data-testid="history-undo"
              disabled={!canUndo}
              onClick={() => run("undo")}
              className={BUTTON_CLASS}
            >
              <Undo2 aria-hidden="true" size={15} strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Deshacer · ⌘Z</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Rehacer cambio"
              aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
              data-testid="history-redo"
              disabled={!canRedo}
              onClick={() => run("redo")}
              className={BUTTON_CLASS}
            >
              <Redo2 aria-hidden="true" size={15} strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Rehacer · ⇧⌘Z</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
