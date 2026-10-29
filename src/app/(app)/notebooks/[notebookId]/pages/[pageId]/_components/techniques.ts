import type { LucideIcon } from "lucide-react";
import { Brain, ClipboardList, Layers } from "lucide-react";
import type { TechniqueTone } from "@/shared/ui/technique-card";

export interface TechniqueDefinition {
  id: "flashcards" | "active-recall" | "exam";
  name: string;
  icon: LucideIcon;
  tone: TechniqueTone;
}

// Study-technique content for the "Técnicas de estudio" panel: icon +
// name per technique (H9-T1, user 2026-10-29: no description line — users
// already know each technique), and its colour (Phase 6 T5b, user
// decision 2026-10-06: Flashcards yellow, Recordación activa green, Examen
// red), shared by the card's "Generar", its collapsed icon and its row in
// the panel's generated list.
// Icons match the ones the main Sidebar's "Técnicas" section already uses
// for the same three entries (sidebar.tsx's TECNICAS_SECTION), so the icon
// vocabulary stays consistent across the shell.
export const TECHNIQUES: readonly TechniqueDefinition[] = [
  {
    id: "flashcards",
    name: "Flashcards",
    icon: Layers,
    tone: "yellow",
  },
  {
    id: "active-recall",
    name: "Recordación activa",
    icon: Brain,
    tone: "green",
  },
  {
    id: "exam",
    name: "Examen",
    icon: ClipboardList,
    tone: "rose",
  },
] as const;
