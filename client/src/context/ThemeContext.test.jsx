import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "./ThemeContext";

function Probe() {
  const { theme, isDark, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="isDark">{String(isDark)}</span>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to light when nothing is stored and no OS preference matches", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("isDark")).toHaveTextContent("false");
  });

  it("reads a previously stored theme", () => {
    localStorage.setItem("theme", "dark");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("toggleTheme flips light <-> dark and updates the <html> class", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists the chosen theme to localStorage", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("useTheme throws outside of a ThemeProvider", () => {
    // Silence the expected React error boundary console noise for this case.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useTheme must be used within a ThemeProvider/);
    spy.mockRestore();
  });
});
