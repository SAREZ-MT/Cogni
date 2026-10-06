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

// Study-technique content for the "Técnicas" panel (design/shell-look):
// icon + name + description per technique. Flashcards are wired to real
// Server Actions since Phase 3 (the panel adds the live "Generar"); Examen
// links to the page's questions since Phase 5 T4 and generates AI questions
// since T5; Active recall generates AI open questions since Phase 6 T4 and
// shows in production since T5 (its session route left the preview gate);
// no meta line, no "pronto" pill (user decision 2026-09-24).
// Icons match the ones the main Sidebar's "Técnicas" section already uses
// for the same three entries (sidebar.tsx's TECNICAS_SECTION), so the icon
// vocabulary stays consistent across the shell.
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
