import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RegisterPage from "./page";

describe("RegisterPage", () => {
  it("reminds that creating an account requires accepting the terms, with a link to them", () => {
    render(<RegisterPage />);

    expect(
      screen.getByText(/Al crear una cuenta deberás aceptar los/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "términos de uso" }),
    ).toHaveAttribute("href", "/terminos");
  });
});
