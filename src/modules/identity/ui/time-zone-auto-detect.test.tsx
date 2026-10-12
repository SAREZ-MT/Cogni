import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeZoneAutoDetect } from "./time-zone-auto-detect";

const { adoptBrowserTimeZoneAction } = vi.hoisted(() => ({
  adoptBrowserTimeZoneAction: vi.fn(),
}));
vi.mock("../actions", () => ({ adoptBrowserTimeZoneAction }));

function stubBrowserZone(timeZone: string | undefined) {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    timeZone,
  } as Intl.ResolvedDateTimeFormatOptions);
}

afterEach(() => {
  vi.restoreAllMocks();
  adoptBrowserTimeZoneAction.mockReset();
});

describe("TimeZoneAutoDetect", () => {
  it("reports the browser zone once and renders nothing", async () => {
    stubBrowserZone("America/Bogota");
    adoptBrowserTimeZoneAction.mockResolvedValue({ ok: true, adopted: true });

    const { container, rerender } = render(<TimeZoneAutoDetect />);
    rerender(<TimeZoneAutoDetect />);

    await waitFor(() =>
      expect(adoptBrowserTimeZoneAction).toHaveBeenCalledWith("America/Bogota"),
    );
    expect(adoptBrowserTimeZoneAction).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it("does nothing when the browser exposes no zone", async () => {
    stubBrowserZone(undefined);

    render(<TimeZoneAutoDetect />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(adoptBrowserTimeZoneAction).not.toHaveBeenCalled();
  });

  it("swallows a rejected call: detection never breaks the shell", async () => {
    stubBrowserZone("America/Bogota");
    adoptBrowserTimeZoneAction.mockRejectedValue(new Error("offline"));

    render(<TimeZoneAutoDetect />);

    await waitFor(() => expect(adoptBrowserTimeZoneAction).toHaveBeenCalled());
  });
});
