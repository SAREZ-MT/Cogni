import type { LucideIcon } from "lucide-react";
import { Brain, ClipboardList, Layers } from "lucide-react";
import type { TechniqueTone } from "@/shared/ui/technique-card";

export interface TechniqueDefinition {
  id: "flashcards" | "active-recall" | "exam";
  name: string;
  icon: LucideIcon;
  tone: TechniqueTone;
  description: string;
  meta: string;
  actionLabel: string;
  href?: string;
}

// Study-technique content for the "Técnicas" panel (design/shell-look).
// None of these techniques are built yet — every action stays disabled and
// nothing here is wired to a real Server Action — so this is presentation
// data only. Icons match the ones the main Sidebar's "Técnicas" section
// already uses for the same three entries (sidebar.tsx's TECNICAS_SECTION),
// so the icon vocabulary stays consistent across the shell.
export const TECHNIQUES: readonly TechniqueDefinition[] = [
  {
    id: "flashcards",
    name: "Flashcards",
    icon: Layers,
    tone: "primary",
    description: "Tarjetas con repetición espaciada",
    meta: "Sin tarjetas todavía",
    actionLabel: "Ver mazos",
    href: "/flashcards",
  },
  {
    id: "active-recall",
    name: "Active recall",
    icon: Brain,
    tone: "green",
    description: "Preguntas abiertas de memoria",
    meta: "Sin sesiones previas",
    actionLabel: "Iniciar",
  },
  {
    id: "exam",
    name: "Examen",
    icon: ClipboardList,
    tone: "pink",
    description: "Opción múltiple con retroalimentación",
    meta: "Sin exámenes previos",
    actionLabel: "Generar examen",
  },
] as const;
