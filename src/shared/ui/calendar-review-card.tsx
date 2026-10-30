import Link from "next/link";
import {
  TECHNIQUE_ACCENT_CLASS,
  type TechniqueTone,
} from "@/shared/ui/technique-card";
import { TechniqueStatusPill } from "@/shared/ui/technique-status-pill";
import { cn } from "@/shared/ui/utils";

export interface CalendarReviewCardProps {
  href: string;
  tone: TechniqueTone;
  // Page title.
  title: string;
  // Notebook.
  detail: string;
  techniqueLabel: string;
  // Full name (technique, page, amount): also what the colour says.
  "aria-label": string;
  className?: string;
}

// Review card of the month's right panel (Phase 8 H3, approved mockup
// 2026-10-19): one fixed size whatever the title — a 60px-high hairline
// card with a 3px bar in the technique's accent on the left, the page title
// on its own line (the card's full width) over a line with the notebook and
// the technique's status pill, which never wraps (title and notebook truncate
// to one line, full text as tooltip). The whole card is a link to the page.
// Hover and keyboard focus lift it gently (a primary-300 border, a
// primary-100 wash and a soft violet shadow; a 2px rise only under
// motion-safe), never changing its size.
export function CalendarReviewCard({
  href,
  tone,
  title,
  detail,
  techniqueLabel,
  "aria-label": ariaLabel,
  className,
}: CalendarReviewCardProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      data-slot="calendar-review-card"
      className={cn(
        "flex h-[60px] min-w-0 items-center gap-3 rounded-xl border border-border-subtle bg-card py-2.5 pr-3 pl-2.5 no-underline transition-[border-color,background-color,box-shadow,translate] duration-200 ease-out focus-visible:outline-none",
        // Hover and keyboard focus share one gentle lift: a mid violet
        // border, a faint violet wash and a soft violet-tinted shadow, plus
        // a 2px rise only when motion is welcome (colours only otherwise).
        "hover:border-primary-300 hover:bg-primary-100/60 hover:shadow-[0_4px_14px_-6px_rgb(124_58_237/0.32)] focus-visible:border-primary-300 focus-visible:bg-primary-100/60 focus-visible:shadow-[0_4px_14px_-6px_rgb(124_58_237/0.32)] focus-visible:ring-2 focus-visible:ring-primary-200",
        "motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5",
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-part="accent"
        className={cn(
          "w-[3px] shrink-0 self-stretch rounded-full",
          TECHNIQUE_ACCENT_CLASS[tone],
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          data-part="title"
          title={title}
          className="truncate font-semibold text-[13px] text-fg leading-snug"
        >
          {title}
        </span>
        <span data-part="meta" className="flex min-w-0 items-center gap-2">
          <span
            data-part="detail"
            title={detail}
            className="min-w-0 truncate text-fg-muted text-xs"
          >
            {detail}
          </span>
          <TechniqueStatusPill
            tone={tone}
            size="sm"
            className="ml-auto shrink-0 whitespace-nowrap"
          >
            {techniqueLabel}
          </TechniqueStatusPill>
        </span>
      </span>
    </Link>
  );
}
