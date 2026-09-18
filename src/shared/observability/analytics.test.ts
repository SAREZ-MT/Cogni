import { beforeEach, describe, expect, it, vi } from "vitest";

const { capture, shutdown, PostHog } = vi.hoisted(() => {
  const capture = vi.fn();
  const shutdown = vi.fn().mockResolvedValue(undefined);
  const PostHog = vi.fn(function PostHogMock() {
    return { capture, shutdown };
  });
  return { capture, shutdown, PostHog };
});
vi.mock("posthog-node", () => ({ PostHog }));

import { createServerAnalytics } from "./analytics";

describe("createServerAnalytics", () => {
  beforeEach(() => {
    capture.mockReset();
    shutdown.mockClear();
    PostHog.mockClear();
  });

  it("creates a short-lived client that flushes every event immediately", async () => {
    const analytics = createServerAnalytics({
      key: "phc_x",
      host: "https://us.i.posthog.com",
    });
    await analytics.track("user_signed_in", "user-1");

    expect(PostHog).toHaveBeenCalledWith("phc_x", {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "user_signed_in",
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("is a no-op without a key so local runs send nothing", async () => {
    const analytics = createServerAnalytics({
      key: undefined,
      host: undefined,
    });
    await analytics.track("user_signed_up", "user-1");

    expect(PostHog).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });
});
