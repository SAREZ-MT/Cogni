import { CreateNotebookTrigger } from "@/modules/notebooks";
import { SectionHeader } from "@/shared/ui/section-header";
import { greetingForHour } from "../format";

interface HomeHeaderProps {
  displayName: string;
  // Injected instead of read internally with `new Date()`, so tests don't
  // depend on the real clock.
  now?: Date;
}

// ui_kits/app/Home Page.html .page-header: greeting + subtext on the left,
// the "+ Nuevo cuaderno" primary pill on the right.
export function HomeHeader({ displayName, now = new Date() }: HomeHeaderProps) {
  const greeting = greetingForHour(now.getHours(), displayName);

  return (
    <SectionHeader
      title={greeting}
      titleClassName="text-[28px]"
      description="Aquí está tu resumen de hoy — ¡sigue así!"
      actions={<CreateNotebookTrigger variant="pill" />}
    />
  );
}
