import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { findProjectRoot } from "../project-root.js";

describe("findProjectRoot", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "north-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds .north/ in the current directory", () => {
    fs.mkdirSync(path.join(tmpDir, ".north"), { recursive: true });
    const result = findProjectRoot({ startDir: tmpDir, gitRoot: () => null });
    expect(result).toBe(tmpDir);
  });

  it("walks up directories to find .north/", () => {
    fs.mkdirSync(path.join(tmpDir, ".north"), { recursive: true });
    const nested = path.join(tmpDir, "a", "b", "c");
    fs.mkdirSync(nested, { recursive: true });
    const result = findProjectRoot({ startDir: nested, gitRoot: () => null });
    expect(result).toBe(tmpDir);
  });

  it("throws when no .north/ directory is found", () => {
    const nested = path.join(tmpDir, "no-pm", "deep");
    fs.mkdirSync(nested, { recursive: true });
    expect(() =>
      findProjectRoot({ startDir: nested, gitRoot: () => null }),
    ).toThrow(/No \.north\/ directory found/);
  });

  describe("git-root detection", () => {
    it("finds .north/ at git root from subdirectory", () => {
      // Set up: tmpDir is the "git root" with .north/
      fs.mkdirSync(path.join(tmpDir, ".north"), { recursive: true });
      const nested = path.join(tmpDir, "src", "lib", "deep");
      fs.mkdirSync(nested, { recursive: true });

      const result = findProjectRoot({
        startDir: nested,
        gitRoot: () => tmpDir,
      });

      expect(result).toBe(tmpDir);
    });

    it("falls back to walk-up when not in git repo", () => {
      // .north/ exists in tmpDir but git fails
      fs.mkdirSync(path.join(tmpDir, ".north"), { recursive: true });
      const nested = path.join(tmpDir, "a", "b");
      fs.mkdirSync(nested, { recursive: true });

      const result = findProjectRoot({
        startDir: nested,
        gitRoot: () => null, // not in a git repo
      });

      expect(result).toBe(tmpDir);
    });

    it("falls back to walk-up when git root has no .north/", () => {
      // Git root is a different dir that has no .north/
      const gitRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "north-git-"));
      // No .north/ at gitRootDir

      // But .north/ exists in tmpDir (walk-up target)
      fs.mkdirSync(path.join(tmpDir, ".north"), { recursive: true });
      const nested = path.join(tmpDir, "src");
      fs.mkdirSync(nested, { recursive: true });

      const result = findProjectRoot({
        startDir: nested,
        gitRoot: () => gitRootDir,
      });

      expect(result).toBe(tmpDir);

      // cleanup extra tmpDir
      fs.rmSync(gitRootDir, { recursive: true, force: true });
    });

    it("throws when git root has no .north/ and walk-up also fails", () => {
      const gitRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "north-git-"));
      const nested = path.join(tmpDir, "no-pm", "deep");
      fs.mkdirSync(nested, { recursive: true });

      expect(() =>
        findProjectRoot({
          startDir: nested,
          gitRoot: () => gitRootDir,
        }),
      ).toThrow(/No \.north\/ directory found/);

      fs.rmSync(gitRootDir, { recursive: true, force: true });
    });
  });
});
