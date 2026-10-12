// Shape the time-zone Server Action returns to its form (useActionState).
export interface TimeZoneFormState {
  status: "idle" | "error" | "success";
  message?: string;
  // The stored (canonical) zone after a successful save; the form
  // selects it.
  timeZone?: string;
}
