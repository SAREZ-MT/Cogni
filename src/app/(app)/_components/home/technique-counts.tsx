import { Brain, FileCheck, Layers, type LucideIcon } from "lucide-react";
import type { DueKind, TechniqueOverview } from "@/modules/scheduling";
import {
  type CountCardTone,
  TechniqueCountCard,
} from "@/shared/ui/technique-count-card";
import { techniqueProgress } from "./technique-progress";

const CARDS: readonly {
  kind: DueKind;
  label: string;
  href: string;
  icon: LucideIcon;
  tone: CountCardTone;
}[] = [
  {
    kind: "flashcard",
    label: "Flashcards",
    href: "/flashcards",
    icon: Layers,
    tone: "yellow",
  },
  {
    kind: "recall_question",
    label: "Recordación activa",
    href: "/active-recall",
    icon: Brain,
    tone: "green",
  },
  {
    kind: "exam_question",
    label: "Exámenes",
    href: "/exams",
    icon: FileCheck,
    tone: "rose",
  },
];

export interface TechniqueCountsProps {
  // Per technique: today's study units (pages pending and done), live item
  // totals and next due date; null when the read failed.
  overview: TechniqueOverview | null;
  timeZone: string;
  now: Date;
}

// Home's three technique cards (Phase 8 H2-T5f, H2-T5i): today's progress
// per technique in study units (pages done against done + still due, the
// same unit as a "Repasar hoy" row), or why there is nothing to do
// today, each card a link to that technique's hub. A failed read shows the
// cards as "progress unavailable". A visible heading, styled like
// "Continúa donde lo dejaste", sets progress apart from "Repasar hoy"
// (user 2026-10-18).
export function TechniqueCounts({
  overview,
  timeZone,
  now,
}: TechniqueCountsProps) {
  return (
    <section aria-labelledby="home-counts-title">
      <h2
        id="home-counts-title"
        className="mb-3.5 font-semibold text-[17px] text-fg tracking-[-0.01em]"
      >
        Tu progreso de hoy
      </h2>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {CARDS.map(({ kind, label, href, icon, tone }, index) => {
          const view = techniqueProgress({
            label,
            doneUnits: overview ? overview[kind].doneUnits : null,
            pendingUnits: overview ? overview[kind].pendingUnits : null,
            itemTotal: overview ? overview[kind].total : null,
            nextDueAt: overview ? overview[kind].nextDueAt : null,
            timeZone,
            now,
          });
          return (
            <TechniqueCountCard
              key={kind}
              href={href}
              icon={icon}
              tone={tone}
              label={label}
              value={view.value}
              valueSuffix={view.valueSuffix}
              emphasis={view.emphasis}
              sub={view.sub}
              ring={view.ring}
              ariaLabel={view.ariaLabel}
              delay={0.2 + index * 0.06}
            />
          );
        })}
      </div>
    </section>
  );
}
