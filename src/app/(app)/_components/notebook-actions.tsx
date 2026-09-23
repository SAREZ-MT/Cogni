"use client";

import type { ReactNode } from "react";
import {
  ActiveImportsProvider,
  ImportingPageBadge,
  ImportPdfMenuItem,
  PdfImportProvider,
} from "@/modules/ingestion";
// Deep import, not `@/modules/notebooks`'s public index.ts: that barrel
// also re-exports `createNotebooksServerApi` (server-api.ts), which pulls
// `notebooks/infrastructure` — and its `import "server-only"` — into the
// module graph. Next.js resolves a "use client" file's whole import graph
// at build time regardless of tree-shaking, so importing anything through
// that barrel from here breaks the client build. This one symbol is a
// plain "use client" React context with no server dependency, so a direct
// import is safe and does not cross `cross-module-via-index`
// (.dependency-cruiser.cjs only restricts modules importing each other,
// not `src/app`).
import { NotebookActionsSlotProvider } from "@/modules/notebooks/ui/notebook-actions-slot";

// design.md, "Decision: Menú de acciones del cuaderno con slot inyectado
// desde la raíz de composición", step 5 — the one place `notebooks` and
// `ingestion` meet. `notebooks` cannot import `ingestion`
// (`cross-module-via-index`), so this composition root injects
// `ingestion`'s menu entry and page badge through the slot
// `notebooks/ui/notebook-actions-slot.tsx` exposes. `initialPageIds` comes
// from a server-side `getActiveImports()` call in layout.tsx (degrades to
// `[]` there on failure), so the sidebar's importing badge is correct on
// first paint. layout.tsx wraps `<SidebarTree />` with this component.
export function NotebookActions({
  children,
  initialPageIds,
}: {
  children: ReactNode;
  initialPageIds: string[];
}) {
  return (
    <ActiveImportsProvider initialPageIds={initialPageIds}>
      <PdfImportProvider>
        <NotebookActionsSlotProvider
          menuItems={(notebook, helpers) => (
            <ImportPdfMenuItem
              notebook={notebook}
              onImported={helpers.refreshTree}
            />
          )}
          pageBadge={(page) => <ImportingPageBadge pageId={page.id} />}
        >
          {children}
        </NotebookActionsSlotProvider>
      </PdfImportProvider>
    </ActiveImportsProvider>
  );
}
