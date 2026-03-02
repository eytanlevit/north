import { describe, it, expect } from "vitest";
import { generateClaudeMd } from "../claude-md.js";

describe("generateClaudeMd", () => {
  it("returns a non-empty string", () => {
    const result = generateClaudeMd();
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contains key sections", () => {
    const result = generateClaudeMd();
    expect(result).toContain("## Reading Context");
    expect(result).toContain("## Issue Management");
    expect(result).toContain("## Workflow");
    expect(result).toContain("## Commit Message Convention");
    expect(result).toContain("## Project Structure");
  });

  it("contains CLI command examples", () => {
    const result = generateClaudeMd();
    expect(result).toContain("npx tsx src/cli.ts list");
    expect(result).toContain("npx tsx src/cli.ts show NOR-001");
    expect(result).toContain("npx tsx src/cli.ts create");
    expect(result).toContain("npx tsx src/cli.ts update NOR-001");
    expect(result).toContain("npx tsx src/cli.ts comment NOR-001");
    expect(result).toContain("npx tsx src/cli.ts context NOR-001");
  });

  it("has valid markdown with no unclosed code blocks", () => {
    const result = generateClaudeMd();
    const openingFences = (result.match(/^```/gm) || []).length;
    const closingCount = openingFences; // each ``` toggles open/close
    // Total backtick fences must be even (each opening has a closing)
    expect(openingFences % 2).toBe(0);
  });

  it("starts with a top-level heading", () => {
    const result = generateClaudeMd();
    expect(result.startsWith("# ")).toBe(true);
  });

  it("documents the .pm directory structure", () => {
    const result = generateClaudeMd();
    expect(result).toContain(".north/config.yaml");
    expect(result).toContain(".north/project.md");
    expect(result).toContain(".north/issues/");
    expect(result).toContain(".north/docs/");
    expect(result).toContain(".north/CLAUDE.md");
  });
});
