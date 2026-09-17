import { NotebookPen } from "lucide-react";

// Phase 0 shows only an empty state: no notebooks, editor or study tools yet.
export default function HomePage() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-14 items-center justify-center rounded-xl bg-pastel-purple text-pastel-purple-fg">
        <NotebookPen aria-hidden="true" size={28} strokeWidth={1.5} />
      </span>
      <h1 className="font-semibold text-fg text-xl">Tu espacio de estudio</h1>
      <p className="max-w-sm text-fg-secondary text-sm">
        Aún no tienes cuadernos. Crea uno para empezar.
      </p>
    </section>
  );
}
