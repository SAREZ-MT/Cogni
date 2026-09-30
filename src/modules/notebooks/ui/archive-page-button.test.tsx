import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArchivePageButton } from "./archive-page-button";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { archivePage } = vi.hoisted(() => ({
  archivePage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../actions", () => ({ archivePage }));

describe("ArchivePageButton", () => {
  beforeEach(() => {
    refresh.mockReset();
    archivePage.mockClear();
  });

  it("opens the confirmation dialog when the trash button is clicked", async () => {
    const user = userEvent.setup();
    render(<ArchivePageButton pageId="p1" title="Mitocondria" />);

    await user.click(
      screen.getByRole("button", { name: "Archivar página Mitocondria" }),
    );

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(archivePage).not.toHaveBeenCalled();
  });

  it("archives the page and refreshes once the dialog is confirmed", async () => {
    const user = userEvent.setup();
    render(<ArchivePageButton pageId="p1" title="Mitocondria" />);

    await user.click(
      screen.getByRole("button", { name: "Archivar página Mitocondria" }),
    );
    await user.click(await screen.findByRole("button", { name: /^Archivar$/ }));

    await waitFor(() =>
      expect(archivePage).toHaveBeenCalledWith({ pageId: "p1" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("does not archive when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    render(<ArchivePageButton pageId="p1" title="Mitocondria" />);

    await user.click(
      screen.getByRole("button", { name: "Archivar página Mitocondria" }),
    );
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(archivePage).not.toHaveBeenCalled();
  });
});
