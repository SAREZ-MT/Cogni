import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("associates the label with a native checkbox input", () => {
    render(<Checkbox name="accept" label="Acepto" />);

    const box = screen.getByLabelText("Acepto");
    expect(box).toHaveAttribute("type", "checkbox");
    expect(box).toHaveAttribute("name", "accept");
  });

  it("toggles on click and honours defaultChecked", async () => {
    const user = userEvent.setup();
    render(<Checkbox name="a" label="Uno" />);
    render(<Checkbox name="b" label="Dos" defaultChecked />);

    const one = screen.getByLabelText("Uno");
    await user.click(one);

    expect(one).toBeChecked();
    expect(screen.getByLabelText("Dos")).toBeChecked();
  });

  it("links the description to the input for assistive technology", () => {
    render(<Checkbox name="a" label="Uno" description="Detalle" />);

    const box = screen.getByLabelText("Uno");
    const description = screen.getByText("Detalle");
    expect(box.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("forwards required, data-testid and className to the right elements", () => {
    render(
      <Checkbox
        name="a"
        label="Uno"
        required
        data-testid="box"
        className="extra"
      />,
    );

    expect(screen.getByTestId("box")).toBeRequired();
    expect(screen.getByTestId("box")).toHaveAttribute("type", "checkbox");
    expect(document.querySelector('[data-slot="checkbox"]')).toHaveClass(
      "extra",
    );
  });
});
