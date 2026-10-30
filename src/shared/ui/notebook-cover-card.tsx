import Link from "next/link";
import type { ReactNode } from "react";
import { NotebookCover } from "@/shared/ui/notebook-cover";
import { cn } from "@/shared/ui/utils";

// Keys match the notebooks domain's pastel palette (NotebookColor) and
// IconTile's tones 1:1, so a notebook's stored colour passes straight
// through. Shared UI cannot import the module, hence its own union.
export type NotebookCoverTone =
  | "pink"
  | "green"
  | "yellow"
  | "purple"
  | "orange"
  | "blue"
  | "mint";

const NOTEBOOK_COVER_TONES: readonly string[] = [
  "pink",
  "green",
  "yellow",
  "purple",
  "orange",
  "blue",
  "mint",
] satisfies readonly NotebookCoverTone[];

// The tone a notebook's stored colour draws with. `notebooks.color` is free
// text in the database, so a missing colour and one outside the palette (a
// legacy or hand-edited row) both fall back to purple instead of crashing
// the per-tone lookups of the covers, strips and sheets.
export function notebookToneKey(
  tone: string | null | undefined,
): NotebookCoverTone {
  return tone && NOTEBOOK_COVER_TONES.includes(tone)
    ? (tone as NotebookCoverTone)
    : "purple";
}

interface ToneLook {
  // Border plus the 160deg gradient stops of `NotebookCover`.
  cover: string;
  ribbon: string;
  title: string;
  meta: string;
}

// Each pastel swatch as a cover in the empty state's fan language
// (`NotebookFan`: a 200 → 400 gradient, a darker border and a white
// ribbon). Yellow and green are the fan's own "Historia" and "Biología"
// books; purple is its violet "new notebook", the fallback for
// notebooks without a colour (same fallback as the icon tiles).
const DARK_TEXT = { title: "text-neutral-900", meta: "text-black/55" };
const TONES: Record<NotebookCoverTone, ToneLook> = {
  pink: {
    cover: "border-pink-400 from-pink-200 to-pink-400",
    ribbon: "bg-white",
    ...DARK_TEXT,
  },
  green: {
    cover: "border-success-500 from-emerald-200 to-emerald-400",
    ribbon: "bg-white",
    ...DARK_TEXT,
  },
  yellow: {
    cover: "border-warning-500 from-amber-200 to-amber-400",
    ribbon: "bg-white",
    ...DARK_TEXT,
  },
  purple: {
    cover: "border-primary-700 from-primary-500 to-primary-700",
    ribbon: "bg-technique-flashcards-accent",
    title: "text-white",
    meta: "text-white/75",
  },
  orange: {
    cover: "border-orange-500 from-orange-200 to-orange-400",
    ribbon: "bg-white",
    ...DARK_TEXT,
  },
  blue: {
    cover: "border-blue-400 from-blue-200 to-blue-400",
    ribbon: "bg-white",
    ...DARK_TEXT,
  },
  mint: {
    cover: "border-teal-500 from-teal-200 to-teal-400",
    ribbon: "bg-white",
    ...DARK_TEXT,
  },
};

export interface NotebookCoverCardProps {
  href: string;
  title: string;
  pageCount: number;
  // Already formatted date label for the bottom row ("hace 2 días");
  // omitted, the bottom row holds only the actions.
  dateLabel?: string;
  // The notebook's pastel colour; null/undefined falls back to violet.
  tone?: NotebookCoverTone | null;
  // Interactive controls on the cover (the hub's kebab menu), stacked above
  // the stretched link.
  actions?: ReactNode;
  className?: string;
}

// One notebook of the notebooks hub grid as a closed notebook (Phase 8
// H4-T5, user request 2026-10-28): the empty state's `NotebookCover`
// drawing, tinted by the notebook's colour, with the page count as plain
// meta text in the top-left corner (user correction 2026-10-28: no icon there), the title
// centred in the middle and only the date and the actions at the bottom. The drawing stays decorative (aria-hidden), so
// the readable content is a layer laid over the cover face, never its
// children. The title link is stretched over the whole book (its
// `after:inset-0`), so the actions can nest without a button inside a
// link. On hover the book lifts 4px and tilts half a degree; it presses to
// 0.98; under reduced motion it never moves. Below 150px wide (a container
// query on the book itself, since the sidebar may eat the column) only the
// smaller title and the actions remain.
export function NotebookCoverCard({
  href,
  title,
  pageCount,
  dateLabel,
  tone,
  actions,
  className,
}: NotebookCoverCardProps) {
  const toneKey = notebookToneKey(tone);
  const look = TONES[toneKey];
  const pages = pageCount === 1 ? "1 página" : `${pageCount} páginas`;

  return (
    <article
      data-slot="notebook-cover-card"
      data-tone={toneKey}
      className={cn(
        "group/book @container/book relative aspect-[4/5] w-full",
        className,
      )}
    >
      <div
        data-part="book"
        className="relative size-full transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] group-hover/book:-translate-y-1 group-hover/book:-rotate-[0.6deg] motion-reduce:transform-none motion-reduce:transition-none"
      >
        <NotebookCover cover={look.cover} ribbon={look.ribbon} />
        {/* Same box as the `lg` cover face (100% − the 8px page edge); the
            left padding clears the 14px spine, the top one the ribbon. */}
        <div className="absolute top-0 left-0 flex size-[calc(100%-8px)] flex-col pt-2 pr-1.5 pb-1.5 pl-3.5 @[150px]/book:pt-4 @[150px]/book:pr-3 @[150px]/book:pb-3 @[150px]/book:pl-6 @[280px]/book:pt-6 @[280px]/book:pr-5 @[280px]/book:pb-5 @[280px]/book:pl-9">
          {/* Plain meta text, the same style as the date (user correction
              2026-10-28: no badge, glyph or tile). */}
          <span
            data-part="page-count"
            className={cn(
              "hidden max-w-[calc(100%-36px)] truncate font-medium text-[11px] @[150px]/book:block @[280px]/book:text-[13px]",
              look.meta,
            )}
          >
            {pages}
          </span>
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-1">
            <Link
              href={href}
              className="min-w-0 max-w-full rounded-[8px_16px_16px_8px] outline-none after:absolute after:inset-0 after:rounded-[8px_16px_16px_8px] after:transition-shadow focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              <span
                className={cn(
                  "line-clamp-3 text-balance wrap-anywhere text-center font-semibold text-[11px] leading-snug @[150px]/book:text-[15px] @[280px]/book:text-xl",
                  look.title,
                )}
              >
                {title}
              </span>
            </Link>
          </div>
          <div className="flex min-h-7 items-center justify-end gap-2 @[150px]/book:justify-between">
            <span
              className={cn(
                "hidden min-w-0 truncate font-medium text-[11px] @[150px]/book:inline @[280px]/book:text-[13px]",
                look.meta,
              )}
            >
              {dateLabel}
            </span>
            {actions !== undefined ? (
              <span className={cn("relative z-10 shrink-0", look.title)}>
                {actions}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
