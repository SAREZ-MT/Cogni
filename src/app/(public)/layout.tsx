import type { ReactNode } from "react";

// Split-panel auth layout: dark brand panel with violet glows on the left,
// warm form panel on the right. Below 768px only the form panel renders.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <section
        data-testid="public-panel-brand"
        className="brand-glow relative hidden flex-col justify-between overflow-hidden bg-neutral-900 p-12 text-neutral-0 md:flex"
      >
        <p className="font-semibold text-lg">Cogni</p>
        <p className="max-w-sm text-neutral-300 text-sm">
          Estudia con flashcards, exámenes y recordación activa, y deja que el
          repaso espaciado haga el resto.
        </p>
      </section>
      <section
        data-testid="public-panel-form"
        className="flex min-w-0 flex-col items-center justify-center bg-neutral-50 px-6 py-12"
      >
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  );
}
