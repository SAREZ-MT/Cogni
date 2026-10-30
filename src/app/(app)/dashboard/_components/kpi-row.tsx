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
import type { KpisView } from "../_lib/dashboard-view";

interface KpiTileProps {
  label: string;
  value: string;
  // Omitted for KPIs without a real previous value (T4 decision
  // 2026-10-13): those show a short context hint instead.
  delta?: number;
  hint?: string;
  icon: LucideIcon;
  href: string;
}

function DeltaPill({ delta }: { delta: number }) {
  const good = delta >= 0;
  const DeltaIcon = delta < 0 ? ArrowDown : ArrowUp;
  const deltaText = `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${Math.abs(delta)}`;
  return (
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
  );
}

// Row 5 — one tile per KPI: label, big value, a delta pill or a hint, an icon tile
// top-right and an outline "Ver detalle →" button. Kept route-local (not
// promoted to `shared/ui`, same precedent as v1's `TechniqueCard`): this
// exact icon-tile + outline-button shape is only used here, 3 times.
function KpiTile({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  href,
}: KpiTileProps) {
  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[12px] text-fg-muted">{label}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-bold text-[24px] text-fg leading-none">
              {value}
            </span>
            {delta !== undefined && <DeltaPill delta={delta} />}
          </div>
          {hint && <p className="mt-1.5 text-[11.5px] text-fg-muted">{hint}</p>}
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
// dominadas) from the analytics reads. Only the streak has a real previous
// value (as of 7 days ago), so only it carries a delta pill.
export function KpiRow({ kpis }: { kpis: KpisView }) {
  return (
    <div
      data-testid="kpi-row"
      className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3"
    >
      <KpiTile
        label="Racha de repasos"
        value={kpis.streak.value}
        delta={kpis.streak.delta}
        icon={Flame}
        href="/inicio"
      />
      <KpiTile
        label="Ítems vencidos"
        value={kpis.due.value}
        hint={kpis.due.hint}
        icon={AlarmClock}
        href="/notebooks"
      />
      <KpiTile
        label="Páginas dominadas"
        value={kpis.mastered.value}
        hint={kpis.mastered.hint}
        icon={BookCheck}
        href="/notebooks"
      />
    </div>
  );
}
