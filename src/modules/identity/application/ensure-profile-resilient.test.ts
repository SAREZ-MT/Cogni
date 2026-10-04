import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import type { Profile } from "../domain/profile";
import type { ProfileRepository } from "../domain/profile-repository";
import { ensureProfileResilient } from "./ensure-profile-resilient";
import { InMemoryProfileRepository } from "./testing/in-memory-profile-repository";

const NOW = new Date("2026-09-22T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

// Fails findById the given number of times before delegating to a real
// in-memory repository, simulating a transient repository failure
// (specs/identity-auth/spec.md, "Tabla `profiles` con creación
// automática": EnsureProfile must tolerate and recover from one).
class FlakyProfileRepository implements ProfileRepository {
  constructor(
    private readonly inner: ProfileRepository,
    private failuresLeft: number,
  ) {}

  async findById(id: string): Promise<Profile | null> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error("transient repository failure");
    }
    return this.inner.findById(id);
  }

  async upsert(profile: Profile): Promise<void> {
    return this.inner.upsert(profile);
  }

  async acceptTerms(
    id: string,
    version: string,
    at: Date,
  ): Promise<Profile | null> {
    return this.inner.acceptTerms(id, version, at);
  }
}

describe("ensureProfileResilient", () => {
  it("retries once after a transient failure and still creates the profile", async () => {
    const inner = new InMemoryProfileRepository();
    const profiles = new FlakyProfileRepository(inner, 1);
    const onTransientFailure = vi.fn();

    const profile = await ensureProfileResilient(
      { ownerId: OWNER_ID },
      {
        profiles,
        clock: createFixedClock(NOW),
        onTransientFailure,
        retryDelayMs: 1,
      },
    );

    expect(profile).toMatchObject({ id: OWNER_ID });
    expect(await inner.findById(OWNER_ID)).toMatchObject({ id: OWNER_ID });
    expect(onTransientFailure).not.toHaveBeenCalled();
  });

  it("degrades to null without throwing and reports the error when both attempts fail", async () => {
    const inner = new InMemoryProfileRepository();
    const profiles = new FlakyProfileRepository(inner, 2);
    const onTransientFailure = vi.fn();

    await expect(
      ensureProfileResilient(
        { ownerId: OWNER_ID },
        {
          profiles,
          clock: createFixedClock(NOW),
          onTransientFailure,
          retryDelayMs: 1,
        },
      ),
    ).resolves.toBeNull();

    expect(await inner.findById(OWNER_ID)).toBeNull();
    expect(onTransientFailure).toHaveBeenCalledTimes(1);
  });
});
