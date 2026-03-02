import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { readIssue, writeIssue, addComment } from "../issues.js";

const schema = Type.Object({
  issueId: Type.String({ description: "Issue ID (e.g. NOR-001)" }),
  summary: Type.String({ description: "Completion summary describing what was done" }),
});

export function createCompleteIssueTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "complete_issue",
    label: "Complete Issue",
    description: "Mark an issue as done and add a completion summary comment.",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const issue = readIssue(cwd, params.issueId);
      if (!issue) {
        throw new Error(`Issue ${params.issueId} not found`);
      }
      // Set status to done and write first
      issue.status = "done";
      writeIssue(cwd, issue);
      // Then add comment (addComment reads fresh, so it picks up status=done)
      const author = issue.assignee ?? "agent";
      const updated = addComment(cwd, params.issueId, {
        author,
        date: new Date().toISOString(),
        body: params.summary,
      });
      return {
        content: [{ type: "text", text: `Completed ${params.issueId}: ${updated.title} [done]` }],
        details: updated,
      };
    },
  };
}
