import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter } from "react-router-dom";
import { Button } from "./button";

describe("Button", () => {
  it("renders children as a button by default", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe("BUTTON");
  });

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies variant classes", () => {
    render(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-ink");
  });

  it("applies size classes", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9");
  });

  it("merges a custom className without dropping variant classes", () => {
    render(<Button className="mt-4">Styled</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("mt-4");
    expect(btn).toHaveClass("bg-ink");
  });

  it("asChild clones the single child element instead of wrapping it in a <button>", () => {
    render(
      <MemoryRouter>
        <Button asChild variant="signature">
          <Link to="/packages">Browse packages</Link>
        </Button>
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: "Browse packages" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveClass("bg-signature");
  });
});
