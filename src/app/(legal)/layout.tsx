import Link from "next/link";
import type { ReactNode } from "react";

// Public reading layout for the legal pages: warm canvas, a slim top bar
// back to Cogni and no app chrome (proxy OPEN_PATHS, signed in or not).
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-border-subtle border-b bg-sidebar/80 backdrop-blur-md">
        <div className="mx-auto flex h-13 w-full max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="font-semibold text-fg text-lg no-underline">
            Cogni
          </Link>
          <Link
            href="/"
            className="text-fg-secondary text-sm no-underline hover:text-fg"
          >
            Volver a Cogni
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
