import { describe, expect, it } from "vitest";
import type { ProviderEntry } from "../../domain";
import { quotaKeys } from "../upstash-quota-store";
import {
  DEFAULT_EXHAUST_PROVIDER,
  evaluateOutcome,
  formatSummary,
  parseArgs,
  planExhaustion,
  type SmokeRow,
} from "./lib";

const entries: ProviderEntry[] = [
  {
    id: "gemini-flash-lite",
    model: "gemini-2.5-flash-lite",
    capabilities: ["generate_flashcards"],
    rpm: 10,
    rpd: 20,
    priority: 1,
  },
  {
    id: "cloudflare-workers-ai",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    capabilities: ["generate_flashcards"],
    rpm: 30,
    rpd: 300,
    priority: 2,
  },
];

describe("parseArgs", () => {
  it("defaults to a live run exhausting the default provider", () => {
    expect(parseArgs([])).toEqual({
      ok: true,
      options: {
        mode: "run",
        exhaust: DEFAULT_EXHAUST_PROVIDER,
        dryRun: false,
      },
    });
  });

  it("reads --exhaust with a value", () => {
    const result = parseArgs(["--exhaust", "cloudflare-workers-ai"]);
    expect(result).toMatchObject({
      ok: true,
      options: { exhaust: "cloudflare-workers-ai" },
    });
  });

  it("reads --exhaust=value", () => {
    expect(parseArgs(["--exhaust=openrouter-qwen"])).toMatchObject({
      ok: true,
      options: { exhaust: "openrouter-qwen" },
    });
  });

  it("selects restore mode and the dry run flag", () => {
    expect(parseArgs(["--restore", "--dry-run"])).toMatchObject({
      ok: true,
      options: { mode: "restore", dryRun: true },
    });
  });

  it("rejects a missing --exhaust value", () => {
    expect(parseArgs(["--exhaust"]).ok).toBe(false);
  });

  it("rejects unknown arguments", () => {
    const result = parseArgs(["--nope"]);
    expect(result).toEqual({ ok: false, error: "Unknown argument: --nope" });
  });
});

describe("planExhaustion", () => {
  const now = new Date("2026-10-04T13:45:10.000Z");

  it("targets the day key of the provider with its rpd as value", () => {
    const plan = planExhaustion({
      prefix: "cogni:dev",
      providerId: "gemini-flash-lite",
      entries,
      now,
    });
    expect(plan).toEqual({
      ok: true,
      plan: {
        providerId: "gemini-flash-lite",
        dayKey: quotaKeys("cogni:dev", "gemini-flash-lite", now).day,
        backupKey: "cogni:dev:ai:smoke:backup:gemini-flash-lite",
        value: 20,
        ttlSeconds: 48 * 3600,
      },
    });
  });

  it("builds the day key exactly like the quota store", () => {
    const plan = planExhaustion({
      prefix: "cogni:dev",
      providerId: "gemini-flash-lite",
      entries,
      now,
    });
    expect(plan.ok && plan.plan.dayKey).toBe(
      "cogni:dev:ai:quota:gemini-flash-lite:2026-10-04",
    );
  });

  it("never produces a user rate limit key", () => {
    const plan = planExhaustion({
      prefix: "cogni:dev",
      providerId: "gemini-flash-lite",
      entries,
      now,
    });
    expect(plan.ok && plan.plan.dayKey).not.toContain(":ai:gen");
    expect(plan.ok && plan.plan.backupKey).not.toContain(":ai:gen");
  });

  it("rejects a provider that is not in the registry", () => {
    const plan = planExhaustion({
      prefix: "cogni:dev",
      providerId: "nope",
      entries,
      now,
    });
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.error).toContain("gemini-flash-lite");
  });
});

describe("evaluateOutcome", () => {
  const ok = (provider: string): SmokeRow => ({
    step: "x",
    provider,
    model: "m",
    status: "done",
    tokens: 10,
    latencyMs: 5,
  });

  it("passes when another provider served after exhaustion", () => {
    expect(evaluateOutcome("a", ok("a"), ok("b"))).toEqual({ pass: true });
  });

  it("fails when the exhausted provider still served", () => {
    const outcome = evaluateOutcome("a", ok("a"), ok("a"));
    expect(outcome.pass).toBe(false);
  });

  it("fails when a step did not complete", () => {
    const failed: SmokeRow = { ...ok("b"), status: "failed" };
    expect(evaluateOutcome("a", ok("a"), failed).pass).toBe(false);
    expect(evaluateOutcome("a", failed, ok("b")).pass).toBe(false);
  });
});

describe("formatSummary", () => {
  it("prints one aligned line per step with a header", () => {
    const text = formatSummary([
      {
        step: "1 baseline",
        provider: "gemini-flash-lite",
        model: "gemini-2.5-flash-lite",
        status: "done",
        tokens: 321,
        latencyMs: 1234,
      },
      {
        step: "2 exhausted",
        provider: "cloudflare-workers-ai",
        model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        status: "done",
        tokens: 300,
        latencyMs: 900,
      },
    ]);
    const lines = text.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("provider");
    expect(lines[2]).toContain("gemini-flash-lite");
    expect(lines[2]).toContain("1234 ms");
  });
});
