"use client";

import { ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/shared/ui/button";
import { ChartCard } from "@/shared/ui/chart-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill, type PillProps } from "@/shared/ui/pill";
import {
  type SortDirection,
  TableHeaderButton,
} from "@/shared/ui/table-header-button";
import type { CalibrationRow, CalibrationZone } from "../_lib/dashboard-view";

const ZONE_LABEL: Record<CalibrationZone, string> = {
  exceso: "Exceso de confianza",
  falta: "Falta de confianza",
  calibrado: "Calibrado",
};

const ZONE_TONE: Record<CalibrationZone, NonNullable<PillProps["tone"]>> = {
  exceso: "warning",
  falta: "info",
  calibrado: "success",
};

type SortKey = "pageTitle" | "selfAvg" | "aiAvg" | "gap";

const PAGE_SIZE = 5;

function compare(a: CalibrationRow, b: CalibrationRow, key: SortKey): number {
  if (key === "pageTitle") return a.pageTitle.localeCompare(b.pageTitle, "es");
  return a[key] - b[key];
}

// Row 7 — "Calibración metacognitiva" (documento-maestro §7.4): a
// sortable, paginated table — one row per page with the averages of its
// evaluated Active recall answers in the period, and the page's most
// frequent per-answer signal. Client state only for sort/pagination; a
// period without evaluated answers shows an empty state.
export function CalibrationTable({
  rows,
}: {
  rows: readonly CalibrationRow[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("gap");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const copy = [...rows].sort((a, b) => compare(a, b, sortKey));
    return sortDirection === "asc" ? copy : copy.reverse();
  }, [rows, sortKey, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const rangeStart = sorted.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(sorted.length, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
    setPage(0);
  }

  function directionFor(key: SortKey): SortDirection | undefined {
    return key === sortKey ? sortDirection : undefined;
  }

  function ariaSortFor(key: SortKey): "none" | "ascending" | "descending" {
    if (key !== sortKey) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  }

  return (
    <div data-testid="calibration-table">
      <ChartCard
        icon={
          <IconTile size="36" radius="input" tone="neutral">
            <ClipboardCheck aria-hidden="true" size={16} strokeWidth={1.75} />
          </IconTile>
        }
        title="Calibración metacognitiva"
        description="Lo que sentiste vs. lo que evaluó la IA (Active recall)."
        ariaLabel="Calibración metacognitiva: autoevaluación promedio comparada con el resultado real de la IA, por página"
        bodyClassName="gap-3"
      >
        {rows.length === 0 ? (
          <EmptyState
            variant="tinted"
            icon={
              <IconTile size="36" radius="input" tone="neutral">
                <ClipboardCheck
                  aria-hidden="true"
                  size={16}
                  strokeWidth={1.75}
                />
              </IconTile>
            }
            title="Sin autoevaluaciones en este período"
            titleAs="p"
            titleClassName="text-[13px]"
            description="Responde preguntas de Active recall para comparar lo que sientes con lo que evalúa la IA."
            descriptionClassName="text-[12px]"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-border-subtle border-b">
                    <th
                      className="px-2 py-2 text-left"
                      aria-sort={ariaSortFor("pageTitle")}
                    >
                      <TableHeaderButton
                        direction={directionFor("pageTitle")}
                        onClick={() => toggleSort("pageTitle")}
                      >
                        Página
                      </TableHeaderButton>
                    </th>
                    <th
                      className="px-2 py-2 text-right"
                      aria-sort={ariaSortFor("selfAvg")}
                    >
                      <TableHeaderButton
                        direction={directionFor("selfAvg")}
                        onClick={() => toggleSort("selfAvg")}
                        className="ml-auto"
                      >
                        Autoevaluación
                      </TableHeaderButton>
                    </th>
                    <th
                      className="px-2 py-2 text-right"
                      aria-sort={ariaSortFor("aiAvg")}
                    >
                      <TableHeaderButton
                        direction={directionFor("aiAvg")}
                        onClick={() => toggleSort("aiAvg")}
                        className="ml-auto"
                      >
                        Resultado real
                      </TableHeaderButton>
                    </th>
                    <th
                      className="px-2 py-2 text-right"
                      aria-sort={ariaSortFor("gap")}
                    >
                      <TableHeaderButton
                        direction={directionFor("gap")}
                        onClick={() => toggleSort("gap")}
                        className="ml-auto"
                      >
                        Brecha
                      </TableHeaderButton>
                    </th>
                    <th className="px-2 py-2 text-left font-medium text-[11px] text-fg-muted uppercase tracking-wider">
                      Señal
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-[11px] text-fg-muted uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-border-subtle border-b last:border-b-0 hover:bg-hover"
                    >
                      <td className="px-2 py-2.5">
                        <p className="font-medium text-fg">{row.pageTitle}</p>
                        <p className="text-[11px] text-fg-muted">
                          {row.notebookTitle}
                        </p>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-fg">
                        {row.selfAvg.toLocaleString("es-ES")}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-fg">
                        {row.aiAvg.toLocaleString("es-ES")}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-fg">
                        {row.gap > 0 ? "+" : ""}
                        {row.gap.toLocaleString("es-ES")}
                      </td>
                      <td className="px-2 py-2.5">
                        <Pill size="sm" tone={ZONE_TONE[row.zone]}>
                          {ZONE_LABEL[row.zone]}
                        </Pill>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <Link
                          href={row.href}
                          className="font-medium text-[12px] text-primary-600 hover:underline"
                        >
                          Repasar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11.5px] text-fg-muted">
                Mostrar 5 por página
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[11.5px] text-fg-muted tabular-nums">
                  {rangeStart}–{rangeEnd} de {sorted.length}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  aria-label="Página anterior"
                >
                  <ChevronLeft aria-hidden="true" size={14} strokeWidth={2} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  aria-label="Página siguiente"
                >
                  <ChevronRight aria-hidden="true" size={14} strokeWidth={2} />
                </Button>
              </div>
            </div>
          </>
        )}
      </ChartCard>
    </div>
  );
}
