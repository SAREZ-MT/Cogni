import type { ReactNode } from "react";
import { BrandMark } from "@/shared/ui/brand-mark";
import { AuthShowcase } from "./_components/auth-showcase";

// Split-panel auth layout. Left (md+): near-black brand panel with the
// product showcase (lazy Three.js constellation + glass product fragments)
// between the brand and the tagline. Right: warm form panel. Below 768px
// only the form renders, with the brand above it.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <section
        data-testid="public-panel-brand"
        className="relative hidden flex-col justify-between overflow-hidden bg-neutral-900 p-12 text-neutral-0 md:flex"
      >
        <AuthShowcase />
        <BrandMark tone="dark" className="relative" />
        <div className="relative flex max-w-md flex-col gap-3">
          <p className="text-balance font-semibold text-3xl text-neutral-0 leading-tight tracking-tight">
            Estudia de forma{" "}
            <span className="text-primary-300">inteligente</span>, no más
            difícil.
          </p>
          <p className="text-pretty text-[15px] text-neutral-300 leading-relaxed">
            Tus apuntes se convierten en flashcards, preguntas de recordación
            activa y exámenes. El repaso espaciado te dice qué estudiar cada
            día.
          </p>
        </div>
      </section>
      <section
        data-testid="public-panel-form"
        className="flex min-w-0 flex-col items-center justify-center bg-neutral-100 px-6 py-12"
      >
        <div className="w-full max-w-sm">
          <div data-testid="public-mobile-brand" className="mb-10 md:hidden">
            <BrandMark />
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
