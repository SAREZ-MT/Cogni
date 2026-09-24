import type { LucideIcon } from "lucide-react";
import { Brain, ClipboardList, Layers } from "lucide-react";
import type { TechniqueTone } from "@/shared/ui/technique-card";

export interface TechniqueDefinition {
  id: "flashcards" | "active-recall" | "exam";
  name: string;
  icon: LucideIcon;
  tone: TechniqueTone;
  description: string;
}

// Study-technique content for the "Técnicas" panel (design/shell-look).
// None of these techniques are built yet — every card's "Generar" action
// stays disabled and nothing here is wired to a real Server Action, so this
// is presentation data only (user decision 2026-09-24: no navigation, no
// meta line, no "pronto" pill — just icon + name + description + a
// disabled "Generar"). Icons match the ones the main Sidebar's "Técnicas"
// section already uses for the same three entries (sidebar.tsx's
// TECNICAS_SECTION), so the icon vocabulary stays consistent across the
// shell.
export const TECHNIQUES: readonly TechniqueDefinition[] = [
  {
    id: "flashcards",
    name: "Flashcards",
    icon: Layers,
    tone: "primary",
    description: "Tarjetas con repetición espaciada",
  },
  {
    id: "active-recall",
    name: "Active recall",
    icon: Brain,
    tone: "green",
    description: "Preguntas abiertas de memoria",
  },
  {
    id: "exam",
    name: "Examen",
    icon: ClipboardList,
    tone: "pink",
    description: "Opción múltiple con retroalimentación",
  },
] as const;
