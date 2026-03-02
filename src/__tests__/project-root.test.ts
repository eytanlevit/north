import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { findProjectRoot } from "../project-root.js";

describe("findProjectRoot", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmtui-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds .pm/ in the current directory", () => {
    fs.mkdirSync(path.join(tmpDir, ".pm"), { recursive: true });
    const result = findProjectRoot({ startDir: tmpDir, gitRoot: () => null });
    expect(result).toBe(tmpDir);
  });

  it("walks up directories to find .pm/", () => {
    fs.mkdirSync(path.join(tmpDir, ".pm"), { recursive: true });
    const nested = path.join(tmpDir, "a", "b", "c");
    fs.mkdirSync(nested, { recursive: true });
    const result = findProjectRoot({ startDir: nested, gitRoot: () => null });
    expect(result).toBe(tmpDir);
  });

  it("throws when no .pm/ directory is found", () => {
    const nested = path.join(tmpDir, "no-pm", "deep");
    fs.mkdirSync(nested, { recursive: true });
    expect(() =>
      findProjectRoot({ startDir: nested, gitRoot: () => null }),
    ).toThrow(/No \.pm\/ directory found/);
  });

  describe("git-root detection", () => {
    it("finds .pm/ at git root from subdirectory", () => {
      // Set up: tmpDir is the "git root" with .pm/
      fs.mkdirSync(path.join(tmpDir, ".pm"), { recursive: true });
      const nested = path.join(tmpDir, "src", "lib", "deep");
      fs.mkdirSync(nested, { recursive: true });

      const result = findProjectRoot({
        startDir: nested,
        gitRoot: () => tmpDir,
      });

      expect(result).toBe(tmpDir);
    });

    it("falls back to walk-up when not in git repo", () => {
      // .pm/ exists in tmpDir but git fails
      fs.mkdirSync(path.join(tmpDir, ".pm"), { recursive: true });
      const nested = path.join(tmpDir, "a", "b");
      fs.mkdirSync(nested, { recursive: true });

      const result = findProjectRoot({
        startDir: nested,
        gitRoot: () => null, // not in a git repo
      });

      expect(result).toBe(tmpDir);
    });

    it("falls back to walk-up when git root has no .pm/", () => {
      // Git root is a different dir that has no .pm/
      const gitRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmtui-git-"));
      // No .pm/ at gitRootDir

      // But .pm/ exists in tmpDir (walk-up target)
      fs.mkdirSync(path.join(tmpDir, ".pm"), { recursive: true });
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

    it("throws when git root has no .pm/ and walk-up also fails", () => {
      const gitRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmtui-git-"));
      const nested = path.join(tmpDir, "no-pm", "deep");
      fs.mkdirSync(nested, { recursive: true });

      expect(() =>
        findProjectRoot({
          startDir: nested,
          gitRoot: () => gitRootDir,
        }),
      ).toThrow(/No \.pm\/ directory found/);

      fs.rmSync(gitRootDir, { recursive: true, force: true });
    });
  });
});
