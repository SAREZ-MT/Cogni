import { BookOpen } from "lucide-react";
import Link from "next/link";
import type { NotebookColor } from "@/modules/notebooks";
import { IconTile } from "@/shared/ui/icon-tile";
import { cn } from "@/shared/ui/utils";

// Header background per notebook color — the same 7-key pastel palette
// NotebookColor already carries, so a hub card's header always matches
// that notebook's own color everywhere else in the app.
const HEADER_BG: Record<NotebookColor, string> = {
  pink: "bg-pastel-pink",
  green: "bg-pastel-green",
  yellow: "bg-pastel-yellow",
  purple: "bg-pastel-purple",
  orange: "bg-pastel-orange",
  blue: "bg-pastel-blue",
  mint: "bg-pastel-mint",
};

export interface DeckSummaryCardProps {
  href: string;
  tone: NotebookColor;
  title: string;
  cardCount: number;
  dueCount: number;
  className?: string;
}

// Flashcards hub grid item (studyplatform-flashcards-style.md §4
// WorkspaceFlashcardCard): one card per notebook that has decks — a
// pastel-toned header carrying a translucent icon tile and a red due-count
// badge, plus a body with the notebook title and a due/al-día meta line.
export function DeckSummaryCard({
  href,
  tone,
  title,
  cardCount,
  dueCount,
  className,
}: DeckSummaryCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "block overflow-hidden rounded-[18px] border border-border-subtle bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
    >
      <div className={cn("relative px-5 pt-[22px] pb-4", HEADER_BG[tone])}>
        <IconTile
          tone={tone}
          size="48"
          className="bg-white/[55%] backdrop-blur-sm"
        >
          <BookOpen aria-hidden="true" size={22} strokeWidth={1.75} />
        </IconTile>
        {dueCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-3.5 right-[46px] flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-error-500 px-1.5 font-bold text-[11px] text-white"
          >
            {dueCount}
          </span>
        )}
      </div>
      <div className="px-4 pt-3.5 pb-4">
        <p className="truncate font-semibold text-fg text-sm">{title}</p>
        <p className="mt-1 text-fg-muted text-xs">
          {cardCount} tarjetas
          {dueCount > 0 ? (
            <span className="font-medium text-error-600">
              {" "}
              · {dueCount} pendientes
            </span>
          ) : (
            <span className="font-medium text-success-600"> · al día ✓</span>
          )}
        </p>
      </div>
    </Link>
  );
}
