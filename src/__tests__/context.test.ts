import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildContext, formatContext, formatContextJson, type ContextResult } from "../context.js";
import { writeIssue, type Issue } from "../issues.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "north-test-"));
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "NOR-001",
    title: "Test issue",
    status: "todo",
    priority: "medium",
    createdAt: "2026-01-01T00:00:00.000Z",
    body: "Test body",
    ...overrides,
  };
}

function writeProjectMd(cwd: string, content: string): void {
  const pmDir = path.join(cwd, ".north");
  fs.mkdirSync(pmDir, { recursive: true });
  fs.writeFileSync(path.join(pmDir, "project.md"), content, "utf-8");
}

function writeDoc(cwd: string, relPath: string, content: string): void {
  const fullPath = path.join(cwd, ".north", relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

describe("buildContext", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = makeTmpDir();
  });

  it("returns basic issue context with no blockers or docs", () => {
    const issue = makeIssue();
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.issue.id).toBe("NOR-001");
    expect(result.issue.title).toBe("Test issue");
    expect(result.issue.body).toBe("Test body");
    expect(result.project).toBeUndefined();
    expect(result.blockingIssues).toBeUndefined();
    expect(result.linkedDocs).toBeUndefined();
    expect(result.parentIssue).toBeUndefined();
  });

  it("throws when issue does not exist", () => {
    expect(() => buildContext({ cwd, issueId: "NOR-999" })).toThrow(
      "Issue NOR-999 not found"
    );
  });

  it("includes project.md content when it exists", () => {
    writeProjectMd(cwd, "# My Project\n\nThis is the project description.");
    const issue = makeIssue();
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.project).toBe("# My Project\n\nThis is the project description.");
  });

  it("skips project when project.md does not exist", () => {
    const issue = makeIssue();
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.project).toBeUndefined();
  });

  it("includes blocking issue details", () => {
    const blocker = makeIssue({
      id: "NOR-002",
      title: "Blocker issue",
      status: "in-progress",
    });
    writeIssue(cwd, blocker);

    const issue = makeIssue({ blocked_by: ["NOR-002"] });
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.blockingIssues).toHaveLength(1);
    const b = result.blockingIssues![0];
    expect("title" in b).toBe(true);
    if ("title" in b) {
      expect(b.id).toBe("NOR-002");
      expect(b.title).toBe("Blocker issue");
      expect(b.status).toBe("in-progress");
    }
  });

  it("handles missing blocked_by references gracefully", () => {
    const issue = makeIssue({ blocked_by: ["NOR-999"] });
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.blockingIssues).toHaveLength(1);
    const b = result.blockingIssues![0];
    expect("error" in b).toBe(true);
    if ("error" in b) {
      expect(b.id).toBe("NOR-999");
      expect(b.error).toBe("not found");
    }
  });

  it("includes linked doc contents", () => {
    writeDoc(cwd, "docs/prd.md", "# PRD\n\nProduct requirements.");
    writeDoc(cwd, "docs/schema.md", "# Schema\n\nDB schema details.");

    const issue = makeIssue({ docs: ["docs/prd.md", "docs/schema.md"] });
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.linkedDocs).toHaveLength(2);
    expect(result.linkedDocs![0].path).toBe("docs/prd.md");
    expect(result.linkedDocs![0].content).toBe("# PRD\n\nProduct requirements.");
    expect(result.linkedDocs![1].path).toBe("docs/schema.md");
    expect(result.linkedDocs![1].content).toBe("# Schema\n\nDB schema details.");
  });

  it("handles missing docs gracefully", () => {
    const issue = makeIssue({ docs: ["docs/missing.md"] });
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.linkedDocs).toHaveLength(1);
    expect(result.linkedDocs![0].path).toBe("docs/missing.md");
    expect(result.linkedDocs![0].content).toBe("[not found]");
  });

  it("includes parent issue when present", () => {
    const parent = makeIssue({
      id: "NOR-010",
      title: "Epic parent",
      status: "in-progress",
    });
    writeIssue(cwd, parent);

    const issue = makeIssue({ parent: "NOR-010" });
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.parentIssue).toBeDefined();
    expect("title" in result.parentIssue!).toBe(true);
    if ("title" in result.parentIssue!) {
      expect(result.parentIssue.id).toBe("NOR-010");
      expect(result.parentIssue.title).toBe("Epic parent");
    }
  });

  it("handles missing parent gracefully", () => {
    const issue = makeIssue({ parent: "NOR-999" });
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.parentIssue).toBeDefined();
    expect("error" in result.parentIssue!).toBe(true);
    if ("error" in result.parentIssue!) {
      expect(result.parentIssue.id).toBe("NOR-999");
      expect(result.parentIssue.error).toBe("not found");
    }
  });

  it("handles issue with comments", () => {
    const issue = makeIssue({
      comments: [
        { author: "alice", date: "2026-01-02", body: "Looks good" },
        { author: "bob", date: "2026-01-03", body: "Agreed" },
      ],
    });
    writeIssue(cwd, issue);

    const result = buildContext({ cwd, issueId: "NOR-001" });

    expect(result.issue.comments).toHaveLength(2);
    expect(result.issue.comments![0].author).toBe("alice");
    expect(result.issue.comments![1].body).toBe("Agreed");
  });
});

describe("formatContext", () => {
  it("produces expected text sections for a basic issue", () => {
    const result: ContextResult = {
      issue: makeIssue(),
    };

    const text = formatContext(result);

    expect(text).toContain("# Issue: NOR-001");
    expect(text).toContain("**Title:** Test issue");
    expect(text).toContain("**Status:** todo");
    expect(text).toContain("**Priority:** medium");
    expect(text).toContain("Test body");
    expect(text).not.toContain("# Project");
    expect(text).not.toContain("# Blocking Issues");
    expect(text).not.toContain("# Linked Docs");
  });

  it("includes all sections when present", () => {
    const result: ContextResult = {
      project: "My project description",
      issue: makeIssue({
        comments: [{ author: "alice", date: "2026-01-02", body: "A comment" }],
      }),
      parentIssue: makeIssue({ id: "NOR-010", title: "Parent" }),
      blockingIssues: [
        makeIssue({ id: "NOR-002", title: "Blocker", status: "in-progress" }),
        { id: "NOR-003", error: "not found" },
      ],
      linkedDocs: [
        { path: "docs/prd.md", content: "PRD content" },
        { path: "docs/missing.md", content: "[not found]" },
      ],
    };

    const text = formatContext(result);

    expect(text).toContain("# Project");
    expect(text).toContain("My project description");
    expect(text).toContain("# Issue: NOR-001");
    expect(text).toContain("## Comments");
    expect(text).toContain("**alice** (2026-01-02):");
    expect(text).toContain("A comment");
    expect(text).toContain("# Parent Issue");
    expect(text).toContain("NOR-010");
    expect(text).toContain("# Blocking Issues");
    expect(text).toContain("NOR-002");
    expect(text).toContain("Blocker");
    expect(text).toContain("NOR-003: not found");
    expect(text).toContain("# Linked Docs");
    expect(text).toContain("## docs/prd.md");
    expect(text).toContain("PRD content");
    expect(text).toContain("[not found]");
  });

  it("uses --- separators between sections", () => {
    const result: ContextResult = {
      project: "Proj",
      issue: makeIssue(),
    };

    const text = formatContext(result);
    expect(text).toContain("---");
  });
});

describe("formatContextJson", () => {
  it("produces valid JSON", () => {
    const result: ContextResult = {
      project: "My project",
      issue: makeIssue(),
      blockingIssues: [{ id: "NOR-002", error: "not found" }],
      linkedDocs: [{ path: "docs/prd.md", content: "PRD" }],
    };

    const jsonStr = formatContextJson(result);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.project).toBe("My project");
    expect(parsed.issue.id).toBe("NOR-001");
    expect(parsed.blockingIssues[0].id).toBe("NOR-002");
    expect(parsed.blockingIssues[0].error).toBe("not found");
    expect(parsed.linkedDocs[0].path).toBe("docs/prd.md");
  });

  it("round-trips through JSON.parse", () => {
    const result: ContextResult = {
      issue: makeIssue({ docs: ["docs/a.md"] }),
    };

    const jsonStr = formatContextJson(result);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.issue.docs).toEqual(["docs/a.md"]);
  });
});
