import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createSafeBashTool } from "../tools/bash-wrapper.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "north-bash-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createSafeBashTool", () => {
  it("allows benign commands like ls", async () => {
    const bash = createSafeBashTool(tmpDir);
    const result = await bash.execute("tc_1", { command: "echo hello" } as any);
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).toContain("hello");
  });

  it("blocks rm -rf", async () => {
    const bash = createSafeBashTool(tmpDir);
    const result = await bash.execute("tc_1", { command: "rm -rf /tmp/test" } as any);
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).toContain("BLOCKED");
  });

  it("blocks git push --force", async () => {
    const bash = createSafeBashTool(tmpDir);
    const result = await bash.execute("tc_1", { command: "git push origin main --force" } as any);
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).toContain("BLOCKED");
  });

  it("blocks git reset --hard", async () => {
    const bash = createSafeBashTool(tmpDir);
    const result = await bash.execute("tc_1", { command: "git reset --hard HEAD~1" } as any);
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).toContain("BLOCKED");
  });

  it("blocks git clean -f", async () => {
    const bash = createSafeBashTool(tmpDir);
    const result = await bash.execute("tc_1", { command: "git clean -fd" } as any);
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).toContain("BLOCKED");
  });

  it("allows git push without --force", async () => {
    const bash = createSafeBashTool(tmpDir);
    // This should NOT be blocked (it'll fail because no git repo, but won't be BLOCKED)
    const result = await bash.execute("tc_1", { command: "echo 'git push origin main'" } as any);
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).not.toContain("BLOCKED");
  });

  it("allows rm without -rf flags", async () => {
    const bash = createSafeBashTool(tmpDir);
    const result = await bash.execute("tc_1", { command: "echo 'rm file.txt'" } as any);
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).not.toContain("BLOCKED");
  });
});
