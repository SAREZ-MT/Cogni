import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeHeader } from "./home-header";

vi.mock("@/modules/notebooks", () => ({
  CreateNotebookTrigger: () => <button type="button">Nuevo cuaderno</button>,
}));

describe("HomeHeader", () => {
  it("greets the user by name and shows the create-notebook CTA", () => {
    render(
      <HomeHeader displayName="Ana" now={new Date("2026-09-23T09:00:00")} />,
    );

    expect(screen.getByText("Buenos días, Ana")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nuevo cuaderno" }),
    ).toBeInTheDocument();
  });

  it("switches the greeting by time of day", () => {
    render(
      <HomeHeader displayName="Ana" now={new Date("2026-09-23T20:00:00")} />,
    );

    expect(screen.getByText("Buenas noches, Ana")).toBeInTheDocument();
  });
});
