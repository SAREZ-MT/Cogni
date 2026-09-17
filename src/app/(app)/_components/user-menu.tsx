"use client";

import { CircleUser, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Sign-out becomes a Server Action in PR3 (task 3.6). Until then the item
// only leads to the login screen.
export function UserMenu() {
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

      {open && (
        <div
          role="menu"
          aria-label="Menú de usuario"
          className="absolute top-full right-0 mt-2 min-w-44 rounded-lg border border-border-default bg-card p-1 shadow-md"
        >
          <Link
            role="menuitem"
            href="/login"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 rounded-input px-3 text-fg text-sm hover:bg-hover"
          >
            <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
            Cerrar sesión
          </Link>
        </div>
      )}
    </div>
  );
}
