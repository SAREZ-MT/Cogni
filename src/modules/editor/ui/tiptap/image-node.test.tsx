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
});
