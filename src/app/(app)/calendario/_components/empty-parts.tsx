import { ArrowRight } from "lucide-react";
import Link from "next/link";

// The calendar's empty-state illustration (Phase 8 H3): people around a big
// wall calendar, 1600×1102, with its flat grey background keyed out to
// transparency so it sits on the empty state's own gradient.
export const CALENDAR_EMPTY_IMAGE = {
  src: "/illustrations/calendar-empty.webp",
  width: 1600,
  height: 1102,
} as const;

// The quiet follow-up under an empty state's message: violet text and a
// small arrow, no button chrome.
export function QuietLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group/link inline-flex items-center gap-1.5 rounded-sm font-semibold text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
      <ArrowRight
        aria-hidden="true"
        size={15}
        strokeWidth={2}
        className="transition-transform group-hover/link:translate-x-0.5"
      />
    </Link>
  );
}
