"use client";

import { CircleUser } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/modules/identity/ui";

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
          <SignOutButton className="flex min-h-11 w-full items-center gap-2 rounded-input px-3 text-fg text-sm hover:bg-hover" />
        </div>
      )}
    </div>
  );
}
