"use client";

import { MoreVertical } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import {
  AccountMenuPanel,
  displayNameFromEmail,
  initialsFrom,
  useAccountMenu,
} from "./user-menu";

type SidebarUserCardProps = {
  user: { id: string; email: string | null };
  collapsed?: boolean;
};

// Pinned sidebar footer card (comp-sidebar.html .account, Engram obs 140):
// gradient avatar + name/caption + a kebab opening the same account menu the
// topbar uses (AccountMenuPanel, ./user-menu.tsx). The trigger's accessible
// name is deliberately NOT "Menú de usuario ...": Playwright's getByRole
// name match is a case-insensitive SUBSTRING by default (confirmed against
// the installed @playwright/test docs), so any name containing that phrase
// would make `page.getByRole("button", { name: "Menú de usuario" })` match
// two buttons and break the existing `auth`/`shell-empty-state` e2e specs.
export function SidebarUserCard({
  user,
  collapsed = false,
}: SidebarUserCardProps) {
  const { open, setOpen, rootRef } = useAccountMenu();
  const displayName = displayNameFromEmail(user.email);
  const initials = initialsFrom(displayName);
  const caption = "Plan gratuito";

  const avatar = (
    <span
      aria-hidden="true"
      className="avatar-gradient flex size-8 shrink-0 items-center justify-center rounded-full font-semibold text-[12px] text-white"
    >
      {initials}
    </span>
  );

  if (collapsed) {
    // R3-collapsed-card-unreachable: this used to be a non-focusable
    // <span>, unreachable by keyboard. It is now a real button that opens
    // the same account menu as the expanded state, keeping the same
    // "Opciones de la cuenta" accessible name (avoids the "Menú de
    // usuario" substring collision noted below).
    return (
      <div
        ref={rootRef}
        className="relative mt-auto flex justify-center border-border-subtle border-t px-3 py-3"
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Opciones de la cuenta"
                onClick={() => setOpen((value) => !value)}
                className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {avatar}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{displayName}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {open && (
          <AccountMenuPanel className="bottom-full left-1/2 mb-2 -translate-x-1/2" />
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative mt-auto flex items-center gap-2.5 border-border-subtle border-t px-3 py-3"
    >
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-[13px] text-fg">
          {displayName}
        </span>
        <span className="truncate text-[11px] text-fg-muted">{caption}</span>
      </div>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Opciones de la cuenta"
        onClick={() => setOpen((value) => !value)}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-neutral-100 hover:text-fg"
      >
        <MoreVertical aria-hidden="true" size={16} strokeWidth={1.75} />
      </button>

      {open && <AccountMenuPanel className="right-0 bottom-full mb-2" />}
    </div>
  );
}
