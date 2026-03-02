import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { watchIssueDir, onIssueChange } from "../issues.js";

describe("watchIssueDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "north-watcher-test-"));
    fs.mkdirSync(path.join(tmpDir, ".north", "issues"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fires onIssueChange when a file is created externally", async () => {
    let changeCount = 0;
    const unsub = onIssueChange(() => {
      changeCount++;
    });
    const stopWatcher = watchIssueDir(tmpDir);

    // Small delay to let fs.watch initialize
    await new Promise((r) => setTimeout(r, 100));

    // Write a file externally (simulating another process)
    fs.writeFileSync(
      path.join(tmpDir, ".north", "issues", "EXT-001.md"),
      "---\nid: EXT-001\ntitle: External\n---\n",
      "utf-8",
    );

    // Poll for change (debounce 200ms + fs.watch latency)
    const deadline = Date.now() + 2000;
    while (changeCount === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(changeCount).toBeGreaterThanOrEqual(1);

    unsub();
    stopWatcher();
  });

  it("returns a no-op cleanup when directory does not exist", () => {
    const stopWatcher = watchIssueDir("/tmp/nonexistent-north-dir-xyz");
    // Should not throw
    stopWatcher();
  });
});
