import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { readIssue, writeIssue, type Status, type Priority } from "../issues.js";

const schema = Type.Object({
  id: Type.String({ description: "Issue ID (e.g. ISS-001)" }),
  title: Type.Optional(Type.String({ description: "New title" })),
  status: Type.Optional(Type.Union([Type.Literal("todo"), Type.Literal("in-progress"), Type.Literal("done")], { description: "New status" })),
  priority: Type.Optional(Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")], { description: "New priority" })),
  body: Type.Optional(Type.String({ description: "New body" })),
});

export function createUpdateIssueTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "update_issue",
    label: "Update Issue",
    description: "Update an existing issue's title, status, priority, or body",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const issue = readIssue(cwd, params.id);
      if (!issue) {
        throw new Error(`Issue ${params.id} not found`);
      }
      if (params.title !== undefined) issue.title = params.title;
      if (params.status !== undefined) issue.status = params.status as Status;
      if (params.priority !== undefined) issue.priority = params.priority as Priority;
      if (params.body !== undefined) issue.body = params.body;
      writeIssue(cwd, issue);
      return {
        content: [{ type: "text", text: `Updated ${params.id}: ${issue.title} [${issue.status}]` }],
        details: issue,
      };
    },
  };
}
