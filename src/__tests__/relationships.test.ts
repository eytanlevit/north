import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeIssue, readIssue, validateRelationships, type Issue } from "../issues.js";

describe("relationships", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "north-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeIssue(overrides?: Partial<Issue>): Issue {
    return {
      id: "NOR-001",
      title: "Test issue",
      status: "todo",
      priority: "medium",
      createdAt: "2026-01-01T00:00:00.000Z",
      body: "Body",
      ...overrides,
    };
  }

  it("parent field round-trips through write/read", () => {
    writeIssue(tmpDir, makeIssue({ id: "NOR-002", parent: "NOR-001" }));
    const reloaded = readIssue(tmpDir, "NOR-002");
    expect(reloaded).not.toBeNull();
    expect(reloaded!.parent).toBe("NOR-001");
  });

  it("blocked_by field round-trips through write/read", () => {
    writeIssue(tmpDir, makeIssue({ blocked_by: ["NOR-002", "NOR-003"] }));
    const reloaded = readIssue(tmpDir, "NOR-001");
    expect(reloaded!.blocked_by).toEqual(["NOR-002", "NOR-003"]);
  });

  it("labels field round-trips through write/read", () => {
    writeIssue(tmpDir, makeIssue({ labels: ["auth", "backend"] }));
    const reloaded = readIssue(tmpDir, "NOR-001");
    expect(reloaded!.labels).toEqual(["auth", "backend"]);
  });

  it("issues without new fields still parse correctly (backward compat)", () => {
    // Write a minimal issue file directly (no optional fields)
    const dir = path.join(tmpDir, ".north", "issues");
    fs.mkdirSync(dir, { recursive: true });
    const content = `---
id: NOR-001
title: Old issue
status: todo
priority: low
createdAt: "2026-01-01T00:00:00.000Z"
---
Old body
`;
    fs.writeFileSync(path.join(dir, "NOR-001.md"), content, "utf-8");
    const issue = readIssue(tmpDir, "NOR-001");
    expect(issue).not.toBeNull();
    expect(issue!.id).toBe("NOR-001");
    expect(issue!.comments).toBeUndefined();
    expect(issue!.parent).toBeUndefined();
    expect(issue!.blocked_by).toBeUndefined();
    expect(issue!.labels).toBeUndefined();
  });

  it("undefined optional fields are not written to YAML", () => {
    writeIssue(tmpDir, makeIssue());
    const dir = path.join(tmpDir, ".north", "issues");
    const raw = fs.readFileSync(path.join(dir, "NOR-001.md"), "utf-8");
    expect(raw).not.toContain("comments");
    expect(raw).not.toContain("parent");
    expect(raw).not.toContain("blocked_by");
    expect(raw).not.toContain("labels");
  });

  it("validateRelationships catches references to non-existent issues", () => {
    writeIssue(tmpDir, makeIssue({ id: "NOR-001" }));
    const issue = makeIssue({ id: "NOR-002", parent: "NOR-999", blocked_by: ["NOR-888"] });
    writeIssue(tmpDir, issue);
    const errors = validateRelationships(tmpDir, issue);
    expect(errors).toContain("Parent NOR-999 does not exist");
    expect(errors).toContain("Blocked-by reference NOR-888 does not exist");
  });

  it("validateRelationships detects circular blocked_by", () => {
    writeIssue(tmpDir, makeIssue({ id: "NOR-001", blocked_by: ["NOR-002"] }));
    const issueB = makeIssue({ id: "NOR-002", blocked_by: ["NOR-001"] });
    writeIssue(tmpDir, issueB);
    const errors = validateRelationships(tmpDir, issueB);
    expect(errors.some((e) => e.includes("Circular"))).toBe(true);
  });

  it("validateRelationships returns empty array when all references valid", () => {
    writeIssue(tmpDir, makeIssue({ id: "NOR-001" }));
    const issueB = makeIssue({ id: "NOR-002", parent: "NOR-001", blocked_by: ["NOR-001"] });
    writeIssue(tmpDir, issueB);
    const errors = validateRelationships(tmpDir, issueB);
    expect(errors).toEqual([]);
  });
});
