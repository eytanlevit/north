import { describe, it, expect, vi } from "vitest";
import { IssueDetailView } from "../components/issue-detail.js";
import type { Issue } from "../issues.js";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "ISS-001",
    title: "Implement login page",
    status: "todo",
    priority: "high",
    createdAt: "2026-02-28",
    body: "Build the login page with email and password fields.",
    ...overrides,
  };
}

/** Strip ANSI escape codes for easier assertion */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b_[^\x07]*\x07/g, "");
}

describe("IssueDetailView", () => {
  it("renders the issue ID in the top border", () => {
    const view = new IssueDetailView(makeIssue());
    const lines = view.render(60);
    const topLine = stripAnsi(lines[0]);
    expect(topLine).toContain("ISS-001");
  });

  it("renders the issue title", () => {
    const view = new IssueDetailView(makeIssue({ title: "Fix auth bug" }));
    const lines = view.render(60);
    const allText = lines.map(stripAnsi).join("\n");
    expect(allText).toContain("Fix auth bug");
  });

  it("renders status and priority", () => {
    const view = new IssueDetailView(
      makeIssue({ status: "in-progress", priority: "medium" })
    );
    const lines = view.render(60);
    const allText = lines.map(stripAnsi).join("\n");
    expect(allText).toContain("Status:");
    expect(allText).toContain("in-progress");
    expect(allText).toContain("Priority:");
    expect(allText).toContain("medium");
  });

  it("renders body content", () => {
    const view = new IssueDetailView(
      makeIssue({ body: "This is the detailed description of the issue." })
    );
    const lines = view.render(80);
    const allText = lines.map(stripAnsi).join("\n");
    expect(allText).toContain("Description");
    expect(allText).toContain("This is the detailed description of the issue.");
  });

  it("shows 'No description' when body is empty", () => {
    const view = new IssueDetailView(makeIssue({ body: "" }));
    const lines = view.render(60);
    const allText = lines.map(stripAnsi).join("\n");
    expect(allText).toContain("No description");
  });

  it("renders created date", () => {
    const view = new IssueDetailView(
      makeIssue({ createdAt: "2026-01-15" })
    );
    const lines = view.render(60);
    const allText = lines.map(stripAnsi).join("\n");
    expect(allText).toContain("Created:");
    expect(allText).toContain("2026-01-15");
  });

  it("renders keyboard shortcut footer", () => {
    const view = new IssueDetailView(makeIssue());
    const lines = view.render(60);
    const allText = lines.map(stripAnsi).join("\n");
    expect(allText).toContain("[Esc] Close");
    expect(allText).toContain("[j/k] Scroll");
  });

  it("renders bottom border", () => {
    const view = new IssueDetailView(makeIssue());
    const lines = view.render(60);
    // Find the line with the bottom border
    const bottomBorder = lines.map(stripAnsi).find((l) => l.includes("└") && l.includes("┘"));
    expect(bottomBorder).toBeDefined();
  });

  describe("scrolling", () => {
    function makeLongIssue(): Issue {
      const longBody = Array.from({ length: 100 }, (_, i) => `Line ${i + 1} of the description.`).join("\n");
      return makeIssue({ body: longBody });
    }

    it("scroll down changes visible content", () => {
      // Use a small terminal height to force scrolling
      const origRows = process.stdout.rows;
      Object.defineProperty(process.stdout, "rows", { value: 15, configurable: true });
      try {
        const view = new IssueDetailView(makeLongIssue());
        const linesBefore = view.render(60).map(stripAnsi).join("\n");

        // Simulate pressing 'j' multiple times
        view.handleInput("j");
        view.handleInput("j");
        view.handleInput("j");
        const linesAfter = view.render(60).map(stripAnsi).join("\n");

        expect(linesBefore).not.toEqual(linesAfter);
      } finally {
        Object.defineProperty(process.stdout, "rows", { value: origRows, configurable: true });
      }
    });

    it("scroll up from offset returns to previous content", () => {
      const origRows = process.stdout.rows;
      Object.defineProperty(process.stdout, "rows", { value: 15, configurable: true });
      try {
        const view = new IssueDetailView(makeLongIssue());
        const initial = view.render(60).map(stripAnsi).join("\n");

        // Scroll down then back up
        view.handleInput("j");
        view.handleInput("j");
        view.handleInput("k");
        view.handleInput("k");
        const afterRoundTrip = view.render(60).map(stripAnsi).join("\n");

        expect(afterRoundTrip).toEqual(initial);
      } finally {
        Object.defineProperty(process.stdout, "rows", { value: origRows, configurable: true });
      }
    });

    it("scroll up does not go below zero", () => {
      const view = new IssueDetailView(makeIssue());
      // Scroll up from the top - should not crash
      view.handleInput("k");
      view.handleInput("k");
      const lines = view.render(60);
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe("close callback", () => {
    it("Esc triggers onClose callback", () => {
      const onClose = vi.fn();
      const view = new IssueDetailView(makeIssue(), onClose);

      // Simulate Escape key
      view.handleInput("\x1b");
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("other keys do not trigger onClose", () => {
      const onClose = vi.fn();
      const view = new IssueDetailView(makeIssue(), onClose);

      view.handleInput("j");
      view.handleInput("k");
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
