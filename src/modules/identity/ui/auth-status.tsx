"use client";

import { AnimatePresence, motion } from "motion/react";
import type { AuthFormState } from "./auth-form-state";

// Announces the action outcome. Errors interrupt (alert); success is polite.
// The message eases its height open so the fields below slide, not jump.
export function AuthStatus({ state }: { state: AuthFormState }) {
  const visible = state.status !== "idle" && Boolean(state.message);
  const isError = state.status === "error";
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key={`${state.status}:${state.message}`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <p
            role={isError ? "alert" : "status"}
            className={
              isError
                ? "rounded-input bg-error-50 px-3 py-2 text-error-700 text-sm"
                : "rounded-input bg-success-50 px-3 py-2 text-sm text-success-700"
            }
          >
            {state.message}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
