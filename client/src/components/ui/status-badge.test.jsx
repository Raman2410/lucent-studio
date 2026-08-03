import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, STATUS_STYLES } from "./status-badge";

describe("StatusBadge", () => {
  it("renders the status text", () => {
    render(<StatusBadge status="Pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it.each(Object.keys(STATUS_STYLES))(
    "applies the mapped style classes for status %s",
    (status) => {
      render(<StatusBadge status={status} />);
      const badge = screen.getByText(status);
      const expectedClass = STATUS_STYLES[status].split(" ")[0];
      expect(badge).toHaveClass(expectedClass);
    }
  );

  it("falls back to a neutral style for an unknown status", () => {
    render(<StatusBadge status="SomethingWeird" />);
    const badge = screen.getByText("SomethingWeird");
    expect(badge).toHaveClass("bg-paper-dim");
  });

  it("merges an additional className", () => {
    render(<StatusBadge status="Completed" className="shrink-0" />);
    expect(screen.getByText("Completed")).toHaveClass("shrink-0");
  });
});
