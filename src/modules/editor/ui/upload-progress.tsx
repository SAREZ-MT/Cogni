// A framework-agnostic progress marker shown while an image uploads
// (tasks.md 6.15). Plain presentational component, no Tiptap import, same
// pattern as save-status.tsx.
export interface UploadProgressProps {
  label: string;
}

export function UploadProgress({ label }: UploadProgressProps) {
  return (
    <output
      data-testid="upload-progress"
      aria-live="polite"
      className="flex items-center gap-2 text-fg-secondary text-xs"
    >
      <span
        data-testid="upload-progress-spinner"
        className="size-3 animate-spin rounded-full border-2 border-border border-t-accent"
      />
      {label}
    </output>
  );
}
