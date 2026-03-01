import { describe, it, expect } from "vitest";
import { getCategory } from "../label-category.js";

describe("getCategory", () => {
  it("returns null for undefined", () => {
    expect(getCategory(undefined)).toBe(null);
  });

  it("returns null for empty array", () => {
    expect(getCategory([])).toBe(null);
  });

  it('maps "bug" to bug', () => {
    expect(getCategory(["bug"])).toBe("bug");
  });

  it('maps "enhancement" to feature', () => {
    expect(getCategory(["enhancement"])).toBe("feature");
  });

  it('maps "research" to research', () => {
    expect(getCategory(["research"])).toBe("research");
  });

  it("is case insensitive", () => {
    expect(getCategory(["BUG"])).toBe("bug");
  });

  it("trims whitespace", () => {
    expect(getCategory([" fix "])).toBe("bug");
  });

  it("priority: bug > research > feature", () => {
    expect(getCategory(["feature", "bug"])).toBe("bug");
    expect(getCategory(["feature", "research"])).toBe("research");
    expect(getCategory(["research", "bug"])).toBe("bug");
  });

  it("returns null for unknown labels", () => {
    expect(getCategory(["ux", "chat"])).toBe(null);
  });
});
