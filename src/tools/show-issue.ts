import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { readIssue } from "../issues.js";

const schema = Type.Object({
  id: Type.String({ description: "Issue ID (e.g. ISS-001)" }),
});

export function createShowIssueTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "show_issue",
    label: "Show Issue",
    description: "Show full details of an issue",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const issue = readIssue(cwd, params.id);
      if (!issue) {
        throw new Error(`Issue ${params.id} not found`);
      }
      const text = [
        `# ${issue.id}: ${issue.title}`,
        `**Status:** ${issue.status}  **Priority:** ${issue.priority}`,
        `**Created:** ${issue.createdAt}`,
        "",
        issue.body || "_No description_",
      ].join("\n");
      return {
        content: [{ type: "text", text }],
        details: issue,
      };
    },
  };
}
