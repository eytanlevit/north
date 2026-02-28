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
    const result = findProjectRoot(tmpDir);
    expect(result).toBe(tmpDir);
  });

  it("walks up directories to find .pm/", () => {
    fs.mkdirSync(path.join(tmpDir, ".pm"), { recursive: true });
    const nested = path.join(tmpDir, "a", "b", "c");
    fs.mkdirSync(nested, { recursive: true });
    const result = findProjectRoot(nested);
    expect(result).toBe(tmpDir);
  });

  it("throws when no .pm/ directory is found", () => {
    // tmpDir has no .pm/ and we start from a deep nested dir
    const nested = path.join(tmpDir, "no-pm", "deep");
    fs.mkdirSync(nested, { recursive: true });
    // To avoid accidentally finding a real .pm/ above tmpDir,
    // we test that it throws from a dir that definitely won't have one
    // (unless the test machine happens to have one near root)
    expect(() => findProjectRoot(nested)).toThrow(/No \.pm\/ directory found/);
  });
});
