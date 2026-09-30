import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/ui/utils";

type NavItemProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  // A disabled entry ("Dashboard"/"Horarios"/"Técnicas"/"Configuración" not
  // built yet) renders as a non-interactive row instead of a link, with a
  // "pronto" pill on the right (design/shell-look, studyplatform obs 140).
  // `hint` only feeds the collapsed tooltip's text now.
  disabled?: boolean;
  hint?: string;
  collapsed?: boolean;
  // Keycap hint at the right of the row (comp-sidebar.html .shortcut):
  // "Inicio" is the only entry that gets one.
  shortcut?: string[];
};

// Shared row styling for the link and the disabled-row variants (13.5px,
// 10px radius, 150ms transition — comp-sidebar.html .nav-item).
const ROW_CLASS =
  "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] transition-colors duration-200 ease-default";

export function NavItem({
  href,
  icon: Icon,
  label,
  active = false,
  disabled = false,
  hint,
  collapsed = false,
  shortcut,
}: NavItemProps) {
  const icon = (
    <Icon
      aria-hidden="true"
      size={18}
      strokeWidth={1.75}
      className={cn("shrink-0 opacity-75", active && "opacity-100")}
    />
  );

  const content = disabled ? (
    <div
      aria-disabled="true"
      className={cn(
        ROW_CLASS,
        "cursor-default text-neutral-300",
        collapsed && "justify-center px-0",
      )}
    >
      {icon}
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          <span className="ml-auto shrink-0 rounded-full bg-neutral-200/50 px-2 py-0.5 font-semibold text-[10px] text-fg-muted">
            pronto
          </span>
        </>
      )}
    </div>
  ) : (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        ROW_CLASS,
        "text-fg-secondary hover:bg-neutral-100/90 hover:text-fg",
        active &&
          "bg-active-strong/90 font-medium text-fg-active hover:bg-active-strong/90 hover:text-fg-active",
        collapsed && "justify-center px-0",
      )}
    >
      {icon}
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {shortcut && shortcut.length > 0 && (
            <span className="flex shrink-0 gap-[3px]">
              {shortcut.map((key) => (
                <span
                  key={key}
                  className="rounded-[5px] border border-neutral-200/60 bg-neutral-200/50 px-[5px] py-[2px] font-medium text-[10px] text-fg-muted"
                >
                  {key}
                </span>
              ))}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (!collapsed) return content;

  const tooltipLabel = disabled && hint ? `${label} (${hint})` : label;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{tooltipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
