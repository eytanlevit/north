import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeIssue, readIssue, nextId, type Issue } from "../issues.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmtui-issues-cfg-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("custom statuses", () => {
  it("writes and reads back issues with custom statuses", () => {
    const issue: Issue = {
      id: "TSK-001",
      title: "Custom status issue",
      status: "review",
      priority: "medium",
      createdAt: "2025-01-01T00:00:00.000Z",
      body: "Testing custom status",
    };

    writeIssue(tmpDir, issue);
    const loaded = readIssue(tmpDir, "TSK-001");

    expect(loaded).not.toBeNull();
    expect(loaded!.status).toBe("review");
    expect(loaded!.title).toBe("Custom status issue");
    expect(loaded!.body).toBe("Testing custom status");
  });
});

describe("custom priorities", () => {
  it("writes and reads back issues with custom priorities", () => {
    const issue: Issue = {
      id: "ISS-001",
      title: "Custom priority issue",
      status: "todo",
      priority: "critical",
      createdAt: "2025-01-01T00:00:00.000Z",
      body: "Testing custom priority",
    };

    writeIssue(tmpDir, issue);
    const loaded = readIssue(tmpDir, "ISS-001");

    expect(loaded).not.toBeNull();
    expect(loaded!.priority).toBe("critical");
  });
});

describe("format_version backward compat", () => {
  it("parses old issues without format_version", () => {
    const dir = path.join(tmpDir, ".pm", "issues");
    fs.mkdirSync(dir, { recursive: true });

    // Write an old-format issue file (no format_version)
    const oldFormat = [
      "---",
      "id: ISS-001",
      "title: Old issue",
      "status: todo",
      "priority: high",
      "createdAt: \"2024-06-01T00:00:00.000Z\"",
      "---",
      "Old body content",
      "",
    ].join("\n");

    fs.writeFileSync(path.join(dir, "ISS-001.md"), oldFormat, "utf-8");

    const issue = readIssue(tmpDir, "ISS-001");
    expect(issue).not.toBeNull();
    expect(issue!.id).toBe("ISS-001");
    expect(issue!.title).toBe("Old issue");
    expect(issue!.status).toBe("todo");
    expect(issue!.priority).toBe("high");
    expect(issue!.body).toBe("Old body content");
  });

  it("parses issues with format_version and strips it", () => {
    const dir = path.join(tmpDir, ".pm", "issues");
    fs.mkdirSync(dir, { recursive: true });

    const newFormat = [
      "---",
      "format_version: 1",
      "id: ISS-002",
      "title: New issue",
      "status: done",
      "priority: low",
      "createdAt: \"2025-01-01T00:00:00.000Z\"",
      "---",
      "New body",
      "",
    ].join("\n");

    fs.writeFileSync(path.join(dir, "ISS-002.md"), newFormat, "utf-8");

    const issue = readIssue(tmpDir, "ISS-002");
    expect(issue).not.toBeNull();
    expect(issue!.id).toBe("ISS-002");
    expect(issue!.title).toBe("New issue");
    // format_version should not appear on the Issue object
    expect((issue as unknown as Record<string, unknown>)["format_version"]).toBeUndefined();
  });

  it("newly serialized issues include format_version", () => {
    const issue: Issue = {
      id: "ISS-003",
      title: "Serialized issue",
      status: "todo",
      priority: "medium",
      createdAt: "2025-01-01T00:00:00.000Z",
      body: "Test body",
    };

    writeIssue(tmpDir, issue);

    const raw = fs.readFileSync(
      path.join(tmpDir, ".pm", "issues", "ISS-003.md"),
      "utf-8",
    );
    expect(raw).toContain("format_version: 1");
  });
});

describe("nextId with custom prefix", () => {
  it("generates IDs with custom prefix", () => {
    const id = nextId(tmpDir, "TASK");
    expect(id).toBe("TASK-001");
  });

  it("increments correctly with custom prefix", () => {
    const dir = path.join(tmpDir, ".pm", "issues");
    fs.mkdirSync(dir, { recursive: true });

    // Create a couple issues with custom prefix
    fs.writeFileSync(path.join(dir, "PROJ-001.md"), "---\nid: PROJ-001\ntitle: a\nstatus: todo\npriority: high\ncreatedAt: x\n---\n", "utf-8");
    fs.writeFileSync(path.join(dir, "PROJ-005.md"), "---\nid: PROJ-005\ntitle: b\nstatus: todo\npriority: high\ncreatedAt: x\n---\n", "utf-8");

    const id = nextId(tmpDir, "PROJ");
    expect(id).toBe("PROJ-006");
  });

  it("defaults to ISS prefix when none provided", () => {
    const id = nextId(tmpDir);
    expect(id).toBe("ISS-001");
  });
});
