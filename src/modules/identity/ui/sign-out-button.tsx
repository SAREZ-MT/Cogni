"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "../actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" role="menuitem" className={className}>
        <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
        Cerrar sesión
      </button>
    </form>
  );
}
