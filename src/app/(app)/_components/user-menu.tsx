"use client";

import { CircleUser } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/modules/identity/ui";
import { cn } from "@/shared/ui/utils";

// Shared open/close + outside-click/Escape behaviour for every trigger that
// opens the account menu (the topbar avatar below, and the sidebar footer
// card's kebab in sidebar-user-card.tsx — S2 product decision 3: the same
// menu, not two competing implementations). Each caller owns its own
// `rootRef` container and open state, so two triggers can exist on screen
// at once without colliding.
export function useAccountMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return { open, setOpen, rootRef };
}

// The menu content itself: "Cerrar sesión" lives here exactly once. `className`
// positions the panel relative to its trigger (topbar: below-right; sidebar
// footer card: above-right, since it sits at the bottom of the column).
export function AccountMenuPanel({ className }: { className?: string }) {
  return (
    <div
      role="menu"
      aria-label="Menú de usuario"
      className={cn(
        "absolute min-w-44 rounded-lg border border-border-default bg-card p-1 shadow-md",
        className,
      )}
    >
      <SignOutButton className="flex min-h-11 w-full items-center gap-2 rounded-input px-3 text-fg text-sm hover:bg-hover" />
    </div>
  );
}

export function UserMenu() {
  const { open, setOpen, rootRef } = useAccountMenu();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de usuario"
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-full text-fg-secondary hover:bg-hover hover:text-fg"
      >
        <CircleUser aria-hidden="true" size={24} strokeWidth={1.5} />
      </button>

      {open && <AccountMenuPanel className="top-full right-0 mt-2" />}
    </div>
  );
}
