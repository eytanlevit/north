import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeIssue, readIssue, type Issue } from "../issues.js";
import { createAcquireIssueTool } from "../tools/acquire-issue.js";
import { createCompleteIssueTool } from "../tools/complete-issue.js";

describe("agent lifecycle", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmtui-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeIssue(overrides?: Partial<Issue>): Issue {
    return {
      id: "PMT-001",
      title: "Test issue",
      status: "todo",
      priority: "medium",
      createdAt: "2026-01-01T00:00:00.000Z",
      body: "Some body text",
      ...overrides,
    };
  }

  describe("acquire_issue", () => {
    it("sets assignee, status, and started_at", async () => {
      writeIssue(tmpDir, makeIssue());
      const tool = createAcquireIssueTool(tmpDir);
      await tool.execute("call-1", {
        issueId: "PMT-001",
        agentName: "agent-work-1",
      });

      const issue = readIssue(tmpDir, "PMT-001")!;
      expect(issue.assignee).toBe("agent-work-1");
      expect(issue.status).toBe("in-progress");
      expect(issue.started_at).toBeDefined();
      // Verify started_at is a valid ISO date
      expect(new Date(issue.started_at!).toISOString()).toBe(issue.started_at);
    });

    it("sets optional worktree and tmux_session", async () => {
      writeIssue(tmpDir, makeIssue());
      const tool = createAcquireIssueTool(tmpDir);
      await tool.execute("call-1", {
        issueId: "PMT-001",
        agentName: "agent-work-1",
        worktree: ".worktrees/PMT-001",
        tmuxSession: "PMT-001",
      });

      const issue = readIssue(tmpDir, "PMT-001")!;
      expect(issue.worktree).toBe(".worktrees/PMT-001");
      expect(issue.tmux_session).toBe("PMT-001");
    });

    it("throws if already assigned to different agent", async () => {
      writeIssue(tmpDir, makeIssue({ assignee: "agent-work-1" }));
      const tool = createAcquireIssueTool(tmpDir);
      await expect(
        tool.execute("call-1", {
          issueId: "PMT-001",
          agentName: "agent-work-2",
        }),
      ).rejects.toThrow("Issue already assigned to agent-work-1");
    });

    it("allows re-acquire by same agent", async () => {
      writeIssue(tmpDir, makeIssue({ assignee: "agent-work-1" }));
      const tool = createAcquireIssueTool(tmpDir);
      const result = await tool.execute("call-1", {
        issueId: "PMT-001",
        agentName: "agent-work-1",
      });
      expect(result.content[0].text).toContain("PMT-001");
    });

    it("throws if issue does not exist", async () => {
      const tool = createAcquireIssueTool(tmpDir);
      await expect(
        tool.execute("call-1", {
          issueId: "PMT-999",
          agentName: "agent-work-1",
        }),
      ).rejects.toThrow("Issue PMT-999 not found");
    });
  });

  describe("complete_issue", () => {
    it("sets status to done and adds comment with summary", async () => {
      writeIssue(tmpDir, makeIssue({ status: "in-progress", assignee: "agent-work-1" }));
      const tool = createCompleteIssueTool(tmpDir);
      await tool.execute("call-1", {
        issueId: "PMT-001",
        summary: "Implemented the feature and added tests",
      });

      const issue = readIssue(tmpDir, "PMT-001")!;
      expect(issue.status).toBe("done");
      expect(issue.comments).toHaveLength(1);
      expect(issue.comments![0].body).toBe("Implemented the feature and added tests");
      expect(issue.comments![0].author).toBe("agent-work-1");
    });

    it("uses 'agent' as comment author when no assignee set", async () => {
      writeIssue(tmpDir, makeIssue({ status: "in-progress" }));
      const tool = createCompleteIssueTool(tmpDir);
      await tool.execute("call-1", {
        issueId: "PMT-001",
        summary: "Done",
      });

      const issue = readIssue(tmpDir, "PMT-001")!;
      expect(issue.comments![0].author).toBe("agent");
    });

    it("throws if issue does not exist", async () => {
      const tool = createCompleteIssueTool(tmpDir);
      await expect(
        tool.execute("call-1", {
          issueId: "PMT-999",
          summary: "Done",
        }),
      ).rejects.toThrow("Issue PMT-999 not found");
    });
  });

  describe("YAML round-trip preserves new fields", () => {
    it("preserves assignee, started_at, worktree, and tmux_session", () => {
      const original = makeIssue({
        assignee: "agent-work-1",
        started_at: "2026-03-01T18:30:00.000Z",
        worktree: ".worktrees/PMT-001",
        tmux_session: "PMT-001",
      });
      writeIssue(tmpDir, original);
      const reloaded = readIssue(tmpDir, "PMT-001")!;
      expect(reloaded.assignee).toBe("agent-work-1");
      expect(reloaded.started_at).toBe("2026-03-01T18:30:00.000Z");
      expect(reloaded.worktree).toBe(".worktrees/PMT-001");
      expect(reloaded.tmux_session).toBe("PMT-001");
    });
  });
});
