"use client";

import * as React from "react";
import type { LegendPayload, TooltipPayloadEntry } from "recharts";
import { Legend, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/shared/ui/utils";

// shadcn/ui `chart.tsx` adapted for Cogni (dashboard chart spec, Recharts 3):
// same ChartContainer/ChartStyle/ChartTooltip(Content)/ChartLegend(Content)
// anatomy as ui.shadcn.com/docs/components/chart, but every class below
// resolves to an existing Cogni token instead of the stock shadcn/OKLCH
// `--chart-1..5`/`--border`/`--muted-foreground` names, and dark-mode theme
// variants were dropped (design.md: "Dark mode is intentionally omitted in
// phase 0"). Recharts 3 changed the Tooltip `content` render-prop shape
// (payload/active/label now only exist on `TooltipContentProps`, not on the
// `<Tooltip>` component's own props), so this file imports those types
// directly from `recharts` instead of re-deriving them from
// `React.ComponentProps<typeof Tooltip>` the way the v2-era shadcn source did.

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    // A CSS color value, usually `var(--color-<token>)` pointing at an
    // existing Cogni token (globals.css @theme) — never a raw hex literal.
    color?: string;
  }
>;

interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("Chart components must be used within a <ChartContainer>");
  }
  return context;
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorEntries = Object.entries(config).filter(([, cfg]) => cfg.color);
  if (colorEntries.length === 0) return null;

  const css = `[data-chart="${id}"] {\n${colorEntries
    .map(([key, cfg]) => `  --color-${key}: ${cfg.color};`)
    .join("\n")}\n}`;

  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, non-user-controlled CSS custom properties (same pattern as shadcn's chart.tsx)
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

interface ChartContainerProps extends React.ComponentProps<"div"> {
  config: ChartConfig;
  children: React.ReactElement;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ChartContainerProps) {
  const reactId = React.useId();
  const chartId = `chart-${id ?? reactId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex w-full justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-fg-muted [&_.recharts-cartesian-grid_line]:stroke-border-subtle [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border-subtle [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border-subtle [&_.recharts-radial-bar-background-sector]:fill-neutral-100 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-neutral-100 [&_.recharts-reference-line-line]:stroke-border-default [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartTooltip = Tooltip;

function chartConfigLabel(
  config: ChartConfig,
  payloadItem: TooltipPayloadEntry | LegendPayload,
  fallbackKey: string,
): React.ReactNode {
  const payload =
    "payload" in payloadItem && payloadItem.payload
      ? (payloadItem.payload as Record<string, unknown>)
      : undefined;
  const candidate =
    (typeof payload?.[fallbackKey] === "string" && payload[fallbackKey]) ||
    fallbackKey;
  const entry = config[candidate as string] ?? config[fallbackKey];
  return entry?.label;
}

// Deliberately NOT extending recharts' own `TooltipContentProps` (every
// field there — active/payload/label/… — is required on that type, since
// it's the shape recharts guarantees once it clones this element as a
// `content` render prop). This component is used as
// `<Tooltip content={<ChartTooltipContent indicator="dot" />} />`, so at
// the JSX call site those fields aren't provided yet — only self-declared
// as optional here — and recharts supplies them at runtime via
// `cloneElement`, matching the upstream shadcn `chart.tsx` pattern.
interface ChartTooltipContentProps {
  className?: string;
  indicator?: "line" | "dot" | "dashed";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  nameKey?: string;
  labelKey?: string;
  active?: boolean;
  payload?: readonly TooltipPayloadEntry[];
  label?: React.ReactNode;
  labelFormatter?: (
    label: React.ReactNode,
    payload: readonly TooltipPayloadEntry[],
  ) => React.ReactNode;
  formatter?: (
    value: number | string,
    name: string,
    item: TooltipPayloadEntry,
    index: number,
  ) => React.ReactNode;
}

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  formatter,
  nameKey,
  labelKey,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  const [firstItem] = payload;
  // Bugfix (visual review): the header label must be the hovered axis
  // category (recharts' own injected `label` prop, e.g. a period like
  // "S12") — NOT a per-series config lookup. `chartConfigLabel` is correct
  // for per-row labels below (mapping a series' own dataKey to its
  // human name), but reusing it here previously looked up
  // `config[firstItem.dataKey]` whenever `payload[dataKey]` wasn't itself a
  // string, which resolved to the FIRST series' own name (e.g. "Cálculo
  // III") instead of the axis value. `labelKey` stays an explicit opt-in
  // for charts that really do want a config-keyed header (e.g. a pie
  // chart's slice name).
  const labelContent = hideLabel
    ? null
    : (() => {
        const resolved = labelKey
          ? (chartConfigLabel(config, firstItem, labelKey) ?? label ?? null)
          : (label ?? null);
        const rendered = labelFormatter
          ? labelFormatter(resolved, payload)
          : resolved;
        return rendered ? (
          <div className="font-medium text-fg">{rendered}</div>
        ) : null;
      })();

  return (
    <div
      className={cn(
        "grid min-w-[9rem] gap-1.5 rounded-xl border border-border-subtle bg-card px-3 py-2 text-[12.5px] shadow-card",
        className,
      )}
    >
      {labelContent}
      <div className="grid gap-1">
        {payload.map((item, index) => {
          const key = nameKey ?? String(item.dataKey ?? item.name ?? "value");
          const itemLabel = chartConfigLabel(config, item, key) ?? item.name;
          const color = item.color ?? item.payload?.fill;
          const value = item.value as number | string | undefined;

          return (
            <div
              key={`${item.dataKey}-${item.name}-${index}`}
              className="flex items-center gap-2"
            >
              {!hideIndicator && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 rounded-[2px]",
                    indicator === "dot" && "size-2.5",
                    indicator === "line" && "h-2.5 w-1",
                    indicator === "dashed" &&
                      "h-0 w-2.5 border-t-2 border-dashed bg-transparent",
                  )}
                  style={{
                    backgroundColor: indicator === "dashed" ? undefined : color,
                    borderColor: indicator === "dashed" ? color : undefined,
                  }}
                />
              )}
              <span className="flex-1 text-fg-muted">{itemLabel}</span>
              <span className="font-semibold text-fg tabular-nums">
                {formatter && value !== undefined && item.name
                  ? formatter(value, String(item.name), item, index)
                  : value?.toLocaleString("es-ES")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = Legend;

// Same reasoning as `ChartTooltipContentProps` above: `payload` is optional
// here even though recharts always supplies it once it clones this element,
// so `<Legend content={<ChartLegendContent />} />` type-checks at the call
// site.
interface ChartLegendContentProps {
  className?: string;
  nameKey?: string;
  payload?: readonly LegendPayload[];
}

function ChartLegendContent({
  className,
  payload,
  nameKey,
}: ChartLegendContentProps) {
  const { config } = useChart();

  if (!payload?.length) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 pt-3",
        className,
      )}
    >
      {payload.map((item) => {
        const key = nameKey ?? String(item.dataKey ?? item.value ?? "value");
        const itemLabel = chartConfigLabel(config, item, key) ?? item.value;

        return (
          <span
            key={String(item.value)}
            className="flex items-center gap-1.5 rounded-pill bg-neutral-100 px-2.5 py-1"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-medium text-[11px] text-fg-secondary">
              {itemLabel}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
};
