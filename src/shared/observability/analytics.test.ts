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

const config = { key: "phc_x", host: "https://us.i.posthog.com" };

describe("createServerAnalytics", () => {
  beforeEach(() => {
    capture.mockReset();
    shutdown.mockReset().mockResolvedValue(undefined);
    PostHog.mockClear();
  });

  it("creates a short-lived client that flushes every event immediately", async () => {
    const { createServerAnalytics } = await import("./analytics");
    const analytics = createServerAnalytics(config);
    await analytics.track("user_signed_in", "user-1");

    expect(PostHog).toHaveBeenCalledWith(
      "phc_x",
      expect.objectContaining({
        host: "https://us.i.posthog.com",
        flushAt: 1,
        flushInterval: 0,
      }),
    );
    expect(capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "user_signed_in",
    });
    // Short shutdown: the SDK's default 30 s timer must never hold a request.
    expect(shutdown).toHaveBeenCalledWith(2000);
  });

  // Fase 2 (T7b): pdf_imported needs page_count/pages_without_text/
  // duration_ms/status alongside distinctId.
  it("forwards optional properties to PostHog's capture call", async () => {
    const { createServerAnalytics } = await import("./analytics");
    const analytics = createServerAnalytics(config);

    await analytics.track("pdf_imported", "user-1", {
      page_count: 12,
      pages_without_text: 0,
      duration_ms: 4200,
      status: "done",
    });

    expect(capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "pdf_imported",
      properties: {
        page_count: 12,
        pages_without_text: 0,
        duration_ms: 4200,
        status: "done",
      },
    });
  });

  it("omits the properties field entirely when none are given", async () => {
    const { createServerAnalytics } = await import("./analytics");
    const analytics = createServerAnalytics(config);

    await analytics.track("user_signed_in", "user-1");

    expect(capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "user_signed_in",
    });
  });

  it("is a no-op without a key so local runs send nothing", async () => {
    const { createServerAnalytics } = await import("./analytics");
    const analytics = createServerAnalytics({
      key: undefined,
      host: undefined,
    });
    await analytics.track("user_signed_up", "user-1");

    expect(PostHog).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it("never throws: an ingest failure degrades silently", async () => {
    const { createServerAnalytics } = await import("./analytics");
    shutdown.mockRejectedValueOnce(new Error("posthog down"));

    await expect(
      createServerAnalytics(config).track("user_signed_in", "user-1"),
    ).resolves.toBeUndefined();
  });

  it("never throws when capture itself fails", async () => {
    const { createServerAnalytics } = await import("./analytics");
    capture.mockImplementationOnce(() => {
      throw new Error("bad payload");
    });

    await expect(
      createServerAnalytics(config).track("user_signed_up", "user-1"),
    ).resolves.toBeUndefined();
  });
});
