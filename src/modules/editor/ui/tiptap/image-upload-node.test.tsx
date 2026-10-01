import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ImageUploadNode,
  type ImageUploadNodeProps,
} from "./image-upload-node";

function renderNode(overrides: Partial<ImageUploadNodeProps> = {}) {
  const onPickFile = vi.fn();
  const fileInputRef = createRef<HTMLInputElement>();
  render(
    <ImageUploadNode
      uploading={false}
      error={null}
      uploadingLabel="subiendo imagen…"
      helperText="PNG, JPG · hasta 10 MB"
      acceptedMime={["image/png", "image/jpeg"]}
      fileInputRef={fileInputRef}
      onPickFile={onPickFile}
      {...overrides}
    />,
  );
  return { onPickFile, fileInputRef };
}

function imageFile(name = "a.png", type = "image/png") {
  return new File([new Uint8Array(8)], name, { type });
}

describe("ImageUploadNode", () => {
  it("idle: shows the prompt, the helper text and a hidden input limited to the accepted mime types", () => {
    renderNode();

    expect(
      screen.getByRole("button", {
        name: "Arrastra una imagen o haz clic para subirla",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("PNG, JPG · hasta 10 MB")).toBeInTheDocument();
    expect(screen.getByTestId("image-node-input")).toHaveAttribute(
      "accept",
      "image/png,image/jpeg",
    );
    expect(screen.queryByTestId("image-node-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upload-progress")).not.toBeInTheDocument();
  });

  it("uploading: shows the progress label instead of the picker", () => {
    renderNode({ uploading: true });

    expect(screen.getByTestId("upload-progress")).toHaveTextContent(
      "subiendo imagen…",
    );
    expect(screen.queryByTestId("image-node-picker")).not.toBeInTheDocument();
  });

  it("error: shows the message with a Reintentar button that opens the file picker", () => {
    const { fileInputRef } = renderNode({
      error: "No pudimos subir la imagen.",
    });
    const click = vi.spyOn(fileInputRef.current as HTMLInputElement, "click");

    expect(screen.getByTestId("image-node-error")).toHaveTextContent(
      "No pudimos subir la imagen.",
    );
    expect(screen.getByText("No se pudo subir la imagen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("opens the file picker when the prompt button is clicked", () => {
    const { fileInputRef } = renderNode();
    const click = vi.spyOn(fileInputRef.current as HTMLInputElement, "click");

    fireEvent.click(screen.getByTestId("image-node-picker"));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("opens the file picker when the card itself is clicked, but not while uploading", () => {
    const idle = renderNode();
    const idleClick = vi.spyOn(
      idle.fileInputRef.current as HTMLInputElement,
      "click",
    );
    fireEvent.click(screen.getByTestId("image-node-placeholder"));
    expect(idleClick).toHaveBeenCalledTimes(1);
  });

  it("does not open the picker from a card click while uploading", () => {
    const { fileInputRef } = renderNode({ uploading: true });
    const click = vi.spyOn(fileInputRef.current as HTMLInputElement, "click");

    fireEvent.click(screen.getByTestId("image-node-placeholder"));

    expect(click).not.toHaveBeenCalled();
  });

  it("reports the chosen file and resets the input so the same file can be picked again", () => {
    const { onPickFile } = renderNode();
    const input = screen.getByTestId("image-node-input") as HTMLInputElement;
    const file = imageFile();

    fireEvent.change(input, { target: { files: [file] } });

    expect(onPickFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
  });

  it("clears the input value after a pick, so choosing the same file again fires change", () => {
    renderNode();
    const input = screen.getByTestId("image-node-input") as HTMLInputElement;
    const assigned: string[] = [];
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => "",
      set: (value: string) => {
        assigned.push(value);
      },
    });

    fireEvent.change(input, { target: { files: [imageFile()] } });

    expect(assigned).toEqual([""]);
  });

  it("uses the error card tone only when there is an error", () => {
    const { unmount } = render(
      <ImageUploadNode
        uploading={false}
        error={null}
        uploadingLabel="x"
        helperText="x"
        acceptedMime={["image/png"]}
        fileInputRef={createRef<HTMLInputElement>()}
        onPickFile={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("image-node-placeholder").className,
    ).not.toContain("bg-error-50");
    unmount();

    renderNode({ error: "boom" });
    expect(screen.getByTestId("image-node-placeholder").className).toContain(
      "bg-error-50",
    );
  });

  it("ignores a change event without a file", () => {
    const { onPickFile } = renderNode();

    fireEvent.change(screen.getByTestId("image-node-input"), {
      target: { files: [] },
    });

    expect(onPickFile).not.toHaveBeenCalled();
  });

  it("uploads the first image dropped on the card", () => {
    const { onPickFile } = renderNode();
    const file = imageFile("b.jpg", "image/jpeg");

    fireEvent.drop(screen.getByTestId("image-node-placeholder"), {
      dataTransfer: {
        files: [new File(["x"], "n.txt", { type: "text/plain" }), file],
      },
    });

    expect(onPickFile).toHaveBeenCalledWith(file);
  });

  it("ignores a drop without any image, or while an upload is running", () => {
    const idle = renderNode();
    fireEvent.drop(screen.getByTestId("image-node-placeholder"), {
      dataTransfer: {
        files: [new File(["x"], "n.txt", { type: "text/plain" })],
      },
    });
    expect(idle.onPickFile).not.toHaveBeenCalled();
  });

  it("ignores a drop while an upload is running", () => {
    const { onPickFile } = renderNode({ uploading: true });

    fireEvent.drop(screen.getByTestId("image-node-placeholder"), {
      dataTransfer: { files: [imageFile()] },
    });

    expect(onPickFile).not.toHaveBeenCalled();
  });

  it("stops a drop from bubbling to the document-level drop handler", () => {
    const outer = vi.fn();
    const { onPickFile } = renderNode();
    document.addEventListener("drop", outer);
    try {
      fireEvent.drop(screen.getByTestId("image-node-placeholder"), {
        dataTransfer: { files: [imageFile()] },
      });
      expect(onPickFile).toHaveBeenCalledTimes(1);
      expect(outer).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("drop", outer);
    }
  });
});
