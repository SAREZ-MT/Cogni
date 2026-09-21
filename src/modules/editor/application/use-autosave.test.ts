import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TiptapDoc } from "../domain/save-page-port";
import { FakeSavePagePort } from "./testing/fake-save-page-port";
import { useAutosave } from "./use-autosave";

const PAGE_ID = "1e2d3c4b-5a69-4788-9f01-2a3b4c5d6e7f";

function doc(text: string): TiptapDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Scenario "Guardado tras pausa" (specs/editor/spec.md)
  it("saves exactly once, with the final content, after the user stops typing", async () => {
    const port = new FakeSavePagePort({ content: doc("v1"), version: 1 });
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("v1"),
        initialVersion: 1,
        port,
      }),
    );

    act(() => result.current.setContent(doc("v2")));
    act(() => result.current.setContent(doc("v3")));
    act(() => result.current.setContent(doc("final")));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(port.saveCalls).toHaveLength(1);
    expect(port.saveCalls[0]).toMatchObject({
      pageId: PAGE_ID,
      content: doc("final"),
      expectedVersion: 1,
    });
    expect(result.current.status).toBe("saved");
  });

  // Scenario "Escritura durante el guardado" (specs/editor/spec.md)
  it("triggers a second save with the latest content once an in-flight save finishes", async () => {
    const port = new FakeSavePagePort({ content: doc("v1"), version: 1 });
    port.holdNextSaves(true);
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("v1"),
        initialVersion: 1,
        port,
      }),
    );

    act(() => result.current.setContent(doc("mid-save")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(port.saveCalls).toHaveLength(1);
    expect(result.current.status).toBe("saving");

    // The user keeps typing while the first save is still in flight.
    act(() => result.current.setContent(doc("latest")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    // Still only one network call: the second save is queued, not fired,
    // while the first one has not resolved yet.
    expect(port.saveCalls).toHaveLength(1);

    port.holdNextSaves(false);
    await act(async () => {
      port.resolveNextSave({ ok: true, value: { version: 2 } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(port.saveCalls).toHaveLength(2);
    expect(port.saveCalls[1]).toMatchObject({
      content: doc("latest"),
      expectedVersion: 2,
    });
  });

  // Scenario "Fallo de red" (specs/editor/spec.md): the port may reject
  // instead of resolving to a Result when the transport itself fails.
  it("recovers from a rejected save: error state, content kept, next pause retries", async () => {
    const inner = new FakeSavePagePort({ content: doc("v1"), version: 1 });
    let rejectNext = true;
    const port: typeof inner = Object.create(inner);
    port.save = async (input) => {
      if (rejectNext) {
        rejectNext = false;
        throw new Error("transport down");
      }
      return inner.save(input);
    };
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("v1"),
        initialVersion: 1,
        port,
      }),
    );

    act(() => result.current.setContent(doc("offline edit")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.content).toEqual(doc("offline edit"));

    act(() => result.current.setContent(doc("back online")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(inner.saveCalls).toHaveLength(1);
    expect(inner.saveCalls[0]).toMatchObject({ content: doc("back online") });
    expect(result.current.status).toBe("saved");
  });

  // Scenario "Fallo de red" (specs/editor/spec.md)
  it("shows an error state, keeps the content and retries only on the next pause", async () => {
    const port = new FakeSavePagePort({ content: doc("v1"), version: 1 });
    port.scriptNextSave({
      ok: false,
      error: new (await import("@/shared/kernel/domain-error")).DomainError(
        "SAVE_FAILED",
        "network error",
      ),
    });
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("v1"),
        initialVersion: 1,
        port,
      }),
    );

    act(() => result.current.setContent(doc("offline edit")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.content).toEqual(doc("offline edit"));
    expect(port.saveCalls).toHaveLength(1);

    // Retries on the next pause, not automatically.
    act(() => result.current.setContent(doc("offline edit, retried")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(port.saveCalls).toHaveLength(2);
    expect(result.current.status).toBe("saved");
  });

  // Scenarios "Conflicto detectado" y "Guardado tras reconciliar"
  // (specs/editor/spec.md)
  it("reconciles a version conflict by loading the server content and using the current version on the next save", async () => {
    const port = new FakeSavePagePort({
      content: doc("server v4"),
      version: 4,
    });
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("local v3"),
        initialVersion: 3,
        port,
      }),
    );

    act(() => result.current.setContent(doc("local edit while stale")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe("conflict");
    expect(result.current.content).toEqual(doc("server v4"));
    expect(result.current.conflictDraft).toEqual(doc("local edit while stale"));

    act(() => result.current.setContent(doc("edit after reconciling")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(port.saveCalls[1]).toMatchObject({
      content: doc("edit after reconciling"),
      expectedVersion: 4,
    });
    expect(result.current.status).toBe("saved");
  });

  // Root cause of the two-tab conflict e2e bug: a real Server Action's
  // error crosses the RSC/Flight boundary as a plain object (React redacts
  // Error subclasses in transit), never as a DomainError instance. This
  // scripts exactly that shape — no DomainError, no instanceof possible —
  // to prove the hook detects PAGE_VERSION_CONFLICT by the error's shape
  // (isDomainErrorLike), not by `instanceof DomainError`.
  it("reconciles a version conflict reported as a plain { code } object, not a DomainError instance", async () => {
    const port = new FakeSavePagePort({
      content: doc("server v4"),
      version: 4,
    });
    port.scriptNextSave({
      ok: false,
      error: { code: "PAGE_VERSION_CONFLICT", message: "current version is 4" },
    });
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("local v3"),
        initialVersion: 3,
        port,
      }),
    );

    act(() => result.current.setContent(doc("local edit while stale")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe("conflict");
    expect(result.current.content).toEqual(doc("server v4"));
    expect(result.current.conflictDraft).toEqual(doc("local edit while stale"));
  });

  // PR3b review advisory: flush() must be a no-op when there is nothing
  // pending and no save in flight, so Mod+S never fires a duplicate save.
  it("flush() does nothing when there is no pending change and no save in flight", async () => {
    const port = new FakeSavePagePort({ content: doc("v1"), version: 1 });
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("v1"),
        initialVersion: 1,
        port,
      }),
    );

    act(() => result.current.flush());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(port.saveCalls).toHaveLength(0);
    expect(result.current.status).toBe("idle");
  });

  // PR3b review advisory: a failing/rejecting getCurrent() during conflict
  // reconciliation must not leave the hook in a stale "conflict" state with
  // no way forward — it must end in "error" and retry on the next pause.
  it("ends in error, dirty, when getCurrent() fails while reconciling a conflict", async () => {
    const port = new FakeSavePagePort({
      content: doc("server v4"),
      version: 4,
    });
    const workingGetCurrent = port.getCurrent.bind(port);
    let failNext = true;
    port.getCurrent = async (pageId: string) => {
      if (failNext) {
        failNext = false;
        throw new Error("getCurrent transport down");
      }
      return workingGetCurrent(pageId);
    };
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("local v3"),
        initialVersion: 3,
        port,
      }),
    );

    act(() => result.current.setContent(doc("local edit while stale")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe("error");
    // The local content is preserved — getCurrent() failing must not
    // silently discard what the user typed.
    expect(result.current.content).toEqual(doc("local edit while stale"));

    // Retries only on the next pause, same contract as a plain save
    // failure. versionRef is still stale (3), so the retry hits the same
    // conflict path, this time with a working getCurrent().
    act(() => result.current.setContent(doc("edit after error")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe("conflict");
    expect(result.current.content).toEqual(doc("server v4"));
  });

  // Same advisory, but getCurrent() resolves to a Result error instead of
  // rejecting — must not leave the hook claiming "conflict" without having
  // reconciled any content.
  it("ends in error when getCurrent() resolves to a Result error while reconciling", async () => {
    const port = new FakeSavePagePort({
      content: doc("server v4"),
      version: 4,
    });
    port.getCurrent = async () => ({
      ok: false,
      error: new (await import("@/shared/kernel/domain-error")).DomainError(
        "PAGE_NOT_FOUND",
        "gone",
      ),
    });
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("local v3"),
        initialVersion: 3,
        port,
      }),
    );

    act(() => result.current.setContent(doc("local edit while stale")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.content).toEqual(doc("local edit while stale"));
  });

  // PR3b review advisory (editor.tsx): the Tiptap document must only be
  // resynced from the hook's `content` on an actual server-driven
  // reconciliation (conflict), never as a side effect of the user's own
  // typing. `reconcileVersion` is the single source of truth editor.tsx
  // watches for that, instead of diffing `content` on every keystroke.
  it("only bumps reconcileVersion on a real conflict reconciliation, not on ordinary content updates", async () => {
    const port = new FakeSavePagePort({ content: doc("v1"), version: 1 });
    const { result } = renderHook(() =>
      useAutosave({
        pageId: PAGE_ID,
        initialContent: doc("v1"),
        initialVersion: 1,
        port,
      }),
    );

    const initialReconcileVersion = result.current.reconcileVersion;

    act(() => result.current.setContent(doc("typed by the user")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe("saved");
    expect(result.current.reconcileVersion).toBe(initialReconcileVersion);

    port.setServerState({ content: doc("server v9"), version: 9 });
    act(() => result.current.setContent(doc("stale edit")));
    // Force a conflict on this save by making the port's version diverge
    // from what the hook believes: the FakeSavePagePort compares
    // expectedVersion, and the hook's versionRef is still 2 (after the
    // previous successful save), while the port is now at 9.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe("conflict");
    expect(result.current.reconcileVersion).toBeGreaterThan(
      initialReconcileVersion,
    );
  });
});
