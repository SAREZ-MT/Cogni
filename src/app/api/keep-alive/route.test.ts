import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/shared/db/client", () => ({ getDb: () => ({ execute }) }));
vi.mock("@/shared/config/env.server", () => ({
  serverEnv: () => ({ CRON_SECRET: "0123456789abcdef0123456789abcdef" }),
}));

import { GET } from "./route";

function request(authorization?: string) {
  return new Request("http://localhost/api/keep-alive", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/keep-alive", () => {
  beforeEach(() => execute.mockReset());

  it("answers 401 without a bearer and runs no query", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it("answers 401 for a wrong bearer and runs no query", async () => {
    const response = await GET(request("Bearer wrong"));
    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it("answers 401 when the bearer is a prefix of the secret", async () => {
    const response = await GET(request("Bearer 0123456789abcdef"));
    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it("answers 200 and runs select 1 with the right bearer", async () => {
    execute.mockResolvedValueOnce([]);
    const response = await GET(
      request("Bearer 0123456789abcdef0123456789abcdef"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
