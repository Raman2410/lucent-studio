import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No bookings yet" description="Go book something." />);
    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
    expect(screen.getByText("Go book something.")).toBeInTheDocument();
  });

  it("renders an icon when provided", () => {
    const { container } = render(<EmptyState icon={CalendarDays} title="Empty" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders no icon wrapper when icon is omitted", () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders the action slot", () => {
    render(<EmptyState title="Empty" action={<button>Do something</button>} />);
    expect(screen.getByRole("button", { name: "Do something" })).toBeInTheDocument();
  });

  it("uses the error tone's icon styling when tone='error'", () => {
    const { container } = render(<EmptyState icon={CalendarDays} title="Failed" tone="error" />);
    expect(container.querySelector(".bg-red-50")).toBeInTheDocument();
  });
});
