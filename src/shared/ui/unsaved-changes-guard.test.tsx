import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { UnsavedChangesGuard } from "./unsaved-changes-guard";

function setup(when: boolean) {
  const user = userEvent.setup();
  render(
    <>
      <a href="/flashcards">Flashcards</a>
      <a href="https://example.com/x">Fuera</a>
      <UnsavedChangesGuard when={when} />
    </>,
  );
  return user;
}

describe("UnsavedChangesGuard (Phase 8 H18)", () => {
  beforeEach(() => push.mockReset());

  it("asks with an app dialog before following an in-app link while there are changes", async () => {
    const user = setup(true);

    await user.click(screen.getByRole("link", { name: "Flashcards" }));

    expect(
      screen.getByRole("dialog", { name: "¿Salir sin guardar?" }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    expect(push).toHaveBeenCalledWith("/flashcards");
  });

  it("stays on the page with Seguir editando", async () => {
    const user = setup(true);

    await user.click(screen.getByRole("link", { name: "Flashcards" }));
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("warns the browser before unloading while there are changes, and never without", () => {
    const { unmount } = render(<UnsavedChangesGuard when />);
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    unmount();

    render(<UnsavedChangesGuard when={false} />);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
  });

  it("lets links through without changes", async () => {
    const user = setup(false);

    await user.click(screen.getByRole("link", { name: "Flashcards" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
