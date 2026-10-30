"use client";

import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import type * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/shared/ui/button";

const MotionButton = motion.create(Button);

type SubmitButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  | "type"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
> & {
  // Explicit pending flag (e.g. from useActionState); the enclosing form's
  // own status (useFormStatus) also counts, so plain server-action forms get
  // the loading state for free.
  pending?: boolean;
};

// Form submit button with a pressed scale (design system: scale 0.98) and a
// loading state. The label never changes, so its accessible name is stable;
// aria-busy and a spinner announce the wait.
function SubmitButton({
  pending = false,
  disabled,
  className,
  children,
  ...props
}: SubmitButtonProps) {
  const status = useFormStatus();
  const busy = pending || status.pending;
  return (
    <MotionButton
      type="submit"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", bounce: 0, visualDuration: 0.15 }}
      className={className}
      {...props}
    >
      {busy && (
        <Loader2
          data-slot="spinner"
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      )}
      {children}
    </MotionButton>
  );
}

export { SubmitButton };
