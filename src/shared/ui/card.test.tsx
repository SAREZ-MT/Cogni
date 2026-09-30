import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

describe("Card", () => {
  it("renders a div by default and forwards props and children", () => {
    render(
      <Card data-testid="card" className="extra">
        contenido
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveAttribute("data-slot", "card");
    expect(card).toHaveClass("extra");
    expect(card).toHaveTextContent("contenido");
  });

  it("renders its styling onto the child with asChild, keeping its semantics", () => {
    render(
      <Card asChild>
        <article aria-label="Cuaderno">hola</article>
      </Card>,
    );

    const article = screen.getByRole("article", { name: "Cuaderno" });
    expect(article).toHaveAttribute("data-slot", "card");
    expect(article).toHaveClass("rounded-xl");
    expect(document.querySelectorAll('[data-slot="card"]')).toHaveLength(1);
  });

  it("supports a link child with asChild", () => {
    render(
      <Card asChild>
        <a href="/notebooks/1">Abrir</a>
      </Card>,
    );

    const link = screen.getByRole("link", { name: "Abrir" });
    expect(link).toHaveAttribute("href", "/notebooks/1");
    expect(link).toHaveAttribute("data-slot", "card");
  });

  it("maps each tone to a distinct surface", () => {
    const tones = [
      "default",
      "subtle",
      "success",
      "error",
      "achievement",
    ] as const;
    const classes = tones.map((tone) => {
      const { unmount } = render(<Card tone={tone} data-testid="c" />);
      const value = screen.getByTestId("c").className;
      unmount();
      return value;
    });

    expect(new Set(classes).size).toBe(tones.length);
    expect(classes[0]).toContain("bg-card");
    expect(classes[2]).toContain("bg-success-50");
    expect(classes[3]).toContain("bg-error-50");
  });

  it("applies the padding scale and none by default", () => {
    const { rerender } = render(<Card data-testid="c" />);
    const card = screen.getByTestId("c");
    expect(card.className).not.toMatch(/\bp-[456]\b/);

    rerender(<Card data-testid="c" padding="sm" />);
    expect(card).toHaveClass("p-4");
    rerender(<Card data-testid="c" padding="md" />);
    expect(card).toHaveClass("p-5");
    rerender(<Card data-testid="c" padding="lg" />);
    expect(card).toHaveClass("p-6");
  });

  it("lets className override the padding via tailwind-merge", () => {
    render(<Card data-testid="c" padding="md" className="p-[18px]" />);

    const card = screen.getByTestId("c");
    expect(card).toHaveClass("p-[18px]");
    expect(card).not.toHaveClass("p-5");
  });

  it("adds the hover lift only when interactive", () => {
    const { rerender } = render(<Card data-testid="c" />);
    expect(screen.getByTestId("c")).not.toHaveClass("hover:-translate-y-0.5");

    rerender(<Card data-testid="c" interactive />);
    expect(screen.getByTestId("c")).toHaveClass("hover:-translate-y-0.5");
  });
});

describe("Card slots", () => {
  it("renders the title as a heading and the description as text", () => {
    render(
      <Card>
        <CardHeader data-testid="header">
          <CardTitle>Título</CardTitle>
          <CardDescription>Descripción</CardDescription>
        </CardHeader>
        <CardContent data-testid="content">cuerpo</CardContent>
        <CardFooter data-testid="footer">pie</CardFooter>
      </Card>,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Título" }),
    ).toHaveAttribute("data-slot", "card-title");
    expect(screen.getByText("Descripción")).toHaveAttribute(
      "data-slot",
      "card-description",
    );
    expect(screen.getByTestId("header")).toHaveAttribute(
      "data-slot",
      "card-header",
    );
    expect(screen.getByTestId("content")).toHaveAttribute(
      "data-slot",
      "card-content",
    );
    expect(screen.getByTestId("footer")).toHaveAttribute(
      "data-slot",
      "card-footer",
    );
  });

  it("forwards className on every slot", () => {
    render(
      <>
        <CardHeader data-testid="h" className="x" />
        <CardTitle data-testid="t" className="x" />
        <CardDescription data-testid="d" className="x" />
        <CardContent data-testid="c" className="x" />
        <CardFooter data-testid="f" className="x" />
      </>,
    );

    for (const id of ["h", "t", "d", "c", "f"]) {
      expect(screen.getByTestId(id)).toHaveClass("x");
    }
  });
});
