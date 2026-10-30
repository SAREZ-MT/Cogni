"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
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
  // Intermediate segments (e.g. "Cuadernos", a notebook's own title) link
  // back to that screen — user feedback: the only way back used to be the
  // sidebar. The trail's last segment never gets one; it stays the
  // `aria-current="page"` plain-text label for where you already are.
  href?: string;
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
// whatever the current route published.
//
// H6-E7 (odd/tasks/phase-8-design-flows.md): the trail is a key navigation
// aid, so it reads larger and clearer than the old 14px muted line — 15px
// secondary ink for the way back, medium-weight ink for the current page,
// chevron separators, 32px-tall hover targets with an underline, and long
// names truncated (the full name stays as a tooltip). The nav may shrink
// inside the topbar (`min-w-0 flex-1`); the current page keeps more room
// than the segments before it. In a narrow topbar (a container under 32rem)
// only the parent and the current page stay, so neither collapses to
// nothing.
export function Breadcrumb() {
  const published = useBreadcrumb();
  const segments: BreadcrumbItem[] = [
    { label: "Cogni", href: "/inicio" },
    ...published,
  ];

  return (
    <nav
      aria-label="Ruta de navegación"
      className="@container min-w-0 flex-1 pr-4"
    >
      <ol className="flex min-w-0 items-center gap-0.5 text-[15px] text-fg-secondary">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const isFar = index < segments.length - 2;
          return (
            <li
              key={`${segment.label}-${index}`}
              data-far={isFar || undefined}
              className={cn(
                "flex min-w-0 items-center gap-0.5",
                isLast ? "shrink" : "shrink-[3]",
                isFar && "hidden @lg:flex",
              )}
            >
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  size={15}
                  strokeWidth={1.75}
                  className={cn(
                    "shrink-0 text-fg-muted",
                    // The parent's chevron leads from segments a narrow
                    // topbar hides.
                    index === segments.length - 2 && "hidden @lg:block",
                  )}
                />
              )}
              {!isLast && segment.href ? (
                <Link
                  href={segment.href}
                  title={segment.label}
                  className="block h-8 max-w-64 truncate rounded-md px-1.5 leading-8 underline-offset-4 transition-colors hover:bg-hover hover:text-fg hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {segment.label}
                </Link>
              ) : (
                <span
                  title={segment.label}
                  className={cn(
                    "block truncate px-1.5 leading-8",
                    isLast ? "font-medium text-fg" : "max-w-64",
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {segment.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
