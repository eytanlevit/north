import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { nextId, writeIssue, type Status, type Priority } from "../issues.js";
import type { ProjectConfig } from "../config.js";

const schema = Type.Object({
  title: Type.String({ description: "Issue title" }),
  status: Type.Optional(Type.String({ description: "Status (default: first configured status). Valid values come from project config." })),
  priority: Type.Optional(Type.String({ description: "Priority (default: second configured priority or first). Valid values come from project config." })),
  body: Type.Optional(Type.String({ description: "Issue body in markdown" })),
  parent: Type.Optional(Type.String({ description: "Parent issue ID (e.g. ISS-001)" })),
  blocked_by: Type.Optional(Type.Array(Type.String(), { description: "Issue IDs that block this issue" })),
  labels: Type.Optional(Type.Array(Type.String(), { description: "Labels (e.g. auth, backend)" })),
  docs: Type.Optional(Type.Array(Type.String(), { description: "Paths to linked docs relative to .pm/ (e.g. docs/prd.md)" })),
});

export function createCreateIssueTool(cwd: string, config: ProjectConfig): AgentTool<typeof schema> {
  return {
    name: "create_issue",
    label: "Create Issue",
    description: `Create a new issue on the project board. Valid statuses: ${config.statuses.join(", ")}. Valid priorities: ${config.priorities.join(", ")}.`,
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const status = (params.status ?? config.statuses[0]) as Status;
      const priority = (params.priority ?? config.priorities[1] ?? config.priorities[0]) as Priority;

      if (!config.statuses.includes(status)) {
        throw new Error(`Invalid status "${status}". Valid statuses: ${config.statuses.join(", ")}`);
      }
      if (!config.priorities.includes(priority)) {
        throw new Error(`Invalid priority "${priority}". Valid priorities: ${config.priorities.join(", ")}`);
      }

      const id = nextId(cwd, config.prefix);
      const issue = {
        id,
        title: params.title,
        status,
        priority,
        createdAt: new Date().toISOString(),
        body: params.body ?? "",
        parent: params.parent,
        blocked_by: params.blocked_by,
        labels: params.labels,
        ...(params.docs ? { docs: params.docs } : {}),
      };
      writeIssue(cwd, issue);
      return {
        content: [{ type: "text", text: `Created issue ${id}: ${issue.title}` }],
        details: issue,
      };
    },
  };
}
