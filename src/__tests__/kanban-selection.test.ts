import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { KanbanPane } from "../components/kanban-pane.js";
import { writeIssue, type Issue } from "../issues.js";

let tmpDir: string;

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "NOR-001",
    title: "First issue",
    status: "todo",
    priority: "high",
    createdAt: "2026-02-28",
    body: "",
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "north-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function setupIssues(issues: Issue[]): void {
  for (const issue of issues) {
    writeIssue(tmpDir, issue);
  }
}

/** Strip ANSI escape codes */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b_[^\x07]*\x07/g, "");
}

describe("KanbanPane selection", () => {
  it("getSelectedIssue returns first issue by default", () => {
    setupIssues([
      makeIssue({ id: "NOR-001", title: "First", status: "todo" }),
      makeIssue({ id: "NOR-002", title: "Second", status: "todo" }),
    ]);
    const pane = new KanbanPane(tmpDir);
    const selected = pane.getSelectedIssue();
    expect(selected).not.toBeNull();
    expect(selected!.id).toBe("NOR-001");
  });

  it("getSelectedIssue returns null when no issues exist", () => {
    const pane = new KanbanPane(tmpDir);
    expect(pane.getSelectedIssue()).toBeNull();
  });

  it("cursor navigation moves through issues", () => {
    setupIssues([
      makeIssue({ id: "NOR-001", title: "First", status: "todo" }),
      makeIssue({ id: "NOR-002", title: "Second", status: "todo" }),
      makeIssue({ id: "NOR-003", title: "Third", status: "in-progress" }),
    ]);
    const pane = new KanbanPane(tmpDir);

    // Initial selection is first issue
    expect(pane.getSelectedIssue()!.id).toBe("NOR-001");

    // Move down
    pane.handleInput("j");
    expect(pane.getSelectedIssue()!.id).toBe("NOR-002");

    // Move down again - crosses into next section
    pane.handleInput("j");
    expect(pane.getSelectedIssue()!.id).toBe("NOR-003");

    // Move up
    pane.handleInput("k");
    expect(pane.getSelectedIssue()!.id).toBe("NOR-002");
  });

  it("cursor does not go below the last issue", () => {
    setupIssues([
      makeIssue({ id: "NOR-001", title: "Only", status: "todo" }),
    ]);
    const pane = new KanbanPane(tmpDir);

    pane.handleInput("j");
    pane.handleInput("j");
    pane.handleInput("j");
    expect(pane.getSelectedIssue()!.id).toBe("NOR-001");
  });

  it("cursor does not go above the first issue", () => {
    setupIssues([
      makeIssue({ id: "NOR-001", title: "Only", status: "todo" }),
    ]);
    const pane = new KanbanPane(tmpDir);

    pane.handleInput("k");
    pane.handleInput("k");
    expect(pane.getSelectedIssue()!.id).toBe("NOR-001");
  });

  it("Enter triggers onSelectIssue callback with the selected issue", () => {
    setupIssues([
      makeIssue({ id: "NOR-001", title: "First", status: "todo" }),
      makeIssue({ id: "NOR-002", title: "Second", status: "todo" }),
    ]);
    const pane = new KanbanPane(tmpDir);
    const callback = vi.fn();
    pane.onSelectIssue = callback;

    // Move to second issue and press Enter
    pane.handleInput("j");
    pane.handleInput("\r"); // Enter key

    expect(callback).toHaveBeenCalledOnce();
    expect(callback.mock.calls[0][0].id).toBe("NOR-002");
  });

  it("Enter does nothing when no issues exist", () => {
    const pane = new KanbanPane(tmpDir);
    const callback = vi.fn();
    pane.onSelectIssue = callback;

    pane.handleInput("\r");
    expect(callback).not.toHaveBeenCalled();
  });

  it("shows selection indicator when focused", () => {
    setupIssues([
      makeIssue({ id: "NOR-001", title: "First", status: "todo" }),
      makeIssue({ id: "NOR-002", title: "Second", status: "todo" }),
    ]);
    const pane = new KanbanPane(tmpDir);
    pane.focused = true;

    const lines = pane.render(60);
    const plainLines = lines.map(stripAnsi);

    // The selected issue (first one) should have the selection indicator
    const selectedLine = plainLines.find((l) => l.includes("\u25B8") && l.includes("NOR-001"));
    expect(selectedLine).toBeDefined();

    // The non-selected issue should not have the selection indicator
    const otherLine = plainLines.find((l) => l.includes("NOR-002"));
    expect(otherLine).toBeDefined();
    // NOR-002 line should not have the selection indicator
    expect(otherLine!.includes("\u25B8") && otherLine!.includes("NOR-002")).toBe(false);
  });

  it("getAllIssues returns issues in section order", () => {
    setupIssues([
      makeIssue({ id: "NOR-001", status: "done" }),
      makeIssue({ id: "NOR-002", status: "todo" }),
      makeIssue({ id: "NOR-003", status: "in-progress" }),
    ]);
    const pane = new KanbanPane(tmpDir);
    const all = pane.getAllIssues();

    // Order should be: todo, in-progress, done (matching SECTIONS order)
    expect(all[0].id).toBe("NOR-002"); // todo
    expect(all[1].id).toBe("NOR-003"); // in-progress
    expect(all[2].id).toBe("NOR-001"); // done
  });

  it("refresh clamps cursor when issues are removed", () => {
    setupIssues([
      makeIssue({ id: "NOR-001", status: "todo" }),
      makeIssue({ id: "NOR-002", status: "todo" }),
      makeIssue({ id: "NOR-003", status: "todo" }),
    ]);
    const pane = new KanbanPane(tmpDir);

    // Move cursor to last issue
    pane.handleInput("j");
    pane.handleInput("j");
    expect(pane.getSelectedIssue()!.id).toBe("NOR-003");

    // Remove some issues and refresh
    fs.unlinkSync(path.join(tmpDir, ".north", "issues", "NOR-002.md"));
    fs.unlinkSync(path.join(tmpDir, ".north", "issues", "NOR-003.md"));
    pane.refresh();

    // Cursor should be clamped to last available issue
    const selected = pane.getSelectedIssue();
    expect(selected).not.toBeNull();
    expect(selected!.id).toBe("NOR-001");
  });
});
