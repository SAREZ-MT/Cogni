import { cn } from "@/shared/ui/utils";

export type FileFormat = "pdf" | "docx" | "pptx";

// Each importable format in its usual family colour, on the pastel
// palette: PDF red-pink, Word blue, PowerPoint orange.
const TONES: Record<FileFormat, string> = {
  pdf: "bg-pastel-pink text-pastel-pink-fg",
  docx: "bg-pastel-blue text-pastel-blue-fg",
  pptx: "bg-pastel-orange text-pastel-orange-fg",
};

export interface FileFormatBadgeProps {
  format: FileFormat;
  className?: string;
}

// A small uppercase file-type tag (Phase 8 H5-T3, the "Nueva página"
// dialog's import option): 10.5px bold extension on its format's pastel,
// a 6px radius and a hairline inner border so it reads as a file label,
// not a status pill. The extension is the text, so it stays readable.
export function FileFormatBadge({ format, className }: FileFormatBadgeProps) {
  return (
    <span
      data-slot="file-format-badge"
      data-format={format}
      className={cn(
        "inline-flex h-6 items-center rounded-[6px] px-2 font-bold text-[10.5px] tracking-wide shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]",
        TONES[format],
        className,
      )}
    >
      {format.toUpperCase()}
    </span>
  );
}
