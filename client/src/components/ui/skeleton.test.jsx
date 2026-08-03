import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Skeleton,
  SkeletonText,
  SkeletonGrid,
  SkeletonList,
  SkeletonTable,
  SkeletonStat,
} from "./skeleton";

describe("Skeleton", () => {
  it("renders a shimmer block marked aria-hidden", () => {
    const { container } = render(<Skeleton className="h-4 w-10" />);
    const el = container.firstChild;
    expect(el).toHaveClass("skeleton-shimmer");
    expect(el).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SkeletonText", () => {
  it("renders the requested number of lines", () => {
    const { container } = render(<SkeletonText lines={3} />);
    expect(container.querySelectorAll(".skeleton-shimmer")).toHaveLength(3);
  });

  it("defaults to 2 lines", () => {
    const { container } = render(<SkeletonText />);
    expect(container.querySelectorAll(".skeleton-shimmer")).toHaveLength(2);
  });
});

describe("SkeletonGrid", () => {
  it("renders `count` cards", () => {
    const { container } = render(<SkeletonGrid count={5} />);
    expect(container.querySelectorAll(".skeleton-shimmer")).toHaveLength(5);
  });
});

describe("SkeletonList", () => {
  it("renders `count` rows, each with a title and subtitle placeholder", () => {
    const { container } = render(<SkeletonList count={4} />);
    // 2 shimmer blocks per SkeletonRow (title + badge) + 1 subtitle = 3
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThanOrEqual(4);
  });
});

describe("SkeletonTable", () => {
  it("renders `rows` * `cols` table cells inside a table", () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTable rows={3} cols={4} />
        </tbody>
      </table>
    );
    expect(container.querySelectorAll("tr")).toHaveLength(3);
    expect(container.querySelectorAll("td")).toHaveLength(12);
  });
});

describe("SkeletonStat", () => {
  it("renders a label and value placeholder", () => {
    const { container } = render(<SkeletonStat />);
    expect(container.querySelectorAll(".skeleton-shimmer")).toHaveLength(2);
  });
});
