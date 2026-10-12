"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/native-select";
import { updateTimeZoneAction } from "../actions";
import { TIME_ZONE_COPY } from "./time-zone-copy";
import type { TimeZoneFormState } from "./time-zone-form-state";
import type { TimeZoneGroup } from "./time-zone-options";

const IDLE: TimeZoneFormState = { status: "idle" };

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export interface TimeZoneFormProps {
  groups: readonly TimeZoneGroup[];
  // The stored zone, or null while the profile has never chosen one.
  initialTimeZone: string | null;
}

// Configuración › Zona horaria body: one settings row (label + hint, the
// grouped native select) and the save row, in the Profile Settings layout
// (ui_kits/app/Profile Settings.html: form-row + save-row). With no stored
// zone the browser's one is preselected when the list has it, matching what
// TimeZoneAutoDetect saves in the background.
export function TimeZoneForm({ groups, initialTimeZone }: TimeZoneFormProps) {
  const [state, action, pending] = useActionState(updateTimeZoneAction, IDLE);
  const [value, setValue] = useState(initialTimeZone ?? "");
  const selectId = useId();
  const hintId = useId();

  useEffect(() => {
    if (initialTimeZone !== null) return;
    const detected = browserTimeZone();
    const listed = groups.some((group) =>
      group.options.some((option) => option.value === detected),
    );
    if (detected && listed) setValue(detected);
  }, [groups, initialTimeZone]);

  const isError = state.status === "error";
  return (
    <form action={action}>
      <div className="flex flex-col gap-3 px-[22px] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div>
          <label
            htmlFor={selectId}
            className="font-medium text-[13px] text-fg-secondary"
          >
            {TIME_ZONE_COPY.fieldLabel}
          </label>
          <p id={hintId} className="mt-0.5 text-[11.5px] text-fg-muted">
            {TIME_ZONE_COPY.fieldHint}
          </p>
        </div>
        <NativeSelect
          id={selectId}
          name="timeZone"
          required
          aria-describedby={hintId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 sm:w-[280px]"
        >
          <option value="" disabled>
            {TIME_ZONE_COPY.placeholder}
          </option>
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-center justify-end gap-3 border-border-subtle border-t px-[22px] py-4">
        {state.status !== "idle" && state.message && (
          <p
            role={isError ? "alert" : "status"}
            className={
              isError
                ? "mr-auto text-error-600 text-sm"
                : "mr-auto text-sm text-success-600"
            }
          >
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-10">
          {pending ? TIME_ZONE_COPY.saving : TIME_ZONE_COPY.save}
        </Button>
      </div>
    </form>
  );
}
