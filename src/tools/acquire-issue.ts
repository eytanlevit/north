import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { readIssue, writeIssue } from "../issues.js";

const schema = Type.Object({
  issueId: Type.String({ description: "Issue ID (e.g. NOR-001)" }),
  agentName: Type.String({ description: "Name of the agent claiming this issue" }),
  worktree: Type.Optional(Type.String({ description: "Worktree path (e.g. .worktrees/NOR-001)" })),
  tmuxSession: Type.Optional(Type.String({ description: "Tmux session name for this agent" })),
});

export function createAcquireIssueTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "acquire_issue",
    label: "Acquire Issue",
    description: "Claim an issue for an agent. Sets assignee, status to in-progress, and records start time. Fails if already assigned to a different agent.",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const issue = readIssue(cwd, params.issueId);
      if (!issue) {
        throw new Error(`Issue ${params.issueId} not found`);
      }
      if (issue.assignee && issue.assignee !== params.agentName) {
        throw new Error(`Issue already assigned to ${issue.assignee}`);
      }
      issue.assignee = params.agentName;
      issue.started_at = new Date().toISOString();
      issue.status = "in-progress";
      if (params.worktree) issue.worktree = params.worktree;
      if (params.tmuxSession) issue.tmux_session = params.tmuxSession;
      writeIssue(cwd, issue);
      return {
        content: [{ type: "text", text: `Acquired ${params.issueId}: ${issue.title} [assigned to ${params.agentName}]` }],
        details: issue,
      };
    },
  };
}
