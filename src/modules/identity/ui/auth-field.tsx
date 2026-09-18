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
        className="h-11 w-full rounded-input border border-border-default bg-card px-3 text-fg text-sm placeholder:text-fg-muted"
        {...props}
      />
    </div>
  );
}
