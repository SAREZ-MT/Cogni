import type { ReactNode } from "react";
import { FieldLabel } from "@/shared/ui/field-label";
import { cn } from "@/shared/ui/utils";

export interface ItemFieldProps {
  id: string;
  label: ReactNode;
  // The inline validation message; the control should carry
  // `aria-invalid` and `aria-describedby={errorId(id)}` while it shows.
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function errorId(id: string): string {
  return `${id}-error`;
}

// One labelled field of an edit page entry (Phase 8 H18): FieldLabel, the
// control, then the error (destructive, 12px) or a muted hint below it.
export function ItemField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: ItemFieldProps) {
  return (
    <div
      data-slot="item-field"
      className={cn("flex flex-col gap-1.5", className)}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {error ? (
        <p id={errorId(id)} className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        hint && <p className="text-fg-muted text-xs">{hint}</p>
      )}
    </div>
  );
}

// The props a control inside ItemField takes for its error state.
export function invalidProps(id: string, error: string | undefined) {
  return error ? { "aria-invalid": true, "aria-describedby": errorId(id) } : {};
}
