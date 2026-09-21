"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// One QueryClient per browser session (design.md, "Sidebar como Server
// Component con mutaciones optimistas de TanStack Query"). useState keeps
// it stable across re-renders without recreating it on every render.
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
