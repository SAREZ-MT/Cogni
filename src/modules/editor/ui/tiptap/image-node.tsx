"use client";

// Image block (tasks.md 6.14-6.17, design.md "Subida de imagen firmada"): a
// block-level atom node that persists `{ assetId, align, caption }` — never
// a URL — and resolves its read URL on demand when it mounts (specs/page-
// assets/spec.md, "URLs de lectura firmadas de corta duración": "MUST NOT
// persistirse ... en el contenido de la página").
//
// E2b scope D (image-upload-node anatomy + image node polish): the
// pre-upload placeholder/error UI now lives in image-upload-node.tsx (a
// plain presentational component, same split as bubble-toolbar.tsx's
// BubbleToolbarControls) — this file keeps the Tiptap Node definition, the
// upload state machine and the drop/paste ProseMirror plugin, and adds a
// hover control bar (align/reemplazar/descargar/eliminar) + a caption input
// once the image has loaded.
import { mergeAttributes, Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Download,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/shared/ui/utils";
import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
} from "../../domain/image-asset-limits";
import type { ImageUploadPort } from "../../domain/image-upload-port";
import { UploadProgress } from "../upload-progress";
import { ImageUploadNode } from "./image-upload-node";
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

// "PNG, JPG, WebP o GIF · hasta 10 MB" — derived from the real client-side
// limits (image-asset-limits.ts) rather than a hardcoded guess, so this
// never drifts from ALLOWED_IMAGE_MIME/MAX_IMAGE_BYTES.
const MIME_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WebP",
  "image/gif": "GIF",
};
const UPLOAD_HELPER_TEXT = `${ALLOWED_IMAGE_MIME.map((mime) => MIME_LABELS[mime] ?? mime).join(", ")} · hasta ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB`;

export type ImageAlign = "left" | "center" | "right";

const ALIGN_OPTIONS: {
  id: ImageAlign;
  label: string;
  icon: typeof AlignLeft;
}[] = [
  { id: "left", label: "Alinear a la izquierda", icon: AlignLeft },
  { id: "center", label: "Centrar", icon: AlignCenter },
  { id: "right", label: "Alinear a la derecha", icon: AlignRight },
];

const ALIGN_JUSTIFY_CLASS: Record<ImageAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
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

const CONTROL_BUTTON_CLASS =
  "flex size-7 items-center justify-center rounded-md text-fg-secondary outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring";

function ImageNodeView({
  node,
  updateAttributes,
  deleteNode,
  extension,
}: ReactNodeViewProps) {
  const { pageId, imagePort } = extension.options as ImageBlockOptions;
  const assetId = node.attrs.assetId as string | null;
  const pendingId = node.attrs.pendingId as string | null;
  const align = (node.attrs.align as ImageAlign | null) ?? "center";
  const caption = (node.attrs.caption as string | null) ?? "";
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(caption);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const startedPendingRef = useRef(false);

  useEffect(() => setCaptionDraft(caption), [caption]);

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
      // Also resets a stale `url` from whatever asset was previously
      // loaded (the "reemplazar" control re-runs this same upload() on an
      // already-loaded image) so the next mount effect re-resolves it
      // instead of briefly showing the old picture under the new assetId.
      setUrl(null);
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
  // Shared by the mount effect and the retry control so a retry is the
  // exact same load, not a second code path.
  const loadReadUrl = useCallback(() => {
    if (!assetId) return () => {};
    if (!imagePort) {
      setError(IMAGE_COPY.readFailed);
      return () => {};
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
  }, [assetId, imagePort]);

  useEffect(() => loadReadUrl(), [loadReadUrl]);

  function handleReplaceChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) startUpload(file);
  }

  function commitCaption() {
    const trimmed = captionDraft.trim();
    if (trimmed === caption) return;
    updateAttributes({ caption: trimmed || null });
  }

  function download() {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }

  // Uploading takes precedence over `assetId` so the "reemplazar" control
  // (which re-runs upload() while an assetId from the PREVIOUS asset is
  // still attached) shows the same progress card the very first upload
  // does, instead of briefly re-rendering the old image underneath it.
  if (uploading) {
    return (
      <NodeViewWrapper data-testid="image-node">
        <ImageUploadNode
          uploading
          error={null}
          uploadingLabel={IMAGE_COPY.uploading}
          helperText={UPLOAD_HELPER_TEXT}
          acceptedMime={ALLOWED_IMAGE_MIME}
          fileInputRef={fileInputRef}
          onPickFile={startUpload}
        />
      </NodeViewWrapper>
    );
  }

  if (assetId) {
    return (
      <NodeViewWrapper data-testid="image-node" data-asset-id={assetId}>
        <figure className="group relative m-0">
          {url ? (
            <>
              <div className={cn("flex", ALIGN_JUSTIFY_CLASS[align])}>
                {/* Signed URLs expire and are per-request; next/image would
                    need per-URL remotePatterns re-validation for no real
                    benefit here. */}
                {/* biome-ignore lint/performance/noImgElement: short-lived signed URL, not a static asset. */}
                <img
                  data-testid="image-node-img"
                  src={url}
                  alt={caption || ""}
                  className="max-w-full rounded-2xl"
                />
              </div>
              {/* E2b scope D, "image node polish": a small floating control
                  bar on hover — align/reemplazar/descargar/eliminar. */}
              <div
                role="toolbar"
                aria-label="Opciones de imagen"
                data-testid="image-node-controls"
                className="absolute top-2 right-2 flex items-center gap-0.5 rounded-lg border border-border-default bg-card p-1 opacity-0 shadow-md transition-opacity focus-within:opacity-100 group-hover:opacity-100"
              >
                {ALIGN_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={align === option.id}
                    data-testid={`image-node-align-${option.id}`}
                    className={cn(
                      CONTROL_BUTTON_CLASS,
                      align === option.id && "bg-active text-fg-active",
                    )}
                    onClick={() => updateAttributes({ align: option.id })}
                  >
                    <option.icon
                      aria-hidden="true"
                      size={15}
                      strokeWidth={1.75}
                    />
                  </button>
                ))}
                <span
                  aria-hidden="true"
                  className="mx-0.5 h-5 w-px shrink-0 bg-border-default"
                />
                <button
                  type="button"
                  aria-label="Reemplazar imagen"
                  data-testid="image-node-replace"
                  className={CONTROL_BUTTON_CLASS}
                  onClick={() => replaceInputRef.current?.click()}
                >
                  <RefreshCw aria-hidden="true" size={15} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="Descargar imagen"
                  data-testid="image-node-download"
                  className={CONTROL_BUTTON_CLASS}
                  onClick={download}
                >
                  <Download aria-hidden="true" size={15} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="Eliminar imagen"
                  data-testid="image-node-delete"
                  className={`${CONTROL_BUTTON_CLASS} hover:bg-error-50 hover:text-error-700`}
                  onClick={() => deleteNode()}
                >
                  <Trash2 aria-hidden="true" size={15} strokeWidth={1.75} />
                </button>
              </div>
              <input
                ref={replaceInputRef}
                data-testid="image-node-replace-input"
                type="file"
                accept={ALLOWED_IMAGE_MIME.join(",")}
                className="hidden"
                onChange={handleReplaceChange}
              />
              <figcaption className="mt-1.5">
                <input
                  type="text"
                  value={captionDraft}
                  placeholder="Añade un pie de imagen"
                  aria-label="Pie de imagen"
                  data-testid="image-node-caption"
                  className="w-full border-none bg-transparent text-center text-fg-muted text-xs outline-none placeholder:text-fg-muted"
                  onChange={(event) => setCaptionDraft(event.target.value)}
                  onBlur={commitCaption}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                />
              </figcaption>
            </>
          ) : error ? (
            <p
              data-testid="image-node-error"
              className="text-error-600 text-xs"
            >
              {error}{" "}
              <button
                type="button"
                data-testid="image-node-retry"
                className="underline"
                onClick={() => loadReadUrl()}
              >
                {IMAGE_COPY.retry}
              </button>
            </p>
          ) : (
            <UploadProgress label={IMAGE_COPY.loading} />
          )}
        </figure>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-testid="image-node">
      <ImageUploadNode
        uploading={false}
        error={error}
        uploadingLabel={IMAGE_COPY.uploading}
        helperText={UPLOAD_HELPER_TEXT}
        acceptedMime={ALLOWED_IMAGE_MIME}
        fileInputRef={fileInputRef}
        onPickFile={startUpload}
      />
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
      // E2b scope D (image node polish): alignment applied to the image's
      // wrapping <figure> (ALIGN_JUSTIFY_CLASS above) and a caption stored
      // as plain text, never rendered through ProseMirror's own schema (an
      // <input>, not editor content) — same "a plain attribute, not a
      // child node" shape node-background.ts's `nodeBackground` already
      // uses for a similarly presentation-only value.
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: (attributes) =>
          attributes.align ? { "data-align": attributes.align } : {},
      },
      caption: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-caption"),
        renderHTML: (attributes) =>
          attributes.caption ? { "data-caption": attributes.caption } : {},
      },
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
