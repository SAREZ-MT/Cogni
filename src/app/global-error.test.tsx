import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import GlobalError from "./global-error";

describe("GlobalError", () => {
  it("reports the error to Sentry once and offers a retry", () => {
    const error = Object.assign(new Error("boom"), { digest: "d1" });
    const retry = vi.fn();
    render(<GlobalError error={error} retry={retry} />);

    expect(captureException).toHaveBeenCalledWith(error);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("heading", { name: /algo salió mal/i }),
    ).toBeInTheDocument();
    screen.getByRole("button", { name: /intentar de nuevo/i }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
