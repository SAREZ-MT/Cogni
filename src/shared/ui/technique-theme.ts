import type { LucideIcon } from "lucide-react";
import { Brain, ClipboardList, Layers } from "lucide-react";
import type { PixelTileTone } from "@/shared/ui/pixel-tile";

// The three study techniques as a visual theme (Phase 8 H11, user-approved
// v2 mock 2026-10-29). An element tagged `data-technique-theme` re-points
// the shared gradient text, empty-state glow, dotted paper and
// `technique-cta` at the technique's colours (globals.css): flashcards
// amber, recall emerald, exams rose.
export type TechniqueTheme = "flashcards" | "recall" | "exams";

// The pixel tile tone and the Sidebar's icon of each technique (the same
// glyphs as the techniques panel).
export const TECHNIQUE_THEME: Record<
  TechniqueTheme,
  { tone: PixelTileTone; icon: LucideIcon }
> = {
  flashcards: { tone: "yellow", icon: Layers },
  recall: { tone: "green", icon: Brain },
  exams: { tone: "rose", icon: ClipboardList },
};
