"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignOutButton, TERMS_COPY } from "@/modules/identity/ui";
import { cn } from "@/shared/ui/utils";

import { displayNameFromEmail, initialsFrom } from "./account-name";

type AccountUser = { id: string; email: string | null };

// The name helpers live in account-name.ts (a plain module) because the Home
// Server Component needs them too; re-exported here for the client-side
// consumers that already import them from this file.
export { displayNameFromEmail, initialsFrom };

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
      <Link
        href="/terminos"
        role="menuitem"
        className="flex min-h-11 w-full items-center gap-2 rounded-input px-3 text-fg text-sm hover:bg-hover"
      >
        <FileText aria-hidden="true" size={16} strokeWidth={1.75} />
        {TERMS_COPY.links.menu}
      </Link>
      <SignOutButton className="flex min-h-11 w-full items-center gap-2 rounded-input px-3 text-fg text-sm hover:bg-hover" />
    </div>
  );
}

// Topbar trigger (comp-topbar.html, Engram obs 140 topbar anatomy): a
// gradient avatar with the user's initials, not a generic person icon.
export function UserMenu({ user }: { user: AccountUser }) {
  const { open, setOpen, rootRef } = useAccountMenu();
  const displayName = displayNameFromEmail(user.email);
  const initials = initialsFrom(displayName);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de usuario"
        onClick={() => setOpen((value) => !value)}
        className="avatar-gradient flex size-8 items-center justify-center rounded-full font-semibold text-[12px] text-white transition-opacity hover:opacity-90"
      >
        {initials}
      </button>

      {open && <AccountMenuPanel className="top-full right-0 mt-2" />}
    </div>
  );
}
