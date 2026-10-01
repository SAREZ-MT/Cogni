import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FakeImageUploadPort,
  failingImageUploadPort,
} from "../../application/testing/fake-image-upload-port";
import { FakeSavePagePort } from "../../application/testing/fake-save-page-port";
import type { ImageUploadPort } from "../../domain/image-upload-port";
import type { TiptapDoc } from "../../domain/save-page-port";
import { Editor } from "./editor";

// image-node.tsx uploads bytes directly to Storage from the browser
// (design.md, "Subida directa desde el navegador"); this is mocked so the
// component test never needs a real Supabase project or env vars.
vi.mock("./upload-to-signed-url", () => ({
  uploadToSignedUrl: vi.fn(async () => ({ error: null })),
}));

function docWithImagePlaceholder(): TiptapDoc {
  return {
    type: "doc",
    content: [{ type: "image", attrs: { assetId: null } }],
  } as unknown as TiptapDoc;
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

// specs/page-assets/spec.md, "Permiso de subida firmado" (Scenario:
// "Archivo demasiado grande") and "URLs de lectura firmadas de corta
// duración" (Scenario: "Nodo sin URL firmada").
describe("Image node", () => {
  it("shows the size-limit message and never requests an upload grant for a 12 MB file (Scenario: Archivo demasiado grande)", async () => {
    const port = new FakeSavePagePort({
      content: docWithImagePlaceholder(),
      version: 1,
    });
    const imagePort = new FakeImageUploadPort();
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithImagePlaceholder()}
        initialVersion={1}
        port={port}
        imagePort={imagePort}
      />,
    );

    const input = await screen.findByTestId("image-node-input");
    const bigFile = makeFile("photo.png", "image/png", 12 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [bigFile] } });

    const error = await screen.findByTestId("image-node-error");
    expect(error).toHaveTextContent(/tamaño máximo/i);
    expect(imagePort.requestUploadCalls).toHaveLength(0);
  });

  it("rejects a disallowed mime type client-side without requesting a grant", async () => {
    const port = new FakeSavePagePort({
      content: docWithImagePlaceholder(),
      version: 1,
    });
    const imagePort = new FakeImageUploadPort();
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithImagePlaceholder()}
        initialVersion={1}
        port={port}
        imagePort={imagePort}
      />,
    );

    const input = await screen.findByTestId("image-node-input");
    const svg = makeFile("icon.svg", "image/svg+xml", 1024);
    fireEvent.change(input, { target: { files: [svg] } });

    const error = await screen.findByTestId("image-node-error");
    expect(error).toHaveTextContent(/no está permitido/i);
    expect(imagePort.requestUploadCalls).toHaveLength(0);
  });

  it("uploads a valid file, registers it and renders it via a resolved read URL (Scenario: Nodo sin URL firmada)", async () => {
    const port = new FakeSavePagePort({
      content: docWithImagePlaceholder(),
      version: 1,
    });
    const imagePort = new FakeImageUploadPort();
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithImagePlaceholder()}
        initialVersion={1}
        port={port}
        imagePort={imagePort}
      />,
    );

    const input = await screen.findByTestId("image-node-input");
    const validFile = makeFile("photo.png", "image/png", 1024);
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => expect(imagePort.registerCalls).toHaveLength(1));
    await waitFor(() => expect(imagePort.getReadUrlCalls).toEqual(["asset-1"]));

    const img = await screen.findByTestId("image-node-img");
    expect(img).toHaveAttribute("src", "https://fake.local/read/asset-1");
  });

  it("never persists a signed URL in the serialized document", async () => {
    const port = new FakeSavePagePort({
      content: docWithImagePlaceholder(),
      version: 1,
    });
    const imagePort = new FakeImageUploadPort();
    render(
      <Editor
        pageId="page-1"
        initialContent={docWithImagePlaceholder()}
        initialVersion={1}
        port={port}
        imagePort={imagePort}
      />,
    );

    const input = await screen.findByTestId("image-node-input");
    const validFile = makeFile("photo.png", "image/png", 1024);
    fireEvent.change(input, { target: { files: [validFile] } });

    await screen.findByTestId("image-node-img");

    const serialized = JSON.stringify(port.saveCalls);
    expect(serialized).not.toMatch(/fake\.local\/read/);
  });

  // PR6 review R3-001/R3-002: a failed read URL or a rejected upload step
  // must end in a visible error (with retry / the picker back), never in a
  // permanent "cargando…"/"subiendo…" indicator.
  describe("failure handling", () => {
    const rejecting = async () => {
      throw new Error("network down");
    };
    const throwingPort: ImageUploadPort = {
      requestUpload: rejecting,
      register: rejecting,
      getReadUrl: rejecting,
    };
    const registeredDoc = {
      type: "doc",
      content: [{ type: "image", attrs: { assetId: "asset-9" } }],
    } as unknown as TiptapDoc;

    function renderRegistered(imagePort: ImageUploadPort | undefined) {
      const port = new FakeSavePagePort({ content: registeredDoc, version: 1 });
      render(
        <Editor
          pageId="page-1"
          initialContent={registeredDoc}
          initialVersion={1}
          port={port}
          imagePort={imagePort}
        />,
      );
    }

    it.each([
      ["returns a non-ok Result", failingImageUploadPort()],
      ["rejects", throwingPort],
      ["is not configured", undefined],
    ])("shows an error, not the loading indicator, when getReadUrl %s", async (_label, imagePort) => {
      renderRegistered(imagePort);

      const error = await screen.findByTestId("image-node-error");
      expect(error).toHaveTextContent(/no pudimos cargar/i);
      expect(screen.queryByText(/cargando imagen/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId("image-node-img")).not.toBeInTheDocument();
    });

    it("offers a retry that resolves the URL once the port recovers", async () => {
      const good = new FakeImageUploadPort();
      let failing = true;
      renderRegistered({
        requestUpload: good.requestUpload.bind(good),
        register: good.register.bind(good),
        getReadUrl: (input) =>
          failing
            ? failingImageUploadPort().getReadUrl(input)
            : good.getReadUrl(input),
      });

      await screen.findByTestId("image-node-error");
      failing = false;
      fireEvent.click(screen.getByTestId("image-node-retry"));

      const img = await screen.findByTestId("image-node-img");
      expect(img).toHaveAttribute("src", "https://fake.local/read/asset-9");
      expect(screen.queryByTestId("image-node-error")).not.toBeInTheDocument();
    });

    it("recovers the picker and shows an error when the upload chain rejects", async () => {
      const port = new FakeSavePagePort({
        content: docWithImagePlaceholder(),
        version: 1,
      });
      render(
        <Editor
          pageId="page-1"
          initialContent={docWithImagePlaceholder()}
          initialVersion={1}
          port={port}
          imagePort={throwingPort}
        />,
      );

      const input = await screen.findByTestId("image-node-input");
      fireEvent.change(input, {
        target: { files: [makeFile("photo.png", "image/png", 1024)] },
      });

      const error = await screen.findByTestId("image-node-error");
      expect(error).toHaveTextContent(/no pudimos subir/i);
      expect(screen.queryByText(/subiendo imagen/i)).not.toBeInTheDocument();
      expect(screen.getByTestId("image-node-picker")).toBeInTheDocument();
    });
  });

  // E2b scope D: the placeholder anatomy, the hover control bar and the
  // caption input.
  describe("polish", () => {
    const loadedDoc = {
      type: "doc",
      content: [
        { type: "image", attrs: { assetId: "asset-1", align: "left" } },
      ],
    } as unknown as TiptapDoc;

    function renderLoaded(content: TiptapDoc = loadedDoc) {
      const port = new FakeSavePagePort({ content, version: 1 });
      const imagePort = new FakeImageUploadPort();
      render(
        <Editor
          pageId="page-1"
          initialContent={content}
          initialVersion={1}
          port={port}
          imagePort={imagePort}
        />,
      );
      return { port, imagePort };
    }

    it("shows the helper text derived from the real upload limits on the placeholder", async () => {
      const port = new FakeSavePagePort({
        content: docWithImagePlaceholder(),
        version: 1,
      });
      render(
        <Editor
          pageId="page-1"
          initialContent={docWithImagePlaceholder()}
          initialVersion={1}
          port={port}
          imagePort={new FakeImageUploadPort()}
        />,
      );

      expect(
        await screen.findByText("JPG, PNG, WebP, GIF · hasta 10 MB"),
      ).toBeInTheDocument();
    });

    it("shows the progress card while an upload is in flight", async () => {
      const good = new FakeImageUploadPort();
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const port = new FakeSavePagePort({
        content: docWithImagePlaceholder(),
        version: 1,
      });
      render(
        <Editor
          pageId="page-1"
          initialContent={docWithImagePlaceholder()}
          initialVersion={1}
          port={port}
          imagePort={{
            requestUpload: async (input) => {
              await gate;
              return good.requestUpload(input);
            },
            register: good.register.bind(good),
            getReadUrl: good.getReadUrl.bind(good),
          }}
        />,
      );

      fireEvent.change(await screen.findByTestId("image-node-input"), {
        target: { files: [makeFile("photo.png", "image/png", 1024)] },
      });

      expect(await screen.findByTestId("upload-progress")).toHaveTextContent(
        /subiendo imagen/i,
      );
      expect(screen.queryByTestId("image-node-picker")).not.toBeInTheDocument();

      release();
      expect(await screen.findByTestId("image-node-img")).toBeInTheDocument();
      expect(screen.queryByTestId("upload-progress")).not.toBeInTheDocument();
    });

    it("lets the user retry from the placeholder after a failed upload", async () => {
      const good = new FakeImageUploadPort();
      let failing = true;
      const port = new FakeSavePagePort({
        content: docWithImagePlaceholder(),
        version: 1,
      });
      render(
        <Editor
          pageId="page-1"
          initialContent={docWithImagePlaceholder()}
          initialVersion={1}
          port={port}
          imagePort={{
            requestUpload: (input) =>
              failing
                ? failingImageUploadPort().requestUpload(input)
                : good.requestUpload(input),
            register: good.register.bind(good),
            getReadUrl: good.getReadUrl.bind(good),
          }}
        />,
      );

      const input = await screen.findByTestId("image-node-input");
      fireEvent.change(input, {
        target: { files: [makeFile("photo.png", "image/png", 1024)] },
      });
      expect(await screen.findByTestId("image-node-error")).toHaveTextContent(
        /no pudimos subir/i,
      );

      failing = false;
      fireEvent.change(screen.getByTestId("image-node-input"), {
        target: { files: [makeFile("photo.png", "image/png", 1024)] },
      });

      expect(await screen.findByTestId("image-node-img")).toBeInTheDocument();
      expect(screen.queryByTestId("image-node-error")).not.toBeInTheDocument();
    });

    it("reflects the persisted alignment and persists a new one", async () => {
      const { port } = renderLoaded();

      await screen.findByTestId("image-node-img");
      expect(screen.getByTestId("image-node-align-left")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByTestId("image-node-align-right")).toHaveAttribute(
        "aria-pressed",
        "false",
      );

      fireEvent.click(screen.getByTestId("image-node-align-right"));

      await waitFor(() =>
        expect(screen.getByTestId("image-node-align-right")).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
      );
      expect(screen.getByTestId("image-node-align-left")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await waitFor(() =>
        expect(JSON.stringify(port.saveCalls)).toContain('"align":"right"'),
      );
    });

    it("commits the caption on blur, trimmed, and uses it as the alt text", async () => {
      const { port } = renderLoaded();

      const caption = await screen.findByTestId("image-node-caption");
      fireEvent.change(caption, { target: { value: "  Mitosis  " } });
      fireEvent.blur(caption);

      await waitFor(() =>
        expect(screen.getByTestId("image-node-img")).toHaveAttribute(
          "alt",
          "Mitosis",
        ),
      );
      await waitFor(() =>
        expect(JSON.stringify(port.saveCalls)).toContain('"caption":"Mitosis"'),
      );
    });

    it("clears the caption attribute when the input is emptied", async () => {
      const captioned = {
        type: "doc",
        content: [
          { type: "image", attrs: { assetId: "asset-1", caption: "Vieja" } },
        ],
      } as unknown as TiptapDoc;
      const { port } = renderLoaded(captioned);

      const caption = await screen.findByTestId("image-node-caption");
      expect(caption).toHaveValue("Vieja");
      fireEvent.change(caption, { target: { value: "   " } });
      fireEvent.blur(caption);

      await waitFor(() =>
        expect(screen.getByTestId("image-node-img")).toHaveAttribute("alt", ""),
      );
      await waitFor(() =>
        expect(JSON.stringify(port.saveCalls)).toContain('"caption":null'),
      );
    });

    it("does not rewrite the node when the caption is blurred unchanged", async () => {
      const captioned = {
        type: "doc",
        content: [
          { type: "image", attrs: { assetId: "asset-1", caption: "Vieja" } },
        ],
      } as unknown as TiptapDoc;
      const { port } = renderLoaded(captioned);

      const caption = await screen.findByTestId("image-node-caption");
      await new Promise((resolve) => setTimeout(resolve, 1300));
      // The trailing paragraph the editor appends on mount is saved once.
      const savesBeforeBlur = port.saveCalls.length;
      fireEvent.change(caption, { target: { value: " Vieja " } });
      fireEvent.blur(caption);
      await new Promise((resolve) => setTimeout(resolve, 1300));

      expect(port.saveCalls).toHaveLength(savesBeforeBlur);
    });

    it("does not insert a line break when Enter is pressed in the caption", async () => {
      renderLoaded();

      const caption = await screen.findByTestId("image-node-caption");
      const notPrevented = fireEvent.keyDown(caption, { key: "Enter" });

      expect(notPrevented).toBe(false);
    });

    it("opens the file picker from the reemplazar control", async () => {
      renderLoaded();
      await screen.findByTestId("image-node-img");
      const input = screen.getByTestId("image-node-replace-input");
      const click = vi.spyOn(input as HTMLInputElement, "click");

      fireEvent.click(screen.getByTestId("image-node-replace"));

      expect(click).toHaveBeenCalledTimes(1);
    });

    it("drops the previous picture while the replacement asset's URL resolves", async () => {
      const good = new FakeImageUploadPort();
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const replacedDoc = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: "asset-9" } }],
      } as unknown as TiptapDoc;
      const port = new FakeSavePagePort({ content: replacedDoc, version: 1 });
      render(
        <Editor
          pageId="page-1"
          initialContent={replacedDoc}
          initialVersion={1}
          port={port}
          imagePort={{
            requestUpload: good.requestUpload.bind(good),
            register: good.register.bind(good),
            getReadUrl: async (input) => {
              if (input.assetId === "asset-1") await gate;
              return good.getReadUrl(input);
            },
          }}
        />,
      );

      expect(await screen.findByTestId("image-node-img")).toHaveAttribute(
        "src",
        "https://fake.local/read/asset-9",
      );
      fireEvent.change(screen.getByTestId("image-node-replace-input"), {
        target: { files: [makeFile("new.png", "image/png", 1024)] },
      });

      await waitFor(() =>
        expect(screen.getByTestId("image-node")).toHaveAttribute(
          "data-asset-id",
          "asset-1",
        ),
      );
      expect(screen.queryByTestId("image-node-img")).not.toBeInTheDocument();

      release();
      expect(await screen.findByTestId("image-node-img")).toHaveAttribute(
        "src",
        "https://fake.local/read/asset-1",
      );
    });

    it("blurs the caption input on Enter instead of inserting a line break", async () => {
      renderLoaded();

      const caption = await screen.findByTestId("image-node-caption");
      caption.focus();
      expect(caption).toHaveFocus();
      fireEvent.keyDown(caption, { key: "Enter" });

      expect(caption).not.toHaveFocus();
    });

    it("deletes the block from the control bar", async () => {
      renderLoaded();

      await screen.findByTestId("image-node-img");
      fireEvent.click(screen.getByTestId("image-node-delete"));

      await waitFor(() =>
        expect(screen.queryByTestId("image-node")).not.toBeInTheDocument(),
      );
    });

    it("replaces the image through the control bar and resolves the new asset", async () => {
      const { imagePort } = renderLoaded();

      await screen.findByTestId("image-node-img");
      fireEvent.change(screen.getByTestId("image-node-replace-input"), {
        target: { files: [makeFile("new.png", "image/png", 1024)] },
      });

      await waitFor(() => expect(imagePort.registerCalls).toHaveLength(1));
      await waitFor(() =>
        expect(imagePort.getReadUrlCalls).toContain("asset-1"),
      );
      await waitFor(() =>
        expect(screen.getByTestId("image-node")).toHaveAttribute(
          "data-asset-id",
          "asset-1",
        ),
      );
      expect(imagePort.requestUploadCalls[0]?.mime).toBe("image/png");
    });

    it("rejects an oversized replacement without touching the existing image", async () => {
      const { imagePort } = renderLoaded();

      await screen.findByTestId("image-node-img");
      fireEvent.change(screen.getByTestId("image-node-replace-input"), {
        target: {
          files: [makeFile("big.png", "image/png", 12 * 1024 * 1024)],
        },
      });

      expect(imagePort.requestUploadCalls).toHaveLength(0);
      expect(screen.getByTestId("image-node-img")).toBeInTheDocument();
    });

    // F4a (odd/tasks/review-followups.md): a failed or rejected replacement
    // used to set an error that only the placeholder/unloaded branches
    // rendered, so over a loaded image nothing told the user.
    it("announces a failed replacement while keeping the current image", async () => {
      const content = loadedDoc;
      const port = new FakeSavePagePort({ content, version: 1 });
      const good = new FakeImageUploadPort();
      render(
        <Editor
          pageId="page-1"
          initialContent={content}
          initialVersion={1}
          port={port}
          imagePort={{
            requestUpload: (input) =>
              failingImageUploadPort().requestUpload(input),
            register: good.register.bind(good),
            getReadUrl: good.getReadUrl.bind(good),
          }}
        />,
      );

      await screen.findByTestId("image-node-img");
      fireEvent.change(screen.getByTestId("image-node-replace-input"), {
        target: { files: [makeFile("new.png", "image/png", 1024)] },
      });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/no pudimos subir la imagen/i);
      expect(screen.getByTestId("image-node-img")).toBeInTheDocument();
    });

    it("announces a rejected replacement file and clears it on the next attempt", async () => {
      renderLoaded();

      await screen.findByTestId("image-node-img");
      fireEvent.change(screen.getByTestId("image-node-replace-input"), {
        target: {
          files: [makeFile("big.png", "image/png", 12 * 1024 * 1024)],
        },
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /tamaño máximo/i,
      );

      fireEvent.change(screen.getByTestId("image-node-replace-input"), {
        target: { files: [makeFile("ok.png", "image/png", 1024)] },
      });
      await waitFor(() =>
        expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
      );
    });

    it("downloads the resolved URL in a new, opener-isolated tab", async () => {
      renderLoaded();
      await screen.findByTestId("image-node-img");
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function (this: HTMLAnchorElement) {
          expect(this.href).toBe("https://fake.local/read/asset-1");
          expect(this.target).toBe("_blank");
          expect(this.rel).toBe("noopener noreferrer");
          expect(this.hasAttribute("download")).toBe(true);
        });
      try {
        fireEvent.click(screen.getByTestId("image-node-download"));
        expect(click).toHaveBeenCalledTimes(1);
      } finally {
        click.mockRestore();
      }
    });

    it("exposes the control bar as a labelled toolbar", async () => {
      renderLoaded();
      await screen.findByTestId("image-node-img");

      expect(
        screen.getByRole("toolbar", { name: "Opciones de imagen" }),
      ).toBeInTheDocument();
    });
  });
});
