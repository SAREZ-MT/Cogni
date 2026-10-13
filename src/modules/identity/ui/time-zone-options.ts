import { DEFAULT_TIMEZONE } from "../domain/profile";
import { EXPLICIT_UTC } from "../domain/time-zone";

export interface TimeZoneOption {
  value: string;
  label: string;
}

export interface TimeZoneGroup {
  label: string;
  options: TimeZoneOption[];
}

const UNIVERSAL = "Universal";
const OTHER = "Otras";

const REGION_LABELS: Record<string, string> = {
  Africa: "África",
  America: "América",
  Antarctica: "Antártida",
  Arctic: "Ártico",
  Asia: "Asia",
  Atlantic: "Atlántico",
  Australia: "Australia",
  Europe: "Europa",
  Indian: "Índico",
  Pacific: "Pacífico",
};

// "GMT-5", "GMT+5:30", "GMT+0" — the offset in force at `now` (it changes
// with daylight saving, so the label says the current one). ICU versions
// disagree on the zero offset ("GMT" locally, "GMT+0" on CI runners), so it
// is normalized to "GMT+0".
function offsetOf(timeZone: string, now: Date): string {
  const part = new Intl.DateTimeFormat("en", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find((item) => item.type === "timeZoneName");
  const offset = part?.value ?? "GMT";
  return offset === "GMT" ? "GMT+0" : offset;
}

function cityOf(path: readonly string[]): string {
  return path.join(" / ").replaceAll("_", " ");
}

function isUtc(zone: string): boolean {
  return zone === DEFAULT_TIMEZONE || zone === EXPLICIT_UTC;
}

// Grouped options of the Configuración time-zone select: a native <select>
// with <optgroup>s per region (keyboard typeahead on the city), UTC first as
// the explicit Etc/UTC choice. `zones` is Intl.supportedValuesOf("timeZone")
// on the server; `current` is the stored zone, kept even when the list
// lacks it so the select never silently shows another value.
export function timeZoneGroups(
  zones: readonly string[],
  now: Date,
  current?: string,
): TimeZoneGroup[] {
  const all = new Set(zones);
  if (current) all.add(current);

  const byRegion = new Map<string, TimeZoneOption[]>();
  for (const zone of all) {
    if (isUtc(zone)) continue;
    const [region = "", ...path] = zone.split("/");
    const label = REGION_LABELS[region] ?? OTHER;
    const city = path.length > 0 ? cityOf(path) : cityOf([region]);
    const options = byRegion.get(label) ?? [];
    options.push({ value: zone, label: `${city} (${offsetOf(zone, now)})` });
    byRegion.set(label, options);
  }

  const regions = [...byRegion.keys()].sort((a, b) =>
    a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b, "es"),
  );
  return [
    {
      label: UNIVERSAL,
      options: [
        { value: EXPLICIT_UTC, label: `UTC (${offsetOf("UTC", now)})` },
      ],
    },
    ...regions.map((label) => ({
      label,
      options: (byRegion.get(label) ?? []).sort((a, b) =>
        a.label.localeCompare(b.label, "es"),
      ),
    })),
  ];
}
