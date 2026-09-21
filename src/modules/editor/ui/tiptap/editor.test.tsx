import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FakeSavePagePort } from "../../application/testing/fake-save-page-port";
import type { TiptapDoc } from "../../domain/save-page-port";
import { Editor } from "./editor";

function emptyDoc(): TiptapDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

describe("Editor", () => {
  it("triggers a save through the port after typing and pausing, reflecting the status", async () => {
    const user = userEvent.setup();
    const port = new FakeSavePagePort({ content: emptyDoc(), version: 1 });

    render(
      <Editor
        pageId="page-1"
        initialContent={emptyDoc()}
        initialVersion={1}
        port={port}
      />,
    );

    const editable = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    expect(editable).toBeTruthy();

    await user.click(editable);
    await user.type(editable, "hola cogni");

    await waitFor(
      () => {
        expect(port.saveCalls.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    await waitFor(() => {
      expect(screen.getByTestId("autosave-status")).toHaveTextContent(
        "guardado",
      );
    });
  });

  // PR3b review advisory: the Tiptap document must not be reset from
  // useAutosave's reconciled content as a side effect of ordinary typing
  // (a "setContent echo"), which would reset the user's cursor mid-word.
  // editor.tsx now resyncs only on the hook's `reconcileVersion` (bumped
  // solely by a real conflict reconciliation), so continuous typing must
  // land in order with no interruption.
  it("keeps typed characters in order without a mid-typing cursor reset", async () => {
    const user = userEvent.setup();
    const port = new FakeSavePagePort({ content: emptyDoc(), version: 1 });

    render(
      <Editor
        pageId="page-1"
        initialContent={emptyDoc()}
        initialVersion={1}
        port={port}
      />,
    );

    const editable = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    await user.click(editable);
    await user.type(editable, "cogni ayuda a estudiar");

    expect(editable).toHaveTextContent("cogni ayuda a estudiar");
  });

  it("shows the conflict copy in Spanish when the port reports a version conflict", async () => {
    const user = userEvent.setup();
    const port = new FakeSavePagePort({ content: emptyDoc(), version: 5 });

    render(
      <Editor
        pageId="page-1"
        initialContent={emptyDoc()}
        // Stale version: any save from this instance reports a conflict.
        initialVersion={1}
        port={port}
      />,
    );

    const editable = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    await user.click(editable);
    await user.type(editable, "x");

    await waitFor(
      () => {
        expect(screen.getByTestId("autosave-status")).toHaveTextContent(
          "la página cambió en otra pestaña",
        );
      },
      { timeout: 3000 },
    );
  });

  // specs/editor/spec.md, "Reconciliación del conflicto de versión",
  // Scenario "Conflicto detectado" at the component level (design.md,
  // task 4.3): the banner appears, the Tiptap document is replaced by the
  // server's, and the local draft stays recoverable.
  it("shows the conflict banner and recovers the local draft on demand", async () => {
    const user = userEvent.setup();
    const port = new FakeSavePagePort({ content: emptyDoc(), version: 5 });

    render(
      <Editor
        pageId="page-1"
        initialContent={emptyDoc()}
        initialVersion={1}
        port={port}
      />,
    );

    const editable = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    await user.click(editable);
    await user.type(editable, "mi borrador local");

    const banner = await screen.findByTestId(
      "conflict-banner",
      {},
      { timeout: 3000 },
    );
    expect(banner).toHaveTextContent("esta página cambió en otra pestaña");
    // The server's (empty) document replaced the local draft in the
    // editor itself.
    expect(editable).toHaveTextContent("");

    await user.click(
      screen.getByRole("button", { name: "recuperar mi borrador" }),
    );

    expect(editable).toHaveTextContent("mi borrador local");
    expect(screen.queryByTestId("conflict-banner")).not.toBeInTheDocument();
  });

  // specs/editor/spec.md, "Autosave con debounce y actualización
  // optimista": "Al salir de la página con cambios pendientes el editor
  // MUST intentar guardarlos" — before the debounce would otherwise fire.
  it("flushes a pending save when the tab becomes hidden", async () => {
    const user = userEvent.setup();
    const port = new FakeSavePagePort({ content: emptyDoc(), version: 1 });

    render(
      <Editor
        pageId="page-1"
        initialContent={emptyDoc()}
        initialVersion={1}
        port={port}
      />,
    );

    const editable = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    await user.click(editable);
    await user.type(editable, "sin terminar de escribir");

    // The debounce (800-1500ms) has not elapsed yet: without a save-on-
    // leave trigger, this content would be lost on navigation.
    expect(port.saveCalls).toHaveLength(0);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));

    await waitFor(
      () => {
        expect(port.saveCalls.length).toBeGreaterThan(0);
      },
      { timeout: 200 },
    );
  });

  it("flushes a pending save on beforeunload without blocking it", async () => {
    const user = userEvent.setup();
    const port = new FakeSavePagePort({ content: emptyDoc(), version: 1 });

    render(
      <Editor
        pageId="page-1"
        initialContent={emptyDoc()}
        initialVersion={1}
        port={port}
      />,
    );

    const editable = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    await user.click(editable);
    await user.type(editable, "otro cambio sin guardar");

    const event = new Event("beforeunload", { cancelable: true });
    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(false);
    await waitFor(
      () => {
        expect(port.saveCalls.length).toBeGreaterThan(0);
      },
      { timeout: 200 },
    );
  });

  it("flushes a pending save on unmount", async () => {
    const user = userEvent.setup();
    const port = new FakeSavePagePort({ content: emptyDoc(), version: 1 });

    const { unmount } = render(
      <Editor
        pageId="page-1"
        initialContent={emptyDoc()}
        initialVersion={1}
        port={port}
      />,
    );

    const editable = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    await user.click(editable);
    await user.type(editable, "cambio al desmontar");

    unmount();

    await waitFor(
      () => {
        expect(port.saveCalls.length).toBeGreaterThan(0);
      },
      { timeout: 200 },
    );
  });
});
