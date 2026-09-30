import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Keycap } from "@/shared/ui/keycap";
import { Pill } from "@/shared/ui/pill";
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
          <Pill
            size="sm"
            tone="neutral"
            className="ml-auto shrink-0 bg-neutral-200/50 text-[10px]"
          >
            pronto
          </Pill>
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
                <Keycap key={key}>{key}</Keycap>
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
