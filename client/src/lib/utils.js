import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely — clsx handles conditionals,
 * twMerge resolves conflicting utility classes (e.g. px-2 vs px-4)
 * so the last one applied always wins, as expected.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
