"use client";

import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { cn } from "@/shared/ui/utils";

type AuthFieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: string;
};

// Password fields get a show/hide toggle so a typo is visible before submit,
// which matters most on phones. The hint is linked via aria-describedby.
export function AuthField({
  label,
  name,
  id = name,
  hint,
  type,
  ...props
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium text-fg text-sm">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && revealed ? "text" : type}
          aria-describedby={hintId}
          className={cn(
            "h-11 w-full rounded-input border border-neutral-300 bg-card px-3 text-fg text-sm shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-fg-placeholder hover:border-neutral-400 focus-visible:border-primary-500 focus-visible:ring-3 focus-visible:ring-primary-500/20",
            isPassword && "pr-11",
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-input text-fg-muted transition-colors hover:text-fg focus-visible:text-fg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary-500/20"
          >
            {revealed ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-fg-secondary text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
