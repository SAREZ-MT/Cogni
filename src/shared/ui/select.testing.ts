import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

// Test helper for the Radix `Select` atom (Phase 8 H12): opens the
// combobox from the keyboard, like a keyboard user would, and clicks the
// named option in the open listbox.
export async function chooseOption(
  user: UserEvent,
  combobox: HTMLElement,
  name: string,
) {
  combobox.focus();
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("option", { name }));
}
