import type { ReactNode } from "react";

// A visible "[PENDIENTE: …]" placeholder on the public pages: data or a
// decision still missing, highlighted so nobody mistakes it for final copy.
export function PendingMark({ children }: { children: ReactNode }) {
  return <mark className="lp-pending">{children}</mark>;
}
