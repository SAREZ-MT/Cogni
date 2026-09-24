"use client";

// Route-local bridge between notebooks' framework-agnostic
// PageTitleEditor and this app's own breadcrumb context (app/(app)/
// _components/breadcrumb.tsx) — notebooks/ui must never import from
// src/app (modules stay app-agnostic), so this is the one place that owns
// both. Sole publisher of this route's breadcrumb trail (the old static
// `<SetBreadcrumb items={...}>` that page.tsx rendered directly is gone —
// see this component's usage there): publishing the live, locally-edited
// title here keeps typing smooth (no server round-trip needed just to
// update the crumb), while `router.refresh()` on a *successful* save still
// keeps Home/the sidebar/list views in sync with the renamed page, per the
// debounce's own ~600ms cadence rather than on every keystroke.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
// Deep import, not `@/modules/notebooks`'s public index.ts: that barrel
// also re-exports `createNotebooksServerApi` (server-api.ts), which pulls
// `notebooks/infrastructure` — and its `import "server-only"` — into the
// module graph. Next.js resolves a "use client" file's whole import graph
// at build time regardless of tree-shaking, so importing anything through
// that barrel from here breaks the client build (same reasoning as
// notebook-actions.tsx's deep import of notebook-actions-slot.tsx).
import { PageTitleEditor } from "@/modules/notebooks/ui/page-title-editor";
import { SetBreadcrumb } from "../../../../../_components/breadcrumb";

export interface PageTitleProps {
  pageId: string;
  notebookId: string;
  initialTitle: string;
  notebookTitle: string | null;
}

export function PageTitle({
  pageId,
  notebookId,
  initialTitle,
  notebookTitle,
}: PageTitleProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);

  const crumbLabel = title.trim() || "Sin título";
  // Runtime-error fix (E2 coordinator report, "Maximum update depth
  // exceeded"): SetBreadcrumb's own effect below is correctly guarded on
  // `[publish, items]` (breadcrumb.tsx's S3 follow-up), but `items` still
  // has to be the SAME array reference across renders that don't actually
  // change the crumb — without this memo, every render of PageTitle (e.g.
  // one triggered by any unrelated context change bubbling through this
  // subtree) handed SetBreadcrumb a brand-new array literal, re-running its
  // effect and re-publishing into the BreadcrumbProvider on every single
  // render instead of only when the trail's actual labels change.
  const breadcrumbItems = useMemo(
    () =>
      notebookTitle
        ? [
            { label: "Cuadernos", href: "/notebooks" },
            {
              label: notebookTitle,
              href: `/notebooks/${notebookId}`,
            },
            { label: crumbLabel },
          ]
        : [{ label: "Cuadernos", href: "/notebooks" }, { label: crumbLabel }],
    [notebookId, notebookTitle, crumbLabel],
  );

  return (
    <>
      <SetBreadcrumb items={breadcrumbItems} />
      <PageTitleEditor
        pageId={pageId}
        initialTitle={initialTitle}
        onSaved={(next) => {
          setTitle(next);
          router.refresh();
        }}
      />
    </>
  );
}
