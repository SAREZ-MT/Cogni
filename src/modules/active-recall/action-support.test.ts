import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { requireOwnerId } from "./action-support";
import { RECALL_ERROR } from "./domain/errors";

// The owner gate shared by this module's Server Actions: no session, a
// pending terms acceptance and an unverifiable profile are all refused.
const { requireOwner } = vi.hoisted(() => ({ requireOwner: vi.fn() }));
vi.mock("@/modules/identity", () => ({
  requireOwner,
  // Identity owns the real codes (domain/owner-access.test.ts); here only
  // the hand-off of the denial reason is under test.
  ownerAccessError: (reason: string) =>
    new DomainError(`IDENTITY_${reason.toUpperCase()}`, reason),
}));

const OWNER = "2f1b6f0e-6a55-4d0b-9d6c-0f6f1f1c2a01";

describe("requireOwnerId", () => {
  beforeEach(() => {
    requireOwner.mockReset();
  });

  it("returns the owner id when access is granted", async () => {
    requireOwner.mockResolvedValue({ status: "granted", ownerId: OWNER });

    expect(await requireOwnerId()).toEqual({ ok: true, value: OWNER });
  });

  it("refuses a request without a session with the module code", async () => {
    requireOwner.mockResolvedValue({
      status: "denied",
      reason: "session_required",
    });

    const result = await requireOwnerId();

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe(RECALL_ERROR.SESSION_REQUIRED);
  });

  it("refuses an account that has not accepted the current terms", async () => {
    requireOwner.mockResolvedValue({
      status: "denied",
      reason: "terms_required",
    });

    const result = await requireOwnerId();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("IDENTITY_TERMS_REQUIRED");
  });

  it("refuses when the profile could not be verified", async () => {
    requireOwner.mockResolvedValue({
      status: "denied",
      reason: "profile_unavailable",
    });

    const result = await requireOwnerId();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IDENTITY_PROFILE_UNAVAILABLE");
    }
  });
});
