import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const deletion = vi.hoisted(() => ({ preview: vi.fn(), delete: vi.fn() }));
vi.mock("./infrastructure", () => ({
  DrizzleExamSetDeletion: vi.fn(function DrizzleExamSetDeletion() {
    return deletion;
  }),
}));

import {
  deleteExamSetAction,
  previewExamSetDeletionAction,
} from "./deletion-actions";

const OWNER = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";

// Phase 8 H19 (V10 coverage): the exams hub card's delete actions.
describe("exams set deletion actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset().mockResolvedValue({ id: OWNER });
    revalidatePath.mockReset();
    deletion.preview.mockReset();
    deletion.delete.mockReset();
  });

  it("previews what goes for the caller's page", async () => {
    deletion.preview.mockResolvedValue({ questions: 12, attempts: 2 });

    expect(await previewExamSetDeletionAction({ pageId: PAGE })).toEqual({
      ok: true,
      value: { questions: 12, attempts: 2 },
    });
    expect(deletion.preview).toHaveBeenCalledWith(PAGE, OWNER);
  });

  it("deletes the set and revalidates the whole app layout", async () => {
    deletion.delete.mockResolvedValue(true);

    expect(await deleteExamSetAction({ pageId: PAGE })).toEqual({
      ok: true,
      value: { pageId: PAGE },
    });
    expect(deletion.delete).toHaveBeenCalledWith(PAGE, OWNER, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("answers EXAMS_SET_NOT_FOUND for another owner's or an unknown page, revalidating nothing", async () => {
    deletion.preview.mockResolvedValue(null);
    deletion.delete.mockResolvedValue(false);

    const previewed = await previewExamSetDeletionAction({ pageId: PAGE });
    const deleted = await deleteExamSetAction({ pageId: PAGE });

    expect(!previewed.ok && previewed.error.code).toBe("EXAMS_SET_NOT_FOUND");
    expect(!deleted.ok && deleted.error.code).toBe("EXAMS_SET_NOT_FOUND");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses without a session or with a malformed page id, touching nothing", async () => {
    const malformed = await deleteExamSetAction({ pageId: "x" });
    getCurrentUser.mockResolvedValue(null);
    const anonymous = await deleteExamSetAction({ pageId: PAGE });

    expect(!malformed.ok && malformed.error.code).toBe("EXAMS_INVALID_INPUT");
    expect(!anonymous.ok && anonymous.error.code).toBe(
      "EXAMS_SESSION_REQUIRED",
    );
    expect(deletion.delete).not.toHaveBeenCalled();
  });
});
