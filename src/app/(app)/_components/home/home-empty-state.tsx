import { CalendarCheck, History, Target } from "lucide-react";
import type { ReactNode } from "react";
import { CreateNotebookTrigger } from "@/modules/notebooks";
import { EmptyState } from "@/shared/ui/empty-state";
import { FeaturePreviewCard } from "@/shared/ui/feature-preview-card";
import { IconTile } from "@/shared/ui/icon-tile";
import { RevealGroup, RevealItem } from "@/shared/ui/reveal";
import { StudyBackdrop } from "@/shared/ui/study-backdrop";
import { TechniqueFan } from "@/shared/ui/technique-fan";
import { TourAutoStart } from "../product-tour/product-tour";
import { ReplayTourLink } from "../product-tour/replay-tour-link";

const PREVIEW_ICON = { "aria-hidden": true, size: 18, strokeWidth: 1.75 };

// Technique colours, as on the sidebar/panel: flashcards, recordación
// activa, exámenes.
const DOT_CLASS = {
  flashcards: "bg-warning-500",
  recall: "bg-success-500",
  exams: "bg-rose-500",
} as const;

type Technique = keyof typeof DOT_CLASS;

function TechniqueDots({ techniques }: { techniques: Technique[] }) {
  return (
    <span aria-hidden="true" className="flex gap-1">
      {techniques.map((technique) => (
        <span
          key={technique}
          data-part="technique-dot"
          className={`size-2 rounded-full ${DOT_CLASS[technique]}`}
        />
      ))}
    </span>
  );
}

function previewIcon(icon: ReactNode) {
  return (
    <IconTile size="36" radius="input" tone="neutral">
      {icon}
    </IconTile>
  );
}

// Previews of the sections Home shows once there is data. Same names as
// the populated Home (inicio-tour-y-empty-state.md §2.1 item 7). "Temas
// débiles" uses a target instead of the capture's brain icon (§2.3): the
// brain reads poorly at this size. The dots name the techniques that feed
// each section; the copy says the same in words.
const PREVIEWS = [
  {
    title: "Para hoy",
    description: "Los repasos que te tocan hoy, según la repetición espaciada.",
    icon: previewIcon(<CalendarCheck {...PREVIEW_ICON} />),
    adornment: <TechniqueDots techniques={["flashcards", "recall", "exams"]} />,
  },
  {
    title: "Continúa donde lo dejaste",
    description: "Las últimas páginas que abriste, a un clic.",
    icon: previewIcon(<History {...PREVIEW_ICON} />),
  },
  {
    title: "Temas débiles",
    description: "Lo que más te cuesta en recordación activa y exámenes.",
    icon: previewIcon(<Target {...PREVIEW_ICON} />),
    adornment: <TechniqueDots techniques={["recall", "exams"]} />,
  },
];

// Home with zero notebooks (H2-T3, reference capture 2026-10-17 5.21.28):
// one primary action, the tour replay link and a static preview of what
// Home will hold. No greeting (user decision 2026-10-17), metrics, streaks
// or zero counters (§2.2). The hero shows a mini notebook in front of
// the three techniques fanned like flashcards, over a static graph-paper
// backdrop that fills the whole content card; blocks rise in with a short
// stagger (none under reduced motion).
// It also auto-launches the product tour once per browser: the zero-notebook
// fact is the same server read that picked this branch.
export function HomeEmptyState() {
  return (
    <section className="relative flex flex-1 flex-col">
      <TourAutoStart />
      {/* Bleeds over <main>'s padding so it fills the whole content card. */}
      <StudyBackdrop className="inset-[calc(var(--content-padding)*-1)]" />
      <div className="relative flex flex-1 flex-col items-center justify-center py-8">
        <RevealGroup className="relative flex w-full max-w-3xl flex-col items-center gap-12">
          <RevealItem>
            <EmptyState
              variant="plain"
              icon={
                <TechniqueFan techniques={["flashcards", "recall", "exams"]} />
              }
              title="Tu inicio está vacío por ahora"
              titleAs="h1"
              titleClassName="mt-5 text-[32px] leading-tight tracking-tight text-balance"
              description="Cuando crees tu primer cuaderno, aquí verás los repasos de hoy, tus páginas recientes y los temas que más te cuestan."
              descriptionClassName="max-w-lg text-[15px] text-balance text-fg-secondary leading-relaxed"
              action={
                <div className="mt-4 flex flex-col items-center gap-3">
                  <CreateNotebookTrigger
                    variant="hero"
                    label="Crea tu primer cuaderno"
                    tourId="crear-cuaderno"
                    openAfterCreate
                  />
                  <ReplayTourLink />
                </div>
              }
            />
          </RevealItem>

          <section
            aria-labelledby="home-preview-title"
            className="flex w-full flex-col items-center gap-4"
          >
            <RevealItem className="flex w-full items-center gap-4">
              <span
                aria-hidden="true"
                className="h-px flex-1 bg-border-default"
              />
              <h2
                id="home-preview-title"
                className="shrink-0 whitespace-nowrap font-medium text-[11px] text-fg-muted uppercase tracking-wider"
              >
                Lo que verás aquí
              </h2>
              <span
                aria-hidden="true"
                className="h-px flex-1 bg-border-default"
              />
            </RevealItem>
            <ul className="grid w-full gap-3 sm:grid-cols-3">
              {PREVIEWS.map((preview) => (
                <li key={preview.title}>
                  <RevealItem className="h-full">
                    <FeaturePreviewCard
                      icon={preview.icon}
                      adornment={preview.adornment}
                      title={preview.title}
                      description={preview.description}
                    />
                  </RevealItem>
                </li>
              ))}
            </ul>
          </section>
        </RevealGroup>
      </div>
    </section>
  );
}
