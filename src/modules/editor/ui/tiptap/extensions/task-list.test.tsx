import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./index";

// specs/editor/spec.md, "Conjunto completo de bloques de §3.2", Scenario
// "Casilla de tarea persistida": a checked task item must keep its checked
// state in the serialized JSON.
describe("task list extension", () => {
  it("persists the checked state of a task item in the JSON document", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>comprar leche</p>",
    });

    editor.commands.selectAll();
    editor.commands.toggleList("taskList", "taskItem");

    // Locate the taskItem node and mark it as checked directly through a
    // transaction, mirroring what the UI checkbox click does internally.
    let taskItemPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "taskItem" && taskItemPos === -1) {
        taskItemPos = pos;
      }
    });
    expect(taskItemPos).toBeGreaterThanOrEqual(0);

    editor.view.dispatch(
      editor.state.tr.setNodeAttribute(taskItemPos, "checked", true),
    );

    const json = editor.getJSON();
    const taskItemJson = json.content?.find((node) => node.type === "taskList")
      ?.content?.[0] as
      | { type: string; attrs?: Record<string, unknown> }
      | undefined;

    expect(taskItemJson?.type).toBe("taskItem");
    expect(taskItemJson?.attrs?.checked).toBe(true);

    editor.destroy();
  });
});
