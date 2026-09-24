import { CreateNotebookTrigger } from "@/modules/notebooks";
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
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-bold text-[28px] text-fg">{greeting}</h1>
        <p className="mt-1 text-fg-muted text-sm">
          Aquí está tu resumen de hoy — ¡sigue así!
        </p>
      </div>
      <CreateNotebookTrigger variant="pill" />
    </div>
  );
}
