import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NativeSelect } from "./native-select";

describe("NativeSelect", () => {
  it("renders a native select with its options and reports the choice", async () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="nb">Cuaderno</label>
        <NativeSelect
          id="nb"
          value="a"
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="a">Biología</option>
          <option value="b">Cálculo</option>
        </NativeSelect>
      </>,
    );

    const select = screen.getByRole("combobox", { name: "Cuaderno" });
    await userEvent.selectOptions(select, "b");

    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("uses the Input atom's field chrome", () => {
    render(
      <NativeSelect aria-label="x" defaultValue="a" className="extra">
        <option value="a">A</option>
      </NativeSelect>,
    );

    expect(screen.getByRole("combobox")).toHaveClass(
      "h-8",
      "rounded-lg",
      "border-input",
      "extra",
    );
  });
});
