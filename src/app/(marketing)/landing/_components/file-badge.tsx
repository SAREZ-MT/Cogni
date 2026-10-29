import { File } from "@phosphor-icons/react/dist/ssr/File";

// The only formats Cogni imports (faq.tsx): no other extension may appear.
export type FileKind = "pdf" | "docx" | "pptx";

const LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  docx: "DOCX",
  pptx: "PPTX",
};

// A file-type icon in the Untitled UI manner: a white Phosphor page
// (fill weight under a light outline) with a coloured extension tag across
// its lower left (PDF red, DOCX blue, PPTX orange; landing.css .lp-fbadge).
// It is a generic file glyph, never a vendor logo. Decorative by default:
// the surrounding text or the caller's label names the file.
export function FileBadge({
  kind,
  size = "md",
  className = "",
}: {
  kind: FileKind;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-kind={kind}
      data-size={size}
      className={`lp-fbadge ${className}`}
    >
      <File weight="fill" className="lp-fbadge-paper" />
      <File weight="light" className="lp-fbadge-edge" />
      <span className="lp-fbadge-tag">{LABEL[kind]}</span>
    </span>
  );
}
