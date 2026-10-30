import type { ReactNode } from "react";
import { PixelTile } from "@/shared/ui/pixel-tile";
import { SectionHeader } from "@/shared/ui/section-header";
import {
  TECHNIQUE_THEME,
  type TechniqueTheme,
} from "@/shared/ui/technique-theme";

export interface TechniqueHubHeaderProps {
  technique: TechniqueTheme;
  title: string;
  // The counts line ("3 tarjetas · 1 cuaderno").
  description: ReactNode;
  // Right-aligned slot ("Crear examen", "Nueva sesión").
  actions?: ReactNode;
}

// Page head of the flashcards, active recall and exams hubs (Phase 8 H11,
// user-approved v2 mock 2026-10-29): the technique's 48px `PixelTile`
// beside the "Técnicas de estudio" eyebrow, a 32px title in the
// technique's gradient (26px on phones) and the counts. The same head
// renders whether or not the hub is empty. Below `sm` the actions drop
// under the title instead of squeezing it.
export function TechniqueHubHeader({
  technique,
  title,
  description,
  actions,
}: TechniqueHubHeaderProps) {
  const { tone, icon } = TECHNIQUE_THEME[technique];
  return (
    <div data-slot="technique-hub-header" data-technique-theme={technique}>
      <SectionHeader
        eyebrow="Técnicas de estudio"
        title={title}
        titleClassName="text-gradient-brand text-[26px] leading-[1.15] tracking-[-0.02em] sm:text-[32px]"
        description={description}
        descriptionClassName="text-fg-secondary"
        icon={
          <PixelTile tone={tone} icon={icon} size={48} className="mt-1.5" />
        }
        leadingClassName="items-start gap-3 sm:gap-4"
        className="max-sm:flex-col"
        actions={actions}
      />
    </div>
  );
}
