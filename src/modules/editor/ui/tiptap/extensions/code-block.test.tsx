import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeSavePagePort } from "../../../application/testing/fake-save-page-port";
import type { TiptapDoc } from "../../../domain/save-page-port";
import { Editor } from "../editor";

// specs/editor/spec.md, "Conjunto completo de bloques de §3.2", Scenario
// "Bloque de código con lenguaje": a `codeBlock` with `language:
// "typescript"` MUST render with syntax highlighting and the language
// attribute MUST persist (round-trip through the JSON document).
function docWithCodeBlock(language: string | null): TiptapDoc {
  return {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { language },
        content: [{ type: "text", text: "const x: number = 1;" }],
      },
    ],
  } as unknown as TiptapDoc;
}

describe("code block", () => {
  it("renders highlighted tokens for a typescript code block and persists the language attribute", async () => {
    const port = new FakeSavePagePort({
      content: docWithCodeBlock("typescript"),
      version: 1,
    });
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithCodeBlock("typescript")}
        initialVersion={1}
        port={port}
      />,
    );

    const codeBlock = await screen.findByTestId("code-block");
    expect(codeBlock.querySelector(".hljs-keyword")).not.toBeNull();

    const select = screen.getByTestId(
      "code-block-language",
    ) as HTMLSelectElement;
    expect(select.value).toBe("typescript");
  });

  it("updates the persisted language attribute when the selector changes", async () => {
    const port = new FakeSavePagePort({
      content: docWithCodeBlock("javascript"),
      version: 1,
    });
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithCodeBlock("javascript")}
        initialVersion={1}
        port={port}
      />,
    );

    const select = (await screen.findByTestId(
      "code-block-language",
    )) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: "python" } });
    });

    expect(
      (screen.getByTestId("code-block-language") as HTMLSelectElement).value,
    ).toBe("python");
  });

  it("renders a code block without a language as plain text", async () => {
    const port = new FakeSavePagePort({
      content: docWithCodeBlock(null),
      version: 1,
    });
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithCodeBlock(null)}
        initialVersion={1}
        port={port}
      />,
    );

    const select = (await screen.findByTestId(
      "code-block-language",
    )) as HTMLSelectElement;
    expect(select.value).toBe("");
    // No auto-detection: the picker says "Texto sin formato", so the code
    // must carry no syntax colours either.
    const codeBlock = screen.getByTestId("code-block");
    expect(codeBlock.querySelector('[class*="hljs-"]')).toBeNull();
  });
});
