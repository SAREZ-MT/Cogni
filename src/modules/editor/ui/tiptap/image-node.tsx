"use client";

// Image block (tasks.md 6.14-6.17, design.md "Subida de imagen firmada"): a
// block-level atom node that persists only `{ assetId }` — never a URL —
// and resolves its read URL on demand when it mounts (specs/page-assets/
// spec.md, "URLs de lectura firmadas de corta duración": "MUST NOT
// persistirse ... en el contenido de la página").
import { mergeAttributes, Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
} from "../../domain/image-asset-limits";
import type { ImageUploadPort } from "../../domain/image-upload-port";
import { UploadProgress } from "../upload-progress";
import { uploadToSignedUrl } from "./upload-to-signed-url";

const IMAGE_COPY = {
  tooLarge: "El archivo supera el tamaño máximo permitido (10 MB).",
  mimeNotAllowed: "Ese tipo de archivo no está permitido.",
  uploadFailed: "No pudimos subir la imagen. Inténtalo de nuevo.",
  readFailed: "No pudimos cargar la imagen.",
  retry: "reintentar",
  picker: "elegir imagen",
  uploading: "subiendo imagen…",
  loading: "cargando imagen…",
};

// A File dropped/pasted onto the editor cannot be stored in a Tiptap node
// attribute (attrs must be JSON-serializable). This map bridges the
// drop/paste ProseMirror plugin below and the node view: a `pendingId`
// attribute looks up and immediately consumes the real File once, then the
// node view clears both the attribute and this map entry.
export const PENDING_IMAGE_FILES = new Map<string, File>();

function validateClientSide(file: File): string | null {
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
    return IMAGE_COPY.mimeNotAllowed;
  }
  if (file.size > MAX_IMAGE_BYTES) return IMAGE_COPY.tooLarge;
  return null;
}

export interface ImageBlockOptions {
  pageId: string;
  imagePort: ImageUploadPort | null;
}

function ImageNodeView({
  node,
  updateAttributes,
  extension,
}: ReactNodeViewProps) {
  const { pageId, imagePort } = extension.options as ImageBlockOptions;
  const assetId = node.attrs.assetId as string | null;
  const pendingId = node.attrs.pendingId as string | null;
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Bumped by the retry control of a registered image whose read URL could
  // not be resolved; re-runs the getReadUrl effect below.
  const [readAttempt, setReadAttempt] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startedPendingRef = useRef(false);

  const upload = useCallback(
    async (file: File) => {
      const validationError = validateClientSide(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      if (!imagePort) {
        setError(IMAGE_COPY.uploadFailed);
        return;
      }
      setError(null);
      setUploading(true);

      const grant = await imagePort.requestUpload({
        pageId,
        mime: file.type,
        sizeBytes: file.size,
      });
      if (!grant.ok) {
        setError(IMAGE_COPY.uploadFailed);
        setUploading(false);
        return;
      }

      const { error: uploadError } = await uploadToSignedUrl(
        grant.value.bucket,
        grant.value.storagePath,
        grant.value.token,
        file,
      );
      if (uploadError) {
        setError(IMAGE_COPY.uploadFailed);
        setUploading(false);
        return;
      }

      const registered = await imagePort.register({
        pageId,
        storagePath: grant.value.storagePath,
        mime: file.type,
        sizeBytes: file.size,
      });
      setUploading(false);
      if (!registered.ok) {
        setError(IMAGE_COPY.uploadFailed);
        return;
      }
      updateAttributes({ assetId: registered.value.id, pendingId: null });
    },
    [pageId, imagePort, updateAttributes],
  );

  // Every upload step may reject instead of resolving to a Result (a Server
  // Action failing at the transport level, clientEnv() throwing, the
  // Storage client throwing). Without this, `uploading` would stay true
  // forever, hiding the picker behind a permanent "subiendo imagen…".
  const startUpload = useCallback(
    (file: File) => {
      upload(file)
        .catch(() => setError(IMAGE_COPY.uploadFailed))
        .finally(() => setUploading(false));
    },
    [upload],
  );

  // A pending drag-and-drop/paste file starts uploading automatically,
  // exactly once, without the user re-picking it through the file input.
  useEffect(() => {
    if (!pendingId || startedPendingRef.current) return;
    startedPendingRef.current = true;
    const file = PENDING_IMAGE_FILES.get(pendingId);
    PENDING_IMAGE_FILES.delete(pendingId);
    if (file) startUpload(file);
  }, [pendingId, startUpload]);

  // A missing port, a non-ok Result or a rejected promise all end in a
  // visible error with a retry, never in an indefinite "cargando imagen…".
  useEffect(() => {
    if (!assetId) return;
    if (!imagePort) {
      setError(IMAGE_COPY.readFailed);
      return;
    }
    let cancelled = false;
    setError(null);
    imagePort
      .getReadUrl({ assetId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setUrl(result.value.url);
        else setError(IMAGE_COPY.readFailed);
      })
      .catch(() => {
        if (!cancelled) setError(IMAGE_COPY.readFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, imagePort, readAttempt]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) startUpload(file);
  }

  if (assetId) {
    return (
      <NodeViewWrapper data-testid="image-node" data-asset-id={assetId}>
        {url ? (
          // Signed URLs expire and are per-request; next/image would need
          // per-URL remotePatterns re-validation for no real benefit here.
          // biome-ignore lint/performance/noImgElement: short-lived signed URL, not a static asset.
          <img
            data-testid="image-node-img"
            src={url}
            alt=""
            className="max-w-full rounded-2xl"
          />
        ) : error ? (
          <p data-testid="image-node-error" className="text-error-600 text-xs">
            {error}{" "}
            <button
              type="button"
              data-testid="image-node-retry"
              className="underline"
              onClick={() => setReadAttempt((attempt) => attempt + 1)}
            >
              {IMAGE_COPY.retry}
            </button>
          </p>
        ) : (
          <UploadProgress label={IMAGE_COPY.loading} />
        )}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      data-testid="image-node-placeholder"
      className="flex flex-col gap-2 rounded-2xl border border-border border-dashed p-4"
    >
      {uploading ? (
        <UploadProgress label={IMAGE_COPY.uploading} />
      ) : (
        <button
          type="button"
          data-testid="image-node-picker"
          className="text-fg-secondary text-sm underline"
          onClick={() => fileInputRef.current?.click()}
        >
          {IMAGE_COPY.picker}
        </button>
      )}
      <input
        ref={fileInputRef}
        data-testid="image-node-input"
        type="file"
        accept={ALLOWED_IMAGE_MIME.join(",")}
        className="hidden"
        onChange={handleFileChange}
      />
      {error ? (
        <p data-testid="image-node-error" className="text-error-600 text-xs">
          {error}
        </p>
      ) : null}
    </NodeViewWrapper>
  );
}

let pendingIdCounter = 0;
function nextPendingId(): string {
  pendingIdCounter += 1;
  return `pending-image-${Date.now()}-${pendingIdCounter}`;
}

function insertImagePlaceholder(view: EditorView, file: File, pos: number) {
  const pendingId = nextPendingId();
  PENDING_IMAGE_FILES.set(pendingId, file);
  const node = view.state.schema.nodes.image.create({
    assetId: null,
    pendingId,
  });
  const tr = view.state.tr.insert(pos, node);
  view.dispatch(tr);
}

// specs/editor/spec.md, "Agregar el bloque de imagen ... soporte de
// arrastrar-y-soltar": dropping or pasting an image file inserts the block
// and starts its upload immediately, without going through the "/" menu or
// the file picker button.
const imageDropPastePluginKey = new PluginKey("image-drop-paste");

export const ImageBlock = Node.create<ImageBlockOptions>({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { pageId: "", imagePort: null };
  },

  addAttributes() {
    return {
      assetId: { default: null },
      pendingId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "image" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: imageDropPastePluginKey,
        props: {
          handleDrop: (view, event) => {
            const files = Array.from(event.dataTransfer?.files ?? []).filter(
              (file) => file.type.startsWith("image/"),
            );
            if (files.length === 0) return false;
            event.preventDefault();
            const coords = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            insertImagePlaceholder(
              view,
              files[0],
              coords?.pos ?? view.state.selection.from,
            );
            return true;
          },
          handlePaste: (view, event) => {
            const files = Array.from(event.clipboardData?.files ?? []).filter(
              (file) => file.type.startsWith("image/"),
            );
            if (files.length === 0) return false;
            event.preventDefault();
            insertImagePlaceholder(view, files[0], view.state.selection.from);
            return true;
          },
        },
      }),
    ];
  },
});
