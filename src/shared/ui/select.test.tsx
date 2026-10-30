import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { chooseOption } from "./select.testing";

function Fruit({
  onChange = () => {},
  initial = "",
  disabled = false,
}: {
  onChange?: (value: string) => void;
  initial?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="fruit">Fruta</label>
      <Select
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger id="fruit" data-testid="fruit">
          <SelectValue placeholder="Elige una fruta" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Manzana</SelectItem>
          <SelectItem value="pear">Pera</SelectItem>
          <SelectItem value="plum">Ciruela</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

// Phase 8 H12: the dialogs' styled select (Radix), keyboard first.
describe("Select", () => {
  it("is a combobox named by its label that shows the placeholder", () => {
    render(<Fruit />);

    const box = screen.getByRole("combobox", { name: "Fruta" });
    expect(box).toHaveTextContent("Elige una fruta");
    expect(box).toHaveAttribute("data-placeholder");
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("opens with the keyboard and picks an option with arrows and Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Fruit onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "Fruta" });

    box.focus();
    await user.keyboard("{Enter}");
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Manzana", "Pera", "Ciruela"]);

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("pear");
    expect(box).toHaveTextContent("Pera");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).toHaveFocus();
  });

  it("closes on Escape without changing the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Fruit onChange={onChange} initial="plum" />);
    const box = screen.getByRole("combobox", { name: "Fruta" });

    box.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(box).toHaveTextContent("Ciruela");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks the chosen option as selected", async () => {
    const user = userEvent.setup();
    render(<Fruit initial="apple" />);

    screen.getByRole("combobox", { name: "Fruta" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("option", { name: "Manzana" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("can be disabled", () => {
    render(<Fruit disabled />);

    expect(screen.getByRole("combobox", { name: "Fruta" })).toBeDisabled();
  });
});

describe("chooseOption (test helper)", () => {
  it("picks an option by its name", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Fruit onChange={onChange} />);

    await chooseOption(
      user,
      screen.getByRole("combobox", { name: "Fruta" }),
      "Ciruela",
    );

    expect(onChange).toHaveBeenCalledWith("plum");
  });
  it("clips long labels to one line and keeps the full text as a tooltip", async () => {
    const user = userEvent.setup();
    const long = "Una página con un título tan largo que no cabe en el diálogo";
    render(
      <Select>
        <SelectTrigger aria-label="Página" data-testid="long">
          <SelectValue placeholder="Elige una página" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p1">{long}</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByTestId("long").className).toContain("[&>span]:min-w-0");
    screen.getByTestId("long").focus();
    await user.keyboard("{Enter}");
    const option = await screen.findByRole("option", { name: long });
    expect(option).toHaveAttribute("title", long);
    expect(option.querySelector(".truncate")).not.toBeNull();
  });
});
