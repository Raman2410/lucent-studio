import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins plain string classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy conditionals", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("resolves conflicting Tailwind utilities, last one wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("keeps non-conflicting utilities from both", () => {
    expect(cn("text-sm font-medium", "text-ink")).toBe("text-sm font-medium text-ink");
  });

  it("supports object-style conditionals", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("returns an empty string for no input", () => {
    expect(cn()).toBe("");
  });
});
