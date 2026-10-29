"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export interface UnsavedChangesGuardProps {
  // There are unsaved changes: leaving must be confirmed.
  when: boolean;
}

// The in-app links the guard stops: same origin, same tab, no download, no
// modifier key, and not only a jump to a hash of this page.
function guardedHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

// Leaving an edit page with unsaved changes (Phase 8 H18, user 2026-10-29):
// a reload, a closed tab or an external address get the browser's own
// `beforeunload` prompt (the only one a browser allows); an in-app link
// (breadcrumb, sidebar, back link) is held and confirmed in an app dialog,
// never a native `confirm`. The click is caught on the document in the
// capture phase, before Next.js' Link sees it.
export function UnsavedChangesGuard({ when }: UnsavedChangesGuardProps) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!when) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older browsers need a returnValue to show the prompt.
      event.returnValue = "";
    }
    function onClick(event: MouseEvent) {
      const href = guardedHref(event);
      if (href === null) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when]);

  return (
    <Dialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) setPendingHref(null);
      }}
    >
      <DialogContent
        data-testid="unsaved-changes-dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>¿Salir sin guardar?</DialogTitle>
          <DialogDescription>
            Tienes cambios sin guardar. Si sales ahora, se pierden.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingHref(null)}>
            Seguir editando
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const href = pendingHref;
              setPendingHref(null);
              if (href) router.push(href);
            }}
          >
            Salir sin guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
