import type { Locator } from "@playwright/test";

// Phase 8 H12: the dialogs' styled Select (Radix) replaced the native
// <select>, so `selectOption` no longer applies. Opens the combobox named
// `label` inside `scope` and clicks the option named `option` (the listbox
// renders in a portal, so it is looked up on the page).
export async function chooseOption(
  scope: Locator,
  label: string,
  option: string,
): Promise<void> {
  await scope.getByRole("combobox", { name: label }).click();
  await scope
    .page()
    .getByRole("listbox")
    .getByRole("option", { name: option, exact: true })
    .click();
}
