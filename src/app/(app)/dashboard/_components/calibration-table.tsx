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
import { cn } from "@/shared/ui/utils";
import type { CalibrationRow, CalibrationZone } from "../_lib/dashboard-view";

const ZONE_LABEL: Record<CalibrationZone, string> = {
  exceso: "Exceso de confianza",
  falta: "Falta de confianza",
  calibrado: "Calibrado",
};

// The gap reads as a traffic light (user decision 2026-11-26): green when
// the student is calibrated, amber when they know more than they believe,
// red when they believed more than their answers showed. The gap shows
// its size without a sign: a "+" in red read as something good, and the
// signal pill already names the direction, so the colour is never the only
// cue.
const ZONE_TONE: Record<CalibrationZone, NonNullable<PillProps["tone"]>> = {
  exceso: "error",
  falta: "warning",
  calibrado: "success",
};

const ZONE_GAP_TEXT: Record<CalibrationZone, string> = {
  exceso: "text-error-600",
  falta: "text-warning-600",
  calibrado: "text-success-600",
};

// Both scores go from 0 to 5 (documento-maestro §7.4).
const MAX_SCORE = 5;

function score(value: number): string {
  return value.toLocaleString("es-ES");
}

function position(value: number): string {
  return `${Math.min(100, Math.max(0, (value / MAX_SCORE) * 100))}%`;
}

// The two scores of a page as two small vertical bars on the same 0–5
// scale and baseline: violet for what the student felt, orange for what
// the AI evaluated. Each bar stands in a faint column of the full scale,
// so its height reads against the maximum; the numbers beside it carry the
// same colours.
function GapBars({ row }: { row: CalibrationRow }) {
  return (
    <div
      role="img"
      aria-label={`Sentiste ${score(row.selfAvg)} de ${MAX_SCORE}; la IA evaluó ${score(row.aiAvg)} de ${MAX_SCORE}`}
      className="mx-auto flex h-9 w-fit items-end gap-1.5 border-border-default border-b"
    >
      <span className="relative h-full w-3.5 rounded-t-[4px] bg-primary-50">
        <span
          className="dash-grow absolute inset-x-0 bottom-0 rounded-t-[4px] bg-primary-500"
          style={{ height: position(row.selfAvg) }}
        />
      </span>
      <span className="relative h-full w-3.5 rounded-t-[4px] bg-orange-100">
        <span
          className="dash-grow absolute inset-x-0 bottom-0 rounded-t-[4px] bg-orange-500"
          style={{ height: position(row.aiAvg) }}
        />
      </span>
    </div>
  );
}

const HEADER_LABEL = "font-semibold text-[12.5px] text-fg-secondary";

type SortKey = "pageTitle" | "selfAvg" | "aiAvg" | "gap";

const PAGE_SIZE = 5;

function compare(a: CalibrationRow, b: CalibrationRow, key: SortKey): number {
  if (key === "pageTitle") return a.pageTitle.localeCompare(b.pageTitle, "es");
  return a[key] - b[key];
}

// Row 6 (full width) — "Calibración metacognitiva" (documento-maestro
// §7.4): a sortable, paginated table — one row per page with the averages of its
// evaluated Active recall answers in the period, and the page's most
// frequent per-answer signal. Each row speaks for itself: the student's
// score in violet and the AI's in orange, the gap in its traffic-light colour, both scores on
// one line and the named signal. Client state only for sort/pagination; a
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
          <IconTile size="36" radius="input" tone="primary">
            <ClipboardCheck aria-hidden="true" size={16} strokeWidth={1.75} />
          </IconTile>
        }
        title="Calibración metacognitiva"
        description="Lo que creías saber frente a lo que evaluó la IA."
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
            description="Responde preguntas de recordación activa para comparar lo que sientes con lo que evalúa la IA."
            descriptionClassName="text-[12px]"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr className="[&>th:first-child]:rounded-l-lg [&>th:last-child]:rounded-r-lg [&>th]:bg-primary-50">
                    <th
                      className="px-3 py-2.5 text-left"
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
                      className="px-3 py-2.5 text-center"
                      aria-sort={ariaSortFor("selfAvg")}
                    >
                      <TableHeaderButton
                        direction={directionFor("selfAvg")}
                        onClick={() => toggleSort("selfAvg")}
                        className="mx-auto"
                      >
                        Autoevaluación
                      </TableHeaderButton>
                    </th>
                    <th
                      className="px-3 py-2.5 text-center"
                      aria-sort={ariaSortFor("aiAvg")}
                    >
                      <TableHeaderButton
                        direction={directionFor("aiAvg")}
                        onClick={() => toggleSort("aiAvg")}
                        className="mx-auto"
                      >
                        Resultado real
                      </TableHeaderButton>
                    </th>
                    <th
                      className="px-3 py-2.5 text-center"
                      aria-sort={ariaSortFor("gap")}
                    >
                      <TableHeaderButton
                        direction={directionFor("gap")}
                        onClick={() => toggleSort("gap")}
                        className="mx-auto"
                      >
                        Brecha
                      </TableHeaderButton>
                    </th>
                    <th className={cn("px-3 py-2.5 text-center", HEADER_LABEL)}>
                      <span className="flex items-center justify-center gap-3">
                        Comparación
                        <span className="flex items-center gap-2.5 font-normal text-[11px] text-fg-muted">
                          <span className="flex items-center gap-1">
                            <span
                              aria-hidden="true"
                              className="size-2 rounded-full bg-primary-500"
                            />
                            Tú
                          </span>
                          <span className="flex items-center gap-1">
                            <span
                              aria-hidden="true"
                              className="size-2 rounded-full bg-orange-500"
                            />
                            IA
                          </span>
                        </span>
                      </span>
                    </th>
                    <th className={cn("px-3 py-2.5 text-left", HEADER_LABEL)}>
                      Señal
                    </th>
                    <th className="px-3 py-2.5">
                      <span className="sr-only">Acción</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-primary-50/60 [&:not(:last-child)>td]:border-border-subtle [&:not(:last-child)>td]:border-b"
                    >
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[14px] text-fg">
                          {row.pageTitle}
                        </p>
                        <p className="text-[11.5px] text-fg-muted">
                          {row.notebookTitle}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-[19px] text-primary-600 tabular-nums">
                        {row.selfAvg.toLocaleString("es-ES")}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-[19px] text-orange-600 tabular-nums">
                        {row.aiAvg.toLocaleString("es-ES")}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-center font-bold text-[19px] tabular-nums",
                          ZONE_GAP_TEXT[row.zone],
                        )}
                      >
                        {Math.abs(row.gap).toLocaleString("es-ES")}
                      </td>
                      <td className="px-3 py-3">
                        <GapBars row={row} />
                      </td>
                      <td className="px-3 py-3">
                        <Pill size="sm" tone={ZONE_TONE[row.zone]}>
                          {ZONE_LABEL[row.zone]}
                        </Pill>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={row.href}
                          className="font-semibold text-[12.5px] text-primary-600 hover:underline"
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
