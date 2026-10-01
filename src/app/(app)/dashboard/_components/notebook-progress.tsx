import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { IconTile } from "@/shared/ui/icon-tile";
import { MASTERY_LEVEL_LABEL } from "@/shared/ui/mastery-level";
import { Pill } from "@/shared/ui/pill";
import { notebookToneFromColor } from "../../_components/notebook-swatches";
import { notebookProgressRows } from "../_data/sample";

const LEVEL_PILL_TONE = {
  nuevo: "neutral",
  aprendiendo: "warning",
  consolidando: "info",
  dominado: "success",
} as const;

// Row 6 (narrow) — "Progreso por cuaderno": one row per notebook (icon +
// title + totals), a mastery `Pill` and a 1-week trend arrow, and a
// bottom outline button to the full notebook list.
export function NotebookProgress() {
  const rows = notebookProgressRows();

  return (
    <div data-testid="notebook-progress">
      <Card padding="lg" className="flex flex-col gap-4">
        <h3 className="font-semibold text-fg text-sm">Progreso por cuaderno</h3>
        <ul className="flex flex-col gap-1">
          {rows.map((row) => {
            const isUp = row.deltaPts >= 0;
            const DeltaIcon = isUp ? ArrowUp : ArrowDown;
            return (
              <li key={row.notebookId}>
                <Link
                  href={`/notebooks/${row.notebookId}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover"
                >
                  <IconTile
                    size="36"
                    radius="input"
                    tone={notebookToneFromColor(row.color)}
                  >
                    <span aria-hidden="true" className="font-semibold text-xs">
                      {row.title.slice(0, 1)}
                    </span>
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[13px] text-fg">
                      {row.title}
                    </p>
                    <p className="truncate text-[11.5px] text-fg-muted">
                      {row.itemsTotal} ítems · {row.itemsDue} vencidos
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Pill size="sm" tone={LEVEL_PILL_TONE[row.level]}>
                      {MASTERY_LEVEL_LABEL[row.level]}
                    </Pill>
                    <span
                      className={
                        isUp
                          ? "flex items-center gap-0.5 text-[11px] text-success-600"
                          : "flex items-center gap-0.5 text-[11px] text-error-600"
                      }
                    >
                      <DeltaIcon
                        aria-hidden="true"
                        size={10}
                        strokeWidth={2.5}
                      />
                      {Math.abs(row.deltaPts)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/notebooks">
            Ver cuadernos
            <ArrowRight aria-hidden="true" size={13} strokeWidth={2} />
          </Link>
        </Button>
      </Card>
    </div>
  );
}
