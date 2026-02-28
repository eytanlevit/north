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
      const lines = [
        `# ${issue.id}: ${issue.title}`,
        `**Status:** ${issue.status}  **Priority:** ${issue.priority}`,
        `**Created:** ${issue.createdAt}`,
      ];

      if (issue.labels?.length) {
        lines.push(`**Labels:** ${issue.labels.map((l) => `[${l}]`).join(" ")}`);
      }
      if (issue.parent) {
        lines.push(`**Parent:** ${issue.parent}`);
      }
      if (issue.blocked_by?.length) {
        lines.push(`**Blocked by:** ${issue.blocked_by.join(", ")}`);
      }

      lines.push("", issue.body || "_No description_");

      if (issue.comments?.length) {
        lines.push("", "---", "## Comments");
        for (const c of issue.comments) {
          lines.push("", `**${c.author}** (${c.date})`, c.body);
        }
      }

      const text = lines.join("\n");
      return {
        content: [{ type: "text", text }],
        details: issue,
      };
    },
  };
}
