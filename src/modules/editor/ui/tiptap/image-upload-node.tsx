"use client";

// E2b scope D (editor pass, Tiptap docs "image-upload-node" anatomy): the
// dashed drop-zone placeholder card image-node.tsx renders before an image
// has an `assetId` — idle ("arrastra o haz clic"), uploading (ProgressBar-
// style spinner via the existing UploadProgress atom) and error (Card tone
// "error", "Reintentar"). Split out of image-node.tsx as a plain
// presentational component (no Tiptap import), the same
// BubbleToolbarControls/BubbleToolbar split bubble-toolbar.tsx already
// uses: image-node.tsx keeps all Tiptap wiring (the Node definition, the
// upload state machine, the drop/paste ProseMirror plugin) and only passes
// this component its already-resolved state + callbacks.
import { ImagePlus } from "lucide-react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import { Card } from "@/shared/ui/card";
import { IconTile } from "@/shared/ui/icon-tile";
import { cn } from "@/shared/ui/utils";
import { UploadProgress } from "../upload-progress";

export interface ImageUploadNodeProps {
  uploading: boolean;
  error: string | null;
  uploadingLabel: string;
  helperText: string;
  acceptedMime: readonly string[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPickFile: (file: File) => void;
}

const PROMPT_LABEL = "Arrastra una imagen o haz clic para subirla";
const RETRY_LABEL = "Reintentar";
const ERROR_TITLE = "No se pudo subir la imagen";

export function ImageUploadNode({
  uploading,
  error,
  uploadingLabel,
  helperText,
  acceptedMime,
  fileInputRef,
  onPickFile,
}: ImageUploadNodeProps) {
  function openPicker() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPickFile(file);
  }

  // Local drop handling in addition to image-node.tsx's document-level
  // ProseMirror `handleDrop` plugin (which only fires for a drop that
  // lands somewhere else in the document and inserts a brand-new
  // placeholder node there). Dropping directly onto an ALREADY-INSERTED
  // empty placeholder — this component — should upload into that same
  // node instead of creating a second one, so this stops the native event
  // from also reaching that document-level listener.
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (uploading) return;
    const file = Array.from(event.dataTransfer?.files ?? []).find((item) =>
      item.type.startsWith("image/"),
    );
    if (file) onPickFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  return (
    <Card
      data-testid="image-node-placeholder"
      tone={error ? "error" : "subtle"}
      padding="lg"
      // Mouse-only "click anywhere on the card" convenience — the real,
      // keyboard-reachable affordance is the labeled <button> below (a
      // `role="button"` div wrapping a real <button> would nest two
      // interactive elements, which is invalid ARIA).
      onClick={uploading ? undefined : openPicker}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border-dashed text-center",
        !uploading && "cursor-pointer",
      )}
    >
      <IconTile
        size="44"
        radius="tile"
        tone={error ? "error" : "purple"}
        aria-hidden="true"
      >
        <ImagePlus size={20} strokeWidth={1.75} />
      </IconTile>

      {uploading ? (
        <UploadProgress label={uploadingLabel} />
      ) : error ? (
        <>
          <p className="font-medium text-fg text-sm">{ERROR_TITLE}</p>
          <p data-testid="image-node-error" className="text-error-700 text-xs">
            {error}
          </p>
          <button
            type="button"
            data-testid="image-node-picker"
            className="rounded-md px-2.5 py-1 font-medium text-error-700 text-xs underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              event.stopPropagation();
              openPicker();
            }}
          >
            {RETRY_LABEL}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            data-testid="image-node-picker"
            className="font-medium text-fg text-sm outline-none"
            onClick={(event) => {
              event.stopPropagation();
              openPicker();
            }}
          >
            {PROMPT_LABEL}
          </button>
          <p className="text-fg-muted text-xs">{helperText}</p>
        </>
      )}

      <input
        ref={fileInputRef}
        data-testid="image-node-input"
        type="file"
        accept={acceptedMime.join(",")}
        className="hidden"
        onClick={(event) => event.stopPropagation()}
        onChange={handleFileChange}
      />
    </Card>
  );
}
