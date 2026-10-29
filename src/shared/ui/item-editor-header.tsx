import type { ReactNode } from "react";
import { BackLink } from "@/shared/ui/back-link";
import { PixelTile } from "@/shared/ui/pixel-tile";
import { SectionHeader } from "@/shared/ui/section-header";
import {
  TECHNIQUE_THEME,
  type TechniqueTheme,
} from "@/shared/ui/technique-theme";

export interface ItemEditorHeaderProps {
  technique: TechniqueTheme;
  backHref: string;
  backLabel: string;
  // "Editar mazo", "Editar preguntas".
  eyebrow: string;
  // The page's title.
  title: string;
  description: ReactNode | string[];
  actions?: ReactNode;
}

// The head of the three edit pages (Phase 8 H18): back link to the hub,
// the technique's 48px pixel tile, eyebrow, the page title and its counts.
export function ItemEditorHeader({
  technique,
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  actions,
}: ItemEditorHeaderProps) {
  const theme = TECHNIQUE_THEME[technique];
  return (
    <div className="flex flex-col gap-3">
      <BackLink href={backHref}>{backLabel}</BackLink>
      <SectionHeader
        icon={<PixelTile tone={theme.tone} icon={theme.icon} size={48} />}
        eyebrow={eyebrow}
        title={title}
        titleClassName="text-xl"
        description={description}
        actions={actions}
      />
    </div>
  );
}
