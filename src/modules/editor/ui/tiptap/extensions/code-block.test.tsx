import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

    // H6-E4: a discreet button (not a native select) names the language.
    const picker = screen.getByTestId("code-block-language");
    expect(picker.tagName).toBe("BUTTON");
    expect(picker).toHaveAttribute("data-language", "typescript");
    expect(picker).toHaveTextContent("TypeScript");
    expect(picker).toHaveAccessibleName("Lenguaje: TypeScript");
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

    const user = userEvent.setup();
    await user.click(await screen.findByTestId("code-block-language"));
    const menu = await screen.findByRole("menu", { name: /^Lenguaje/ });
    expect(
      screen.getByRole("menuitemradio", { name: "JavaScript" }),
    ).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "Python" }));

    expect(menu).not.toBeInTheDocument();
    expect(screen.getByTestId("code-block-language")).toHaveAttribute(
      "data-language",
      "python",
    );
  });

  it("opens the language menu from the keyboard", async () => {
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

    const picker = await screen.findByTestId("code-block-language");
    act(() => picker.focus());
    const user = userEvent.setup();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("menu", { name: /^Lenguaje/ }),
    ).toBeInTheDocument();
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

    const picker = await screen.findByTestId("code-block-language");
    expect(picker).toHaveAttribute("data-language", "");
    expect(picker).toHaveTextContent("Texto sin formato");
    // No auto-detection: the picker says "Texto sin formato", so the code
    // must carry no syntax colours either.
    const codeBlock = screen.getByTestId("code-block");
    expect(codeBlock.querySelector('[class*="hljs-"]')).toBeNull();
  });
});
