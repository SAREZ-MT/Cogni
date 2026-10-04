import { type ComponentProps, useId } from "react";
import { cn } from "@/shared/ui/utils";

type CheckboxProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  label: string;
  name: string;
  description?: string;
};

// Native checkbox with a visible label and optional helper text. Stays a
// real <input type="checkbox"> so it works inside a plain <form action>
// (value "on" when ticked), with keyboard and screen readers for free.
// Sizing and borders follow the auth text fields (AuthField): 10px radius
// family, border-default, primary focus ring. `className` styles the
// wrapper; every other prop goes to the input.
function Checkbox({
  label,
  name,
  description,
  id,
  className,
  ...props
}: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const descriptionId = `${inputId}-description`;
  return (
    <div
      data-slot="checkbox"
      className={cn("flex items-start gap-3", className)}
    >
      <input
        {...props}
        id={inputId}
        name={name}
        type="checkbox"
        aria-describedby={description ? descriptionId : undefined}
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-[5px] border border-border-default accent-primary-600 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="cursor-pointer text-fg text-sm">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-fg-secondary text-xs">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export { Checkbox };
