import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "0123456789abcdef0123456789abcdef";
const { run, createJob, serverEnv } = vi.hoisted(() => {
  const run = vi.fn();
  return {
    run,
    createJob: vi.fn(() => ({ run })),
    serverEnv: vi.fn((): { CRON_SECRET: string } => {
      throw new Error("set per test");
    }),
  };
});

vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/shared/config/env.server", () => ({ serverEnv }));
vi.mock("@/modules/study-engine", () => ({
  createMasteryRecomputeJob: createJob,
}));

import { GET, maxDuration } from "./route";

function request(authorization?: string) {
  return new Request("http://localhost/api/recompute-mastery", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/recompute-mastery", () => {
  beforeEach(() => {
    run.mockReset();
    createJob.mockClear();
    serverEnv.mockReset();
    serverEnv.mockImplementation(() => ({ CRON_SECRET: SECRET }));
  });

  it("answers 401 without a bearer and recomputes nothing", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("answers 401 for a wrong bearer and recomputes nothing", async () => {
    const response = await GET(request("Bearer wrong"));
    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("answers 401 when the bearer is a prefix of the secret", async () => {
    const response = await GET(request("Bearer 0123456789abcdef"));
    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    serverEnv.mockImplementation(() => {
      throw new Error("Invalid server environment: CRON_SECRET");
    });
    const response = await GET(request("Bearer "));
    expect(response.status).toBe(500);
    expect(run).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is empty", async () => {
    serverEnv.mockImplementation(() => ({ CRON_SECRET: "" }));
    const response = await GET(request("Bearer "));
    expect(response.status).toBe(500);
    expect(run).not.toHaveBeenCalled();
  });

  it("recomputes the pages with the right bearer and answers a summary", async () => {
    run.mockResolvedValueOnce({
      pagesRecomputed: 3,
      pagesFailed: 1,
      complete: false,
    });
    const response = await GET(request(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      pagesRecomputed: 3,
      pagesFailed: 1,
      complete: false,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("declares the Hobby plan's 300 s function limit as maxDuration", () => {
    expect(maxDuration).toBe(300);
  });

  it("gives the job a time budget that leaves a minute before maxDuration", async () => {
    run.mockResolvedValueOnce({
      pagesRecomputed: 0,
      pagesFailed: 0,
      complete: true,
    });
    await GET(request(`Bearer ${SECRET}`));
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({ timeBudgetMs: 240_000 }),
    );
  });

  it("logs a failed run and answers a controlled 500 without the error detail", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    run.mockRejectedValueOnce(new Error("listing query failed"));
    try {
      const response = await GET(request(`Bearer ${SECRET}`));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ ok: false });
      expect(errors).toHaveBeenCalledWith("[recompute-mastery] run failed", {
        error: "listing query failed",
      });
    } finally {
      errors.mockRestore();
    }
  });
});
