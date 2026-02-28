import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { listIssues, type Status } from "../issues.js";
import type { ProjectConfig } from "../config.js";

const schema = Type.Object({
  status: Type.Optional(Type.String({ description: "Filter by status. Valid values come from project config." })),
});

export function createListIssuesTool(cwd: string, config: ProjectConfig): AgentTool<typeof schema> {
  return {
    name: "list_issues",
    label: "List Issues",
    description: `List all issues, optionally filtered by status. Valid statuses: ${config.statuses.join(", ")}.`,
    parameters: schema,
    execute: async (_toolCallId, params) => {
      if (params.status && !config.statuses.includes(params.status)) {
        throw new Error(`Invalid status "${params.status}". Valid statuses: ${config.statuses.join(", ")}`);
      }
      const filter = params.status ? { status: params.status as Status } : undefined;
      const issues = listIssues(cwd, filter);
      if (issues.length === 0) {
        return {
          content: [{ type: "text", text: "No issues found." }],
          details: [],
        };
      }
      const lines = issues.map((i) => `- [${i.priority[0].toUpperCase()}] ${i.id} ${i.title} (${i.status})`);
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: issues,
      };
    },
  };
}
