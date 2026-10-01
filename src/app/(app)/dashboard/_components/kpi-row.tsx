import {
  AlarmClock,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookCheck,
  Flame,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { IconTile } from "@/shared/ui/icon-tile";
import {
  itemsVencidosKpi,
  paginasDominadasKpi,
  rachaRepasosKpi,
} from "../_data/sample";

interface KpiTileProps {
  label: string;
  value: string;
  delta: number;
  // Inverted metric (e.g. "ítems vencidos"): a negative delta is good, so
  // its pill/arrow read success instead of error.
  invert?: boolean;
  icon: LucideIcon;
  href: string;
}

// Row 5 — one tile per KPI: label, big value, a delta pill, an icon tile
// top-right and an outline "Ver detalle →" button. Kept route-local (not
// promoted to `shared/ui`, same precedent as v1's `TechniqueCard`): this
// exact icon-tile + outline-button shape is only used here, 3 times.
function KpiTile({
  label,
  value,
  delta,
  invert,
  icon: Icon,
  href,
}: KpiTileProps) {
  const good = invert ? delta <= 0 : delta >= 0;
  const DeltaIcon = delta < 0 ? ArrowDown : ArrowUp;
  const deltaText = `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${Math.abs(delta)}`;

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[12px] text-fg-muted">{label}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-bold text-[24px] text-fg leading-none">
              {value}
            </span>
            <span
              className={
                good
                  ? "flex items-center gap-0.5 rounded-pill bg-success-100 px-2 py-0.5 font-semibold text-[10.5px] text-success-700"
                  : "flex items-center gap-0.5 rounded-pill bg-error-100 px-2 py-0.5 font-semibold text-[10.5px] text-error-700"
              }
            >
              <DeltaIcon aria-hidden="true" size={10} strokeWidth={2.5} />
              {deltaText}
            </span>
          </div>
        </div>
        <IconTile size="36" radius="input" tone="neutral">
          <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
        </IconTile>
      </div>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href={href}>
          Ver detalle
          <ArrowRight aria-hidden="true" size={13} strokeWidth={2} />
        </Link>
      </Button>
    </Card>
  );
}

// Row 5 — 3 KPI tiles (racha de repasos, ítems vencidos, páginas
// dominadas). All values are derived from `_data/sample.ts`'s
// deterministic helpers.
export function KpiRow() {
  const racha = rachaRepasosKpi();
  const dominadas = paginasDominadasKpi();
  const vencidos = itemsVencidosKpi();

  return (
    <div
      data-testid="kpi-row"
      className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3"
    >
      <KpiTile
        label="Racha de repasos"
        value={`${racha.days} días`}
        delta={racha.delta}
        icon={Flame}
        href="/"
      />
      <KpiTile
        label="Ítems vencidos"
        value={String(vencidos.due)}
        delta={vencidos.delta}
        invert
        icon={AlarmClock}
        href="/notebooks"
      />
      <KpiTile
        label="Páginas dominadas"
        value={`${dominadas.value} de ${dominadas.total}`}
        delta={dominadas.delta}
        icon={BookCheck}
        href="/notebooks"
      />
    </div>
  );
}
