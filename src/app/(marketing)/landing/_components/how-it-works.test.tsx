import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HOW_IT_WORKS_STEPS, HowItWorks } from "./how-it-works";

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe("HowItWorks", () => {
  it("keeps the anchor and names the section with the full headline", () => {
    render(<HowItWorks />);
    const section = screen.getByRole("region", {
      name: "Del apunte al repaso, sin armar nada a mano.",
    });
    expect(section).toHaveAttribute("id", "como-funciona");
    expect(section).toHaveAttribute("data-nav-theme", "light");
  });

  it("sets exactly one keyword of the headline in the serif italic", () => {
    render(<HowItWorks />);
    const heading = screen.getByRole("heading", { level: 2 });
    const accents = heading.querySelectorAll("em");
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent("repaso");
  });

  it("lists the three steps in order with their numbers and v2 lines", () => {
    render(<HowItWorks />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "01Sube tu apunteImporta tu documento o escribe directo en el editor.",
      "02Cogni prepara tus técnicasTú eliges qué técnica generar, y sale solo de lo que dice tu página.",
      "03Repasa cuando tocaCada respuesta fija tu próximo repaso. Tú solo abres Hoy.",
    ]);
    expect(HOW_IT_WORKS_STEPS).toHaveLength(3);
  });

  it("loads the product video lazily behind its poster, with Spanish captions", () => {
    const { container } = render(<HowItWorks />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("aria-label", "Video: así funciona Cogni");
    expect(video).toHaveAttribute("poster", "/landing/cogni-video-poster.webp");
    expect(video).toHaveAttribute("preload", "none");
    expect(video).toHaveAttribute("playsinline");
    expect(video).not.toHaveAttribute("controls");
    expect(video?.querySelector("source")).toHaveAttribute(
      "src",
      "/landing/cogni-video.mp4",
    );
    const track = video?.querySelector("track");
    expect(track).toHaveAttribute("src", "/landing/cogni-video.es.vtt");
    expect(track).toHaveAttribute("srclang", "es");
    expect(track).toHaveAttribute("kind", "captions");
    expect(screen.queryByText("Video próximamente")).toBeNull();
  });

  it("plays the video with its controls once the play button is pressed", () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const { container } = render(<HowItWorks />);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir video" }));
    expect(play).toHaveBeenCalledOnce();
    expect(container.querySelector("video")).toHaveAttribute("controls");
    expect(
      screen.queryByRole("button", { name: "Reproducir video" }),
    ).toBeNull();
    play.mockRestore();
  });

  it("tints its headline object yellow", () => {
    render(<HowItWorks />);
    const slot = screen
      .getByRole("heading", { level: 2 })
      .querySelector('[data-glyph="notebook"]');
    expect(slot).toHaveAttribute("data-tone", "yellow");
  });

  it("renders the headline object from a supplied image", () => {
    render(
      <HowItWorks
        image={{ src: "/landing/how-it-works-object.webp", alt: "" }}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2 });
    const img = heading.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("how-it-works-object");
  });
});
