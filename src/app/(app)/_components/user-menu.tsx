"use client";

import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/modules/identity/ui";
import { cn } from "@/shared/ui/utils";

type AccountUser = { id: string; email: string | null };

// No display-name field is fetched for the shell yet (layout.tsx only calls
// getCurrentUser()), so every trigger that needs a human-friendly label
// derives one from the email's local part instead of inventing one. Shared
// by the topbar avatar below and sidebar-user-card.tsx (S2 product
// decision 3: the same identity everywhere, not two divergent labels).
export function displayNameFromEmail(email: string | null): string {
  if (!email) return "Cuenta";
  const local = email.split("@")[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function initialsFrom(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

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
