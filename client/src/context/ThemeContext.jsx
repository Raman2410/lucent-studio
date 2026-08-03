import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "theme";

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

/**
 * ThemeProvider — single source of truth for light/dark mode.
 * Persists the choice to localStorage, falls back to the OS-level
 * `prefers-color-scheme` on first visit, and mirrors changes across
 * tabs. The `.dark` class it toggles on <html> drives every color
 * token defined in index.css, so most components need no changes —
 * only the CSS variables they already reference do.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getPreferredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore — theme still applies for this session
    }
  }, [theme]);

  // Follow the OS setting live, but only if the user hasn't made an
  // explicit choice yet (nothing stored).
  useEffect(() => {
    let stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    if (stored) return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Mirror the choice across tabs.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
