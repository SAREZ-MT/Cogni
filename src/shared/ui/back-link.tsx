import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface BackLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

// Eyebrow-row "back" affordance (user feedback, design/shell-look: no way
// back from the notebook detail screen or the editor except the sidebar).
// Notion-style: muted text that only picks up contrast on hover/focus, a
// small leading arrow, never a full button. Self-start so it never stretches
// full-width inside a flex column.
export function BackLink({ href, children, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "-ml-1 inline-flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-[13px] text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.75} />
      {children}
    </Link>
  );
}
