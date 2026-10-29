import { Check, EllipsisVertical, type LucideIcon, Play } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { notebookDotClass, toNotebookTone } from "@/shared/ui/notebook-dot";
import { Pill } from "@/shared/ui/pill";
import { ProgressBar } from "@/shared/ui/progress-bar";
import type { TechniqueTheme } from "@/shared/ui/technique-theme";
import { cn } from "@/shared/ui/utils";

export interface TechniqueItemCardProps {
  technique: TechniqueTheme;
  // Where the action leads (the review, the practice, the exam); the
  // action link is stretched over the whole card.
  href: string;
  // The item's notebook, as a coloured label; a missing or unknown stored
  // colour is violet.
  notebook: { title: string; tone?: string | null };
  // The page's title (one item per page), clamped to two lines.
  title: string;
  metric: { icon: LucideIcon; value: number; unit: string };
  // The status line: a TechniqueItemPill, a TechniqueItemCheck or text.
  status: ReactNode;
  // 0–100; omitted, no bar.
  progress?: number;
  action: { label: string; icon?: LucideIcon };
  // "primary" (filled) only when something is due; "soft" otherwise.
  emphasis?: "primary" | "soft";
  // DropdownMenuItems of the kebab; omitted, no kebab.
  menu?: ReactNode;
  className?: string;
}

// One generated item of a technique hub (Phase 8 H17, user-approved flat
// hubs 2026-10-29): a Card tinted in the technique's corner with the
// notebook label and the kebab on top, the title, the metric ("12
// tarjetas"), the status line, an optional ProgressBar and the action at
// the bottom. The action is the card's link, stretched over it like
// PageSheetCard's title; the kebab sits above it. On hover the card rises
// 2px with the card-hover shadow and a soft technique border; under
// reduced motion only the shadow and border change. The theme comes from
// `data-technique-theme` (globals.css --theme-*).
export function TechniqueItemCard({
  technique,
  href,
  notebook,
  title,
  metric,
  status,
  progress,
  action,
  emphasis = "soft",
  menu,
  className,
}: TechniqueItemCardProps) {
  const tone = toNotebookTone(notebook.tone);
  const MetricIcon = metric.icon;
  const ActionIcon = action.icon ?? Play;

  return (
    <Card asChild>
      <article
        data-slot="technique-item-card"
        data-technique-theme={technique}
        className={cn(
          "group/item relative flex min-h-[212px] flex-col overflow-hidden rounded-[18px] py-3.5 pr-3.5 pl-4 transition-[translate,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-(--theme-soft-edge) hover:shadow-card-hover motion-reduce:transition-[box-shadow,border-color] motion-reduce:hover:translate-y-0",
          "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(120%_70%_at_100%_0%,var(--theme-tint)_0%,transparent_60%)]",
          "max-[520px]:min-h-0",
          className,
        )}
      >
        <div className="relative flex min-h-7 items-center justify-between gap-2">
          <Pill
            size="md"
            tone={tone}
            data-testid="technique-item-notebook"
            data-tone={tone}
            className="h-[22px] min-w-0 max-w-[calc(100%-36px)] gap-1.5 pr-2.5 pl-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-[7px] shrink-0 rounded-full",
                notebookDotClass(tone),
              )}
            />
            <span className="truncate">{notebook.title}</span>
          </Pill>
          {menu !== undefined ? (
            <span className="relative z-10 -mr-1 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Acciones de ${title}`}
                    className="size-7 rounded-lg text-fg-muted group-hover/item:bg-black/5 group-hover/item:text-fg data-[state=open]:bg-black/5 data-[state=open]:text-fg"
                  >
                    <EllipsisVertical
                      aria-hidden="true"
                      size={16}
                      strokeWidth={2}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto">
                  {menu}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          ) : null}
        </div>

        <h3
          title={title}
          className="relative mt-2.5 line-clamp-2 min-h-11 wrap-anywhere font-semibold text-base text-fg leading-[22px] tracking-[-0.005em]"
        >
          {title}
        </h3>

        <p
          data-testid="technique-item-metric"
          className="relative mt-2.5 flex items-center gap-1.5 text-[13px] text-fg-secondary"
        >
          <MetricIcon
            aria-hidden="true"
            size={15}
            strokeWidth={2}
            className="text-(--theme-ink)"
          />
          <strong className="font-semibold text-fg tabular-nums">
            {metric.value}
          </strong>{" "}
          {metric.unit}
        </p>

        <div className="relative mt-1.5 flex min-h-5 flex-wrap items-center gap-1.5 gap-y-0.5 text-[12.5px] text-fg-muted [&>*]:whitespace-nowrap">
          {status}
        </div>

        {progress !== undefined ? (
          <ProgressBar
            value={progress}
            className="relative mt-2 h-1.5 bg-black/[6%]"
            fillClassName="bg-(--theme-fill)"
          />
        ) : null}

        <div className="relative mt-auto pt-3.5">
          <Link
            href={href}
            data-emphasis={emphasis}
            className={cn(
              "flex h-[38px] w-full items-center justify-center gap-[7px] rounded-xl border border-transparent font-semibold text-[13.5px] outline-none transition-colors after:absolute after:inset-0 after:rounded-[18px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50",
              emphasis === "primary"
                ? "border-(--theme-cta-edge) bg-(--theme-cta) text-(--theme-cta-fg) shadow-[0_6px_14px_-10px_var(--theme-cta-edge)] group-hover/item:bg-(--theme-cta-hover)"
                : "bg-(--theme-soft) text-(--theme-soft-fg) group-hover/item:border-(--theme-soft-edge)",
            )}
          >
            <ActionIcon aria-hidden="true" size={14} strokeWidth={2.2} />
            {action.label}
            <span className="sr-only">: {title}</span>
          </Link>
        </div>
      </article>
    </Card>
  );
}

// The status pill of an item with something due ("3 para hoy",
// "Repetir cuando estés listo"), in the technique's soft colours.
export function TechniqueItemPill({ children }: { children: ReactNode }) {
  return (
    <Pill
      size="md"
      className="h-5 gap-[5px] bg-(--theme-soft) px-2 text-(--theme-soft-fg)"
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-(--theme-fill)"
      />
      {children}
    </Pill>
  );
}

// The tick of an up-to-date item ("Al día").
export function TechniqueItemCheck({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-success-600">
      <Check aria-hidden="true" size={13} strokeWidth={2.4} />
      {children}
    </span>
  );
}
