import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { KanbanPane } from "../components/kanban-pane.js";
import { writeIssue, type Issue } from "../issues.js";

/** Create a temp dir with test issues */
function setupTestDir(issues: Partial<Issue>[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pmtui-test-"));
  for (const partial of issues) {
    const issue: Issue = {
      id: partial.id ?? "ISS-001",
      title: partial.title ?? "Test issue",
      status: partial.status ?? "todo",
      priority: partial.priority ?? "medium",
      createdAt: partial.createdAt ?? "2025-01-01",
      body: partial.body ?? "",
    };
    writeIssue(dir, issue);
  }
  return dir;
}

function cleanupDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("KanbanPane scrolling", () => {
  let tmpDir: string;
  let pane: KanbanPane;

  // Stub terminal height for predictable viewport
  const originalRows = process.stdout.rows;

  afterEach(() => {
    if (tmpDir) cleanupDir(tmpDir);
    Object.defineProperty(process.stdout, "rows", {
      value: originalRows,
      writable: true,
      configurable: true,
    });
  });

  function createPaneWithIssues(issues: Partial<Issue>[]): KanbanPane {
    tmpDir = setupTestDir(issues);
    const p = new KanbanPane(tmpDir);
    p.focused = true;
    return p;
  }

  describe("cursor movement", () => {
    beforeEach(() => {
      pane = createPaneWithIssues([
        { id: "ISS-001", title: "First", status: "todo", priority: "high" },
        { id: "ISS-002", title: "Second", status: "todo", priority: "medium" },
        { id: "ISS-003", title: "Third", status: "in-progress", priority: "low" },
      ]);
      // Large viewport so scrolling doesn't interfere
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });
    });

    it("starts with cursor at index 0", () => {
      const selected = pane.getSelectedIssue();
      expect(selected).not.toBeNull();
      expect(selected!.id).toBe("ISS-001");
    });

    it("moves cursor down with j", () => {
      pane.handleInput("j");
      expect(pane.getSelectedIssue()!.id).toBe("ISS-002");
    });

    it("moves cursor down with down arrow", () => {
      pane.handleInput("\x1b[B"); // down arrow escape sequence
      expect(pane.getSelectedIssue()!.id).toBe("ISS-002");
    });

    it("moves cursor up with k", () => {
      pane.handleInput("j"); // go to ISS-002
      pane.handleInput("k"); // back to ISS-001
      expect(pane.getSelectedIssue()!.id).toBe("ISS-001");
    });

    it("moves cursor up with up arrow", () => {
      pane.handleInput("j");
      pane.handleInput("\x1b[A"); // up arrow
      expect(pane.getSelectedIssue()!.id).toBe("ISS-001");
    });

    it("navigates across sections", () => {
      // ISS-001 (todo), ISS-002 (todo), ISS-003 (in-progress)
      pane.handleInput("j"); // ISS-002
      pane.handleInput("j"); // ISS-003
      expect(pane.getSelectedIssue()!.id).toBe("ISS-003");
      expect(pane.getSelectedIssue()!.status).toBe("in-progress");
    });
  });

  describe("cursor boundary clamping", () => {
    beforeEach(() => {
      pane = createPaneWithIssues([
        { id: "ISS-001", title: "Only issue", status: "todo", priority: "high" },
      ]);
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });
    });

    it("clamps cursor at top (cannot go above 0)", () => {
      pane.handleInput("k"); // try to go up from 0
      expect(pane.getSelectedIssue()!.id).toBe("ISS-001");
    });

    it("clamps cursor at bottom (cannot exceed issue count)", () => {
      pane.handleInput("j"); // try to go past the only issue
      expect(pane.getSelectedIssue()!.id).toBe("ISS-001");
    });
  });

  describe("getSelectedIssue", () => {
    it("returns null when there are no issues", () => {
      pane = createPaneWithIssues([]);
      expect(pane.getSelectedIssue()).toBeNull();
    });

    it("returns the correct issue after multiple moves", () => {
      pane = createPaneWithIssues([
        { id: "ISS-001", title: "A", status: "todo", priority: "high" },
        { id: "ISS-002", title: "B", status: "todo", priority: "medium" },
        { id: "ISS-003", title: "C", status: "todo", priority: "low" },
      ]);
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });
      pane.handleInput("j"); // ISS-002
      pane.handleInput("j"); // ISS-003
      const issue = pane.getSelectedIssue();
      expect(issue).not.toBeNull();
      expect(issue!.id).toBe("ISS-003");
      expect(issue!.title).toBe("C");
    });
  });

  describe("scroll offset", () => {
    it("adjusts scroll when cursor goes below viewport", () => {
      // Create enough issues to overflow a small viewport
      const issues: Partial<Issue>[] = [];
      for (let i = 1; i <= 20; i++) {
        issues.push({
          id: `ISS-${String(i).padStart(3, "0")}`,
          title: `Issue ${i}`,
          status: "todo",
          priority: "medium",
        });
      }
      pane = createPaneWithIssues(issues);
      pane.focused = true;
      // Small viewport: header (2 lines) + blank + section header + 20 issues = 24 lines
      // Viewport = 5 lines means scrolling kicks in quickly
      Object.defineProperty(process.stdout, "rows", {
        value: 6,
        writable: true,
        configurable: true,
      });

      // Render initially
      const lines = pane.render(40);
      // Should return exactly 6 lines (5 viewport + 1 indicator)
      expect(lines.length).toBe(6);

      // Move cursor down several times past the viewport
      for (let i = 0; i < 10; i++) {
        pane.handleInput("j");
      }
      const linesAfter = pane.render(40);
      expect(linesAfter.length).toBe(6);

      // The selected issue should be ISS-011 (index 10)
      expect(pane.getSelectedIssue()!.id).toBe("ISS-011");
    });
  });

  describe("render with focus", () => {
    it("shows cursor indicator when focused", () => {
      pane = createPaneWithIssues([
        { id: "ISS-001", title: "Test", status: "todo", priority: "medium" },
      ]);
      pane.focused = true;
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });
      const lines = pane.render(40);
      // The selected issue line should contain the cursor indicator
      const issueLineStr = lines.join("\n");
      expect(issueLineStr).toContain("▸");
    });

    it("does not show cursor indicator when not focused", () => {
      pane = createPaneWithIssues([
        { id: "ISS-001", title: "Test", status: "todo", priority: "medium" },
      ]);
      pane.focused = false;
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });
      const lines = pane.render(40);
      const issueLineStr = lines.join("\n");
      expect(issueLineStr).not.toContain("▸");
    });
  });

  describe("refresh clamps cursor", () => {
    it("clamps cursor when issues are removed", () => {
      // Start with 3 issues, cursor on third
      tmpDir = setupTestDir([
        { id: "ISS-001", title: "A", status: "todo", priority: "high" },
        { id: "ISS-002", title: "B", status: "todo", priority: "medium" },
        { id: "ISS-003", title: "C", status: "todo", priority: "low" },
      ]);
      pane = new KanbanPane(tmpDir);
      pane.focused = true;
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });

      pane.handleInput("j"); // ISS-002
      pane.handleInput("j"); // ISS-003
      expect(pane.getSelectedIssue()!.id).toBe("ISS-003");

      // Delete ISS-002 and ISS-003
      fs.unlinkSync(path.join(tmpDir, ".pm", "issues", "ISS-002.md"));
      fs.unlinkSync(path.join(tmpDir, ".pm", "issues", "ISS-003.md"));

      pane.refresh();
      // Cursor should clamp to the only remaining issue
      expect(pane.getSelectedIssue()!.id).toBe("ISS-001");
    });
  });
});
