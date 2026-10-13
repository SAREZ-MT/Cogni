import { getCurrentTimeZoneSetting } from "@/modules/identity";
import {
  TIME_ZONE_COPY,
  TimeZoneForm,
  timeZoneGroups,
} from "@/modules/identity/ui";
import { Card } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { StatusBanner } from "@/shared/ui/status-banner";
import { SetBreadcrumb } from "../_components/breadcrumb";

// Configuración (Phase 7 T2a, user decision 2026-10-12): a minimal settings
// page in the Profile Settings style (ui_kits/app/Profile Settings.html:
// panel with title/subtitle header, form row, save row) holding only the
// time zone for now. Auth comes from the (app) layout, like its siblings.
// A failed profile read shows an error instead of the form: an editable
// select would preselect the browser zone and a save would overwrite the
// stored one without the user ever seeing it.
export default async function SettingsPage() {
  const setting = await getCurrentTimeZoneSetting();
  const failed = setting.status === "failed";
  const current = setting.chosen ? setting.timeZone : null;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: TIME_ZONE_COPY.pageTitle }]} />
      <SectionHeader
        title={TIME_ZONE_COPY.pageTitle}
        titleClassName="text-[26px]"
      />

      <Card
        padding="none"
        className="w-full max-w-[760px] overflow-hidden"
        data-testid="time-zone-card"
      >
        <div className="border-border-subtle border-b px-[22px] py-[18px]">
          <h2 className="font-semibold text-fg text-sm">
            {TIME_ZONE_COPY.sectionTitle}
          </h2>
          <p className="mt-0.5 text-fg-muted text-xs">
            {TIME_ZONE_COPY.sectionDescription}
          </p>
        </div>
        {failed ? (
          <div className="px-[22px] py-4">
            <StatusBanner
              role="alert"
              tone="error"
              title={TIME_ZONE_COPY.loadFailedTitle}
              description={TIME_ZONE_COPY.loadFailedDescription}
            />
          </div>
        ) : (
          <TimeZoneForm
            groups={timeZoneGroups(
              Intl.supportedValuesOf("timeZone"),
              new Date(),
              current ?? undefined,
            )}
            initialTimeZone={current}
          />
        )}
      </Card>
    </section>
  );
}
