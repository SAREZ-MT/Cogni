import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merges Tailwind classes without duplicates. Used by every shadcn component.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
