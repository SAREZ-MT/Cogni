"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/shared/ui/utils";

export interface BreadcrumbItem {
  label: string;
}

// Fallback trail when no page route has published its own yet (comp-
// topbar.html, Engram obs 140: default "Cogni › Inicio").
const DEFAULT_ITEMS: BreadcrumbItem[] = [{ label: "Inicio" }];

interface BreadcrumbContextValue {
  items: BreadcrumbItem[];
  publish: (items: BreadcrumbItem[] | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

// Mounted once in layout.tsx, above both Topbar and `{children}`: a Server
// Component page route cannot call useContext directly, so every route
// publishes its own crumbs through the client SetBreadcrumb component
// below instead, and Topbar (also under this provider) renders whatever is
// currently published.
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[] | null>(null);
  // Review follow-up from S3 (R3-setbreadcrumb-effect-identity): without
  // this memo, the provider handed down a brand-new {items, publish}
  // object literal on every render, so SetBreadcrumb's effect below (which
  // used to depend on that whole object) re-ran an extra time whenever
  // anything else caused this provider to re-render, not only when its own
  // `items` prop actually changed.
  const value = useMemo<BreadcrumbContextValue>(
    () => ({ items: items ?? DEFAULT_ITEMS, publish: setItems }),
    [items],
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb(): BreadcrumbItem[] {
  const context = useContext(BreadcrumbContext);
  return context ? context.items : DEFAULT_ITEMS;
}

interface SetBreadcrumbProps {
  items: BreadcrumbItem[];
}

// A page route renders this (Home: "Inicio"; a page route: "{cuaderno} ›
// {página}") to publish its own crumbs. Cleans up on unmount so navigating
// to a route that has not published anything yet never keeps a stale trail
// from the previous page. Without a mounted BreadcrumbProvider (e.g. a
// route rendered standalone in a test) this is a no-op.
export function SetBreadcrumb({ items }: SetBreadcrumbProps) {
  const context = useContext(BreadcrumbContext);
  // Depend on the stable `publish` function (a useState setter, which
  // React guarantees keeps the same identity for the component's whole
  // lifetime) instead of the whole context value object: the object's own
  // identity changes on every publish (see the provider's memo above), so
  // depending on it re-ran this effect an extra, redundant time per publish.
  const publish = context?.publish;

  useEffect(() => {
    if (!publish) return;
    publish(items);
    return () => publish(null);
  }, [publish, items]);

  return null;
}

// Topbar's rendering of the current trail (comp-topbar.html `.breadcrumb`,
// Engram obs 140): "Cogni" is always the root segment; the rest comes from
// whatever the current route published. Muted segments with `›` separators
// (decorative), last segment `text-fg` weight 500.
export function Breadcrumb() {
  const published = useBreadcrumb();
  const segments: BreadcrumbItem[] = [{ label: "Cogni" }, ...published];

  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex items-center gap-1.5 text-fg-muted text-sm">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <li
              key={`${segment.label}-${index}`}
              className="flex items-center gap-1.5"
            >
              {index > 0 && <span aria-hidden="true">›</span>}
              <span className={cn(isLast && "font-medium text-fg")}>
                {segment.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
