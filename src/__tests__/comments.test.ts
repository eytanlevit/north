import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeIssue, readIssue, addComment, type Issue, type Comment } from "../issues.js";

describe("comments", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmtui-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeIssue(overrides?: Partial<Issue>): Issue {
    return {
      id: "ISS-001",
      title: "Test issue",
      status: "todo",
      priority: "medium",
      createdAt: "2026-01-01T00:00:00.000Z",
      body: "Some body text",
      ...overrides,
    };
  }

  it("adds a comment to an issue", () => {
    writeIssue(tmpDir, makeIssue());
    const comment: Comment = { author: "alice", date: "2026-02-28T12:00:00.000Z", body: "Looks good" };
    const updated = addComment(tmpDir, "ISS-001", comment);
    expect(updated.comments).toHaveLength(1);
    expect(updated.comments![0]).toEqual(comment);
  });

  it("adds multiple comments and preserves order", () => {
    writeIssue(tmpDir, makeIssue());
    const c1: Comment = { author: "alice", date: "2026-02-28T12:00:00.000Z", body: "First" };
    const c2: Comment = { author: "bob", date: "2026-02-28T13:00:00.000Z", body: "Second" };
    addComment(tmpDir, "ISS-001", c1);
    const updated = addComment(tmpDir, "ISS-001", c2);
    expect(updated.comments).toHaveLength(2);
    expect(updated.comments![0].body).toBe("First");
    expect(updated.comments![1].body).toBe("Second");
  });

  it("comments survive round-trip (write + read)", () => {
    const comment: Comment = { author: "alice", date: "2026-02-28T12:00:00.000Z", body: "Persisted" };
    writeIssue(tmpDir, makeIssue());
    addComment(tmpDir, "ISS-001", comment);
    const reloaded = readIssue(tmpDir, "ISS-001");
    expect(reloaded).not.toBeNull();
    expect(reloaded!.comments).toHaveLength(1);
    expect(reloaded!.comments![0]).toEqual(comment);
  });

  it("throws when adding comment to non-existent issue", () => {
    const comment: Comment = { author: "alice", date: "2026-02-28T12:00:00.000Z", body: "Nope" };
    expect(() => addComment(tmpDir, "ISS-999", comment)).toThrow("Issue ISS-999 not found");
  });
});
