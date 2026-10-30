import type { LucideIcon } from "lucide-react";
import type { TechniqueTone } from "@/shared/ui/technique-card";

type Route = { href: string; isActive: (path: string) => boolean };

// A sidebar entry is one of three things:
// - a regular link (`href`),
// - a "pronto" row for an area that does not exist yet (`disabled`),
// - a design preview (`disabled` + `preview`): a real route backed by sample
//   data, linked only while design previews are enabled (see
//   shared/config/design-previews.ts) and a "pronto" row otherwise.
// `tone` marks a study technique: its active row takes the technique colour.
// `tourId` is the row's `data-tour` anchor for the product tour.
export type NavEntry = {
  icon: LucideIcon;
  label: string;
  tone?: TechniqueTone;
  tourId?: string;
} & (
  | (Route & { shortcut?: string[] })
  | { disabled: true; hint: string; preview?: Route }
);

export type ResolvedNavEntry =
  | {
      disabled: false;
      icon: LucideIcon;
      label: string;
      href: string;
      active: boolean;
      shortcut: string[] | undefined;
      tone: TechniqueTone | undefined;
      tourId: string | undefined;
    }
  | { disabled: true; icon: LucideIcon; label: string; hint: string };

export function resolveNavEntry(
  entry: NavEntry,
  previewsEnabled: boolean,
  pathname: string,
): ResolvedNavEntry {
  const { icon, label, tone, tourId } = entry;

  if (!("disabled" in entry)) {
    return {
      disabled: false,
      icon,
      label,
      href: entry.href,
      active: entry.isActive(pathname),
      shortcut: entry.shortcut,
      tone,
      tourId,
    };
  }

  if (entry.preview && previewsEnabled) {
    return {
      disabled: false,
      icon,
      label,
      href: entry.preview.href,
      active: entry.preview.isActive(pathname),
      shortcut: undefined,
      tone,
      tourId,
    };
  }

  return { disabled: true, icon, label, hint: entry.hint };
}
