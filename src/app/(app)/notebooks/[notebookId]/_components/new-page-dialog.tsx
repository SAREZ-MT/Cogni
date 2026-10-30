"use client";

import { FileUp } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useFormStatus } from "react-dom";
// Deep imports, the same as `_components/notebook-actions.tsx`: the
// ingestion barrel re-exports its Server Actions, but the picker hooks and
// the format list are plain client code. The app layer is where notebooks
// and ingestion meet (`cross-module-via-index` only binds modules).
import {
  useDocumentImport,
  useNotebookImport,
} from "@/modules/ingestion/ui/document-import-provider";
import { UI_IMPORT_FORMATS } from "@/modules/ingestion/ui/import-formats";
import type { NotebookColor } from "@/modules/notebooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { FileFormatBadge } from "@/shared/ui/file-format-badge";
import { PageSheet } from "@/shared/ui/page-sheet";

interface NewPageDialogProps {
  notebookId: string;
  // The route's Server Action: creates a blank page and redirects to its
  // editor (H5-T3).
  createBlankPage: () => Promise<void>;
  // The "Nueva página" control that opens the dialog (grid tile, list row
  // or the empty state's CTA).
  trigger: ReactNode;
  tone?: NotebookColor | null;
}

const OPTION_CLASS =
  "group/option flex w-full flex-col items-start gap-3 rounded-2xl border border-border-default bg-card p-3 text-left outline-none transition-[translate,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-[0_10px_24px_-14px_rgb(109_40_217/0.35)] focus-visible:border-primary-400 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none";

const ART_CLASS =
  "flex h-28 w-full items-center justify-center rounded-xl bg-neutral-50 transition-colors duration-200 group-hover/option:bg-primary-50";

function OptionText({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex flex-col gap-1 px-1 pb-1">
      <span className="font-semibold text-[15px] text-fg">{title}</span>
      <span className="text-[13px] text-fg-muted leading-snug">{hint}</span>
    </span>
  );
}

// Inside the blank option's form so `useFormStatus` sees its submission.
function BlankOption({ tone }: { tone?: NotebookColor | null }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={OPTION_CLASS}
    >
      <span aria-hidden="true" className={ART_CLASS}>
        <span className="h-[86px] w-[70px] transition-transform duration-200 group-hover/option:-rotate-2 motion-reduce:transform-none">
          <PageSheet tone={tone} />
        </span>
      </span>
      <OptionText
        title={pending ? "Creando página…" : "Página en blanco"}
        hint="Empieza a escribir tus apuntes desde cero."
      />
    </button>
  );
}

// Phase 8 H5-T3 (user request 2026-10-29): every "Nueva página" asks how to
// create the page, in a dialog with two large option cards. "Página en
// blanco" submits the route's action, which creates the page and opens its
// editor. "Importar un documento" closes the dialog and starts the existing
// document import (`DocumentImportProvider`, mounted app-wide by
// `notebook-actions.tsx`): its picker takes only PDF, DOCX and PPTX, it
// shows its own progress banner and errors, and it opens the new page's
// editor once the import job has started. Radix gives focus trapping,
// Escape to close and focus return to the trigger.
export function NewPageDialog({
  notebookId,
  createBlankPage,
  trigger,
  tone,
}: NewPageDialogProps) {
  const [open, setOpen] = useState(false);
  const { start } = useDocumentImport();
  const { status } = useNotebookImport(notebookId);
  // One import at a time (the provider's own rule).
  const importBusy =
    status === "uploading" || status === "queued" || status === "busy";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="gap-5 p-5 sm:max-w-[560px] sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-semibold text-lg">
            Nueva página
          </DialogTitle>
          <DialogDescription>
            Elige cómo quieres empezar. Siempre puedes seguir escribiendo
            después.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <form action={createBlankPage} className="contents">
            <BlankOption tone={tone} />
          </form>
          <button
            type="button"
            disabled={importBusy}
            className={OPTION_CLASS}
            onClick={() => {
              // The provider clicks its hidden file input synchronously,
              // inside this click, so the browser allows the picker.
              start({ notebookId });
              setOpen(false);
            }}
          >
            <span aria-hidden="true" className={ART_CLASS}>
              <span className="flex flex-col items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-[0_8px_18px_-8px_rgb(109_40_217/0.55)]">
                  <FileUp size={18} strokeWidth={1.75} />
                </span>
                <span className="flex gap-1.5">
                  {UI_IMPORT_FORMATS.map((format) => (
                    <FileFormatBadge key={format} format={format} />
                  ))}
                </span>
              </span>
            </span>
            <OptionText
              title="Importar un documento"
              hint="Sube un PDF, Word o PowerPoint de hasta 20 MB y lo convertimos en una página."
            />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
