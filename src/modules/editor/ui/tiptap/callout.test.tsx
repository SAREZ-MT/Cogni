import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeSavePagePort } from "../../application/testing/fake-save-page-port";
import type { TiptapDoc } from "../../domain/save-page-port";
import { Editor } from "./editor";

// specs/editor/spec.md, "Paleta de resaltado de Cogni y callouts", Scenario
// "Callout de advertencia": a "warning" callout MUST render with its design
// tokens and its Lucide icon. H7 (editor polish round 2): the kinds take the
// landing pillar band hues (idea yellow, note violet, warning rose) and show
// an italic label by kind that is not part of the stored content.
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
  it("renders a warning callout with the rose tokens, its Lucide icon and an italic label", async () => {
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
    // H7 follow-up (user reference callout-ref.png): a light tint, a 1px
    // border in the same hue, a rounded frame, the icon in the strong step
    // and the text in the kind's deep hue.
    expect(callout.className).toContain("bg-callout-warning");
    expect(callout.className).toContain("border-callout-warning-edge");
    expect(callout.className).toContain("rounded-(--radius-callout)");
    expect(callout.className).toContain("text-callout-warning-fg");
    expect(callout.className).not.toContain("text-fg ");
    expect(screen.getByTestId("callout-icon")).toHaveClass(
      "text-callout-warning-icon",
    );
    // The label sits inline at the start of the text row, floated ahead of
    // the editable content instead of on its own line.
    const label = screen.getByTestId("callout-label");
    expect(label).toHaveTextContent("Cuidado ·");
    expect(label).toHaveClass("italic");
    expect(label).toHaveClass("float-left");
    expect(label).toHaveAttribute("contenteditable", "false");
    expect(callout).toHaveTextContent("cuidado");
  });

  it("maps idea to yellow and note to violet, each with its label", async () => {
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
      "bg-callout-idea",
    );
    expect(screen.getByTestId("callout-label")).toHaveTextContent("Idea clave");
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
      "bg-callout-note",
    );
    expect(screen.getByTestId("callout-label")).toHaveTextContent("Nota");
  });

  it("keeps the label out of the stored content", async () => {
    const port = new FakeSavePagePort({
      content: docWithCallout("idea"),
      version: 1,
    });
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithCallout("idea")}
        initialVersion={1}
        port={port}
      />,
    );
    await screen.findByTestId("callout-label");
    const editable = screen
      .getByTestId("editor-content")
      .querySelector("[data-node-view-content]");
    expect(editable).not.toHaveTextContent("Idea clave");
  });

  // PR5a review advisory: an unrecognized `kind` MUST fall back to "idea"
  // explicitly, both when parsed from HTML and at render time, instead of
  // relying on an untested default.
  it("falls back to idea when the kind is unrecognized", async () => {
    const port = new FakeSavePagePort({
      content: docWithCallout("bogus" as never),
      version: 1,
    });
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithCallout("bogus" as never)}
        initialVersion={1}
        port={port}
      />,
    );

    const callout = await screen.findByTestId("callout");
    expect(callout).toHaveAttribute("data-kind", "idea");
    expect(callout.className).toContain("bg-callout-idea");
  });
});
