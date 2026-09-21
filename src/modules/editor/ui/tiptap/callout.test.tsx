import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeSavePagePort } from "../../application/testing/fake-save-page-port";
import type { TiptapDoc } from "../../domain/save-page-port";
import { Editor } from "./editor";

// specs/editor/spec.md, "Paleta de resaltado de Cogni y callouts", Scenario
// "Callout de advertencia": a "warning" callout MUST render with the
// orange design tokens and its Lucide icon.
function docWithCallout(kind: "idea" | "note" | "warning"): TiptapDoc {
  return {
    type: "doc",
    content: [
      {
        type: "callout",
        attrs: { kind },
        content: [
          { type: "paragraph", content: [{ type: "text", text: "cuidado" }] },
        ],
      },
    ],
  } as unknown as TiptapDoc;
}

describe("Callout node", () => {
  it("renders a warning callout with the orange tokens and its Lucide icon", async () => {
    const port = new FakeSavePagePort({
      content: docWithCallout("warning"),
      version: 1,
    });
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithCallout("warning")}
        initialVersion={1}
        port={port}
      />,
    );

    // The node view mounts through a separate React root
    // (@tiptap/react's ReactNodeViewRenderer), so it commits after this
    // render() call returns — findByTestId waits for that commit.
    const callout = await screen.findByTestId("callout");
    expect(callout).toHaveAttribute("data-kind", "warning");
    expect(callout.className).toContain("bg-pastel-orange");
    expect(callout.className).toContain("text-pastel-orange-fg");
    expect(screen.getByTestId("callout-icon")).toBeInTheDocument();
    expect(callout).toHaveTextContent("cuidado");
  });

  it("maps idea to yellow and note to blue", async () => {
    const ideaPort = new FakeSavePagePort({
      content: docWithCallout("idea"),
      version: 1,
    });
    const { unmount } = render(
      <Editor
        pageId="page-1"
        initialContent={docWithCallout("idea")}
        initialVersion={1}
        port={ideaPort}
      />,
    );
    expect((await screen.findByTestId("callout")).className).toContain(
      "bg-pastel-yellow",
    );
    unmount();

    const notePort = new FakeSavePagePort({
      content: docWithCallout("note"),
      version: 1,
    });
    render(
      <Editor
        pageId="page-2"
        initialContent={docWithCallout("note")}
        initialVersion={1}
        port={notePort}
      />,
    );
    expect((await screen.findByTestId("callout")).className).toContain(
      "bg-pastel-blue",
    );
  });
});
