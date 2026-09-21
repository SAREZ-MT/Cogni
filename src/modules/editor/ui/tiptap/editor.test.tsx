import { render, screen, waitFor } from "@testing-library/react";
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
});
