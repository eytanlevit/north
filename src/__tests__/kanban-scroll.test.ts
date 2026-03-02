import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { KanbanPane } from "../components/kanban-pane.js";
import { writeIssue, type Issue } from "../issues.js";

/** Create a temp dir with test issues */
function setupTestDir(issues: Partial<Issue>[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "north-test-"));
  for (const partial of issues) {
    const issue: Issue = {
      id: partial.id ?? "NOR-001",
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
        { id: "NOR-001", title: "First", status: "todo", priority: "high" },
        { id: "NOR-002", title: "Second", status: "todo", priority: "medium" },
        { id: "NOR-003", title: "Third", status: "in-progress", priority: "low" },
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
      expect(selected!.id).toBe("NOR-001");
    });

    it("moves cursor down with j", () => {
      pane.handleInput("j");
      expect(pane.getSelectedIssue()!.id).toBe("NOR-002");
    });

    it("moves cursor down with down arrow", () => {
      pane.handleInput("\x1b[B"); // down arrow escape sequence
      expect(pane.getSelectedIssue()!.id).toBe("NOR-002");
    });

    it("moves cursor up with k", () => {
      pane.handleInput("j"); // go to NOR-002
      pane.handleInput("k"); // back to NOR-001
      expect(pane.getSelectedIssue()!.id).toBe("NOR-001");
    });

    it("moves cursor up with up arrow", () => {
      pane.handleInput("j");
      pane.handleInput("\x1b[A"); // up arrow
      expect(pane.getSelectedIssue()!.id).toBe("NOR-001");
    });

    it("navigates across sections", () => {
      // NOR-001 (todo), NOR-002 (todo), NOR-003 (in-progress)
      pane.handleInput("j"); // NOR-002
      pane.handleInput("j"); // NOR-003
      expect(pane.getSelectedIssue()!.id).toBe("NOR-003");
      expect(pane.getSelectedIssue()!.status).toBe("in-progress");
    });
  });

  describe("cursor boundary clamping", () => {
    beforeEach(() => {
      pane = createPaneWithIssues([
        { id: "NOR-001", title: "Only issue", status: "todo", priority: "high" },
      ]);
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });
    });

    it("clamps cursor at top (cannot go above 0)", () => {
      pane.handleInput("k"); // try to go up from 0
      expect(pane.getSelectedIssue()!.id).toBe("NOR-001");
    });

    it("clamps cursor at bottom (cannot exceed issue count)", () => {
      pane.handleInput("j"); // try to go past the only issue
      expect(pane.getSelectedIssue()!.id).toBe("NOR-001");
    });
  });

  describe("getSelectedIssue", () => {
    it("returns null when there are no issues", () => {
      pane = createPaneWithIssues([]);
      expect(pane.getSelectedIssue()).toBeNull();
    });

    it("returns the correct issue after multiple moves", () => {
      pane = createPaneWithIssues([
        { id: "NOR-001", title: "A", status: "todo", priority: "high" },
        { id: "NOR-002", title: "B", status: "todo", priority: "medium" },
        { id: "NOR-003", title: "C", status: "todo", priority: "low" },
      ]);
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });
      pane.handleInput("j"); // NOR-002
      pane.handleInput("j"); // NOR-003
      const issue = pane.getSelectedIssue();
      expect(issue).not.toBeNull();
      expect(issue!.id).toBe("NOR-003");
      expect(issue!.title).toBe("C");
    });
  });

  describe("scroll offset", () => {
    it("adjusts scroll when cursor goes below viewport", () => {
      // Create enough issues to overflow a small viewport
      const issues: Partial<Issue>[] = [];
      for (let i = 1; i <= 20; i++) {
        issues.push({
          id: `NOR-${String(i).padStart(3, "0")}`,
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

      // The selected issue should be NOR-011 (index 10)
      expect(pane.getSelectedIssue()!.id).toBe("NOR-011");
    });
  });

  describe("render with focus", () => {
    it("shows cursor indicator when focused", () => {
      pane = createPaneWithIssues([
        { id: "NOR-001", title: "Test", status: "todo", priority: "medium" },
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
        { id: "NOR-001", title: "Test", status: "todo", priority: "medium" },
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

  describe("mouse scroll via scrollBy", () => {
    // 20 issues, viewport = 6 (5 visible + 1 indicator)
    const VIEWPORT_ROWS = 6;
    const ISSUE_COUNT = 20;

    beforeEach(() => {
      const issues: Partial<Issue>[] = [];
      for (let i = 1; i <= ISSUE_COUNT; i++) {
        issues.push({
          id: `NOR-${String(i).padStart(3, "0")}`,
          title: `Issue ${i}`,
          status: "todo",
          priority: "medium",
        });
      }
      pane = createPaneWithIssues(issues);
      pane.focused = true;
      Object.defineProperty(process.stdout, "rows", {
        value: VIEWPORT_ROWS,
        writable: true,
        configurable: true,
      });
      // Initial render to populate issueLineIndices and lastLinesCount
      pane.render(40);
    });

    it("scrollBy down doesn't snap back to cursor", () => {
      // Cursor stays at NOR-001 (line ~4). Scroll down by 5.
      pane.scrollBy(5);
      const lines = pane.render(40);
      // After scrolling, NOR-001 should NOT be visible (it's above viewport)
      const joined = lines.join("\n");
      expect(joined).not.toContain("NOR-001");
    });

    it("scrollBy repeatedly reaches last issue", () => {
      // Scroll down aggressively — should eventually show NOR-020
      for (let i = 0; i < 30; i++) {
        pane.scrollBy(3);
        pane.render(40);
      }
      const lines = pane.render(40);
      const joined = lines.join("\n");
      expect(joined).toContain("NOR-020");
    });

    it("scrollBy clamps at max offset", () => {
      // Scroll way past the end
      for (let i = 0; i < 50; i++) {
        pane.scrollBy(5);
        pane.render(40);
      }
      const lines = pane.render(40);
      const joined = lines.join("\n");
      // Should show last issue visible
      expect(joined).toContain("NOR-020");
      // Repeated scrollBy beyond max shouldn't crash or change output
      pane.scrollBy(100);
      const lines2 = pane.render(40);
      expect(lines2.join("\n")).toContain("NOR-020");
    });

    it("keyboard j/k works after mouse scroll", () => {
      // Scroll down via mouse
      pane.scrollBy(10);
      pane.render(40);

      // Now use keyboard to navigate — cursor should move sequentially
      const before = pane.getSelectedIssue();
      pane.handleInput("j");
      const after = pane.getSelectedIssue();
      expect(after).not.toBeNull();
      // Cursor should have moved to a different issue
      expect(after!.id).not.toBe(before!.id);
    });

    it("last issue fully visible at viewport bottom", () => {
      // Navigate cursor all the way to the last issue
      for (let i = 0; i < ISSUE_COUNT - 1; i++) {
        pane.handleInput("j");
      }
      expect(pane.getSelectedIssue()!.id).toBe("NOR-020");

      const lines = pane.render(40);
      const joined = lines.join("\n");
      // NOR-020 must be visible in the viewport
      expect(joined).toContain("NOR-020");
    });
  });

  describe("refresh clamps cursor", () => {
    it("clamps cursor when issues are removed", () => {
      // Start with 3 issues, cursor on third
      tmpDir = setupTestDir([
        { id: "NOR-001", title: "A", status: "todo", priority: "high" },
        { id: "NOR-002", title: "B", status: "todo", priority: "medium" },
        { id: "NOR-003", title: "C", status: "todo", priority: "low" },
      ]);
      pane = new KanbanPane(tmpDir);
      pane.focused = true;
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });

      pane.handleInput("j"); // NOR-002
      pane.handleInput("j"); // NOR-003
      expect(pane.getSelectedIssue()!.id).toBe("NOR-003");

      // Delete NOR-002 and NOR-003
      fs.unlinkSync(path.join(tmpDir, ".north", "issues", "NOR-002.md"));
      fs.unlinkSync(path.join(tmpDir, ".north", "issues", "NOR-003.md"));

      pane.refresh();
      // Cursor should clamp to the only remaining issue
      expect(pane.getSelectedIssue()!.id).toBe("NOR-001");
    });
  });
});
