import type { ComponentProps } from "react";

type AuthFieldProps = ComponentProps<"input"> & { label: string; name: string };

export function AuthField({
  label,
  name,
  id = name,
  ...props
}: AuthFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium text-fg text-sm">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="h-11 w-full rounded-input border border-neutral-300 bg-card px-3 text-fg text-sm shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-fg-muted hover:border-neutral-400 focus-visible:border-primary-500 focus-visible:ring-3 focus-visible:ring-primary-500/20"
        {...props}
      />
    </div>
  );
}
