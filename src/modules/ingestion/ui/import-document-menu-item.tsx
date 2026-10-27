"use client";

import { FileUp } from "lucide-react";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import {
  useDocumentImport,
  useNotebookImport,
} from "./document-import-provider";
import { INGESTION_COPY } from "./ingestion-copy";

export interface ImportDocumentMenuItemProps {
  notebook: { id: string; title: string };
  onImported?: () => void;
}

// design.md, "Decision: Menú de acciones del cuaderno con slot inyectado
// desde la raíz de composición", step 4. Injected into the notebook's
// "Acciones" menu through notebooks' slot (notebook-actions.tsx, T10's app
// composition root); notebook-item.tsx renders whatever this returns.
export function ImportDocumentMenuItem({
  notebook,
  onImported,
}: ImportDocumentMenuItemProps) {
  const { start } = useDocumentImport();
  const { status } = useNotebookImport(notebook.id);
  // "busy" (T10 follow-up: R3-provider-concurrent-imports-clobber-banner)
  // means another notebook is currently uploading/queued — only one
  // document import may run at a time.
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
      {INGESTION_COPY.importDocument}
    </DropdownMenuItem>
  );
}
