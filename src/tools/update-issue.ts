import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { readIssue, writeIssue, type Status, type Priority } from "../issues.js";
import type { ProjectConfig } from "../config.js";

const schema = Type.Object({
  id: Type.String({ description: "Issue ID (e.g. ISS-001)" }),
  title: Type.Optional(Type.String({ description: "New title" })),
  status: Type.Optional(Type.String({ description: "New status. Valid values come from project config." })),
  priority: Type.Optional(Type.String({ description: "New priority. Valid values come from project config." })),
  body: Type.Optional(Type.String({ description: "New body" })),
});

export function createUpdateIssueTool(cwd: string, config: ProjectConfig): AgentTool<typeof schema> {
  return {
    name: "update_issue",
    label: "Update Issue",
    description: `Update an existing issue's title, status, priority, or body. Valid statuses: ${config.statuses.join(", ")}. Valid priorities: ${config.priorities.join(", ")}.`,
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const issue = readIssue(cwd, params.id);
      if (!issue) {
        throw new Error(`Issue ${params.id} not found`);
      }
      if (params.status !== undefined) {
        if (!config.statuses.includes(params.status)) {
          throw new Error(`Invalid status "${params.status}". Valid statuses: ${config.statuses.join(", ")}`);
        }
        issue.status = params.status as Status;
      }
      if (params.priority !== undefined) {
        if (!config.priorities.includes(params.priority)) {
          throw new Error(`Invalid priority "${params.priority}". Valid priorities: ${config.priorities.join(", ")}`);
        }
        issue.priority = params.priority as Priority;
      }
      if (params.title !== undefined) issue.title = params.title;
      if (params.body !== undefined) issue.body = params.body;
      writeIssue(cwd, issue);
      return {
        content: [{ type: "text", text: `Updated ${params.id}: ${issue.title} [${issue.status}]` }],
        details: issue,
      };
    },
  };
}
