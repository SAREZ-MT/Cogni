"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Replaces the root layout when it throws, so it owns <html> and <body>.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-canvas p-6 font-sans text-ink">
        <main className="max-w-md space-y-4 text-center">
          <h1 className="font-display text-2xl">Algo salió mal</h1>
          <p className="text-muted">
            Ya registramos el error. Puedes intentar de nuevo o volver más
            tarde.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-input bg-primary px-4 py-2 text-primary-foreground"
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
