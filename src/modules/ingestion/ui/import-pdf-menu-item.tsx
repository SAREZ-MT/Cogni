"use client";

import { FileUp } from "lucide-react";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { INGESTION_COPY } from "./ingestion-copy";
import { useNotebookImport, usePdfImport } from "./pdf-import-provider";

export interface ImportPdfMenuItemProps {
  notebook: { id: string; title: string };
  onImported?: () => void;
}

// design.md, "Decision: Menú de acciones del cuaderno con slot inyectado
// desde la raíz de composición", step 4. Injected into the notebook's
// "Acciones" menu through notebooks' slot (notebook-actions.tsx, T10's app
// composition root); notebook-item.tsx renders whatever this returns.
export function ImportPdfMenuItem({
  notebook,
  onImported,
}: ImportPdfMenuItemProps) {
  const { start } = usePdfImport();
  const { status } = useNotebookImport(notebook.id);
  // "busy" (T10 follow-up: R3-provider-concurrent-imports-clobber-banner)
  // means another notebook is currently uploading/queued — only one PDF
  // import may run at a time.
  const disabled =
    status === "uploading" || status === "queued" || status === "busy";

  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() =>
        start({ notebookId: notebook.id, onPageCreated: onImported })
      }
    >
      <FileUp aria-hidden="true" size={16} strokeWidth={1.75} />
      {INGESTION_COPY.importPdf}
    </DropdownMenuItem>
  );
}
