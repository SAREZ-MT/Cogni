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
  // A disabled entry ("Técnicas"/"Cuenta" sections not built yet) renders as
  // a non-interactive row instead of a link: `hint` ("próximamente") shows
  // as inline muted text when expanded, and inside the tooltip when
  // collapsed (comp-sidebar.html, sidebar-preview.png).
  disabled?: boolean;
  hint?: string;
  collapsed?: boolean;
};

// Shared row styling for the link and the disabled-row variants (comp-
// sidebar.html .nav-item: 13.5px, 10px radius, 150ms transition).
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
}: NavItemProps) {
  const icon = (
    <Icon
      aria-hidden="true"
      size={16}
      strokeWidth={1.75}
      className={cn("shrink-0 opacity-75", active && "opacity-100")}
    />
  );

  const content = disabled ? (
    <div
      aria-disabled="true"
      className={cn(
        ROW_CLASS,
        "cursor-default text-fg-muted",
        collapsed && "justify-center px-0",
      )}
    >
      {icon}
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {hint && <span className="text-[11px] text-fg-muted">{hint}</span>}
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
        "text-fg-secondary hover:bg-neutral-100 hover:text-fg",
        active &&
          "bg-active font-medium text-fg-active hover:bg-active hover:text-fg-active",
        collapsed && "justify-center px-0",
      )}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
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
