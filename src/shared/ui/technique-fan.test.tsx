import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fanPose, fanTransition, TechniqueFan } from "./technique-fan";

const ALL = ["flashcards", "recall", "exams"] as const;

describe("TechniqueFan", () => {
  it("fans one mini card per technique, in order", () => {
    const { container } = render(<TechniqueFan techniques={[...ALL]} />);

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>('[data-part="fan-card"]'),
    );
    expect(cards.map((card) => card.dataset.technique)).toEqual([
      "flashcards",
      "recall",
      "exams",
    ]);
  });

  it("hints each technique's content in its own pastel pair", () => {
    const { container } = render(<TechniqueFan techniques={[...ALL]} />);

    const card = (technique: string) =>
      container.querySelector(`[data-technique="${technique}"]`);
    expect(
      card("flashcards")?.querySelector(".bg-pastel-yellow"),
    ).not.toBeNull();
    expect(card("recall")?.querySelector(".bg-pastel-mint")).not.toBeNull();
    expect(card("exams")?.querySelector(".bg-pastel-pink")).not.toBeNull();
    // Exams shows an option list: one chosen option among three.
    expect(
      card("exams")?.querySelectorAll('[data-part="option"]'),
    ).toHaveLength(3);
  });

  it("puts a mini notebook with a new-page affordance in front of the fan", () => {
    const { container } = render(<TechniqueFan techniques={[...ALL]} />);

    const notebook = container.querySelector('[data-part="notebook"]');
    expect(notebook).not.toBeNull();
    expect(
      notebook?.querySelector('[data-part="notebook-spine"]'),
    ).not.toBeNull();
    expect(
      notebook?.querySelector('[data-part="notebook-add"]'),
    ).not.toBeNull();
    // Front-most: rendered after every technique card.
    expect(container.firstElementChild?.lastElementChild).toBe(notebook);
    expect(container.querySelector("button, a")).toBeNull();
  });

  it("is decorative: hidden from assistive technology and textless", () => {
    const { container } = render(<TechniqueFan techniques={[...ALL]} />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root?.textContent).toBe("");
  });
});

describe("fanPose", () => {
  it("tilts the outer cards symmetrically and raises the middle one", () => {
    const poses = [0, 1, 2].map((index) => fanPose(index, 3));

    expect(poses.map((pose) => pose.rotate)).toEqual([-8, 0, 8]);
    expect(poses[0]?.x).toBe(-(poses[2]?.x ?? 0));
    expect(poses[1]?.x).toBe(0);
    expect(poses[1]?.y).toBeLessThan(poses[0]?.y ?? 0);
  });
});

describe("fanTransition", () => {
  it("settles once, without overshoot, within 500 ms", () => {
    const transition = fanTransition(false, 2);

    expect(transition).toMatchObject({ type: "spring", bounce: 0 });
    expect(
      (transition.visualDuration ?? 0) + (transition.delay ?? 0),
    ).toBeLessThanOrEqual(0.5);
  });

  it("jumps straight to the final pose under prefers-reduced-motion", () => {
    expect(fanTransition(true, 2)).toEqual({ duration: 0 });
  });
});
