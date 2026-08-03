import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * ThemeToggle — quiet icon button that flips between light and dark
 * mode. Kept visually consistent with the hairline/rounded-full
 * language used for the nav pill in Header.jsx.
 */
export default function ThemeToggle({ className }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        "border border-line text-ink-soft transition-all duration-200",
        "hover:border-signature/40 hover:text-signature hover:bg-paper-dim",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sun className="h-4 w-4" strokeWidth={1.5} />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ opacity: 0, rotate: 90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Moon className="h-4 w-4" strokeWidth={1.5} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
