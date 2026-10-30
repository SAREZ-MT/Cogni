import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExamGenerateDialog } from "./exam-generate-dialog";

function renderDialog() {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ExamGenerateDialog
      open
      onOpenChange={onOpenChange}
      count={15}
      onCountChange={() => {}}
      min={10}
      max={30}
      step={5}
      onConfirm={onConfirm}
    />,
  );
  return {
    onConfirm,
    onOpenChange,
    dialog: screen.getByRole("dialog", { name: "Generar preguntas de examen" }),
  };
}

// The techniques panel's Examen "Generar" count dialog; Phase 8 H12 gives
// it the exams theme like the hub's "Crear examen".
describe("ExamGenerateDialog", () => {
  it("wears the exams theme with the dialog-size count field", () => {
    const { dialog } = renderDialog();

    expect(dialog).toHaveAttribute("data-technique-theme", "exams");
    expect(dialog.querySelector('[data-slot="pixel-tile"]')).toHaveAttribute(
      "data-tone",
      "rose",
    );
    const count = within(dialog).getByRole("group", {
      name: "Preguntas a generar",
    });
    expect(count).toHaveAttribute("data-size", "field");
    expect(count).toHaveTextContent("Entre 10 y 30, de 5 en 5");
    expect(
      within(dialog).getByTestId("confirm-exam-generation"),
    ).toHaveAttribute("data-variant", "technique");
  });

  it("closes and confirms the chosen count", async () => {
    const user = userEvent.setup();
    const { dialog, onConfirm, onOpenChange } = renderDialog();

    await user.click(within(dialog).getByTestId("confirm-exam-generation"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).toHaveBeenCalledWith(15);
  });
});
