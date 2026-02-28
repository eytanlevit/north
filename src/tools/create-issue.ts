import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { nextId, writeIssue, type Status, type Priority } from "../issues.js";

const schema = Type.Object({
  title: Type.String({ description: "Issue title" }),
  status: Type.Optional(Type.Union([Type.Literal("todo"), Type.Literal("in-progress"), Type.Literal("done")], { description: "Status (default: todo)" })),
  priority: Type.Optional(Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")], { description: "Priority (default: medium)" })),
  body: Type.Optional(Type.String({ description: "Issue body in markdown" })),
  docs: Type.Optional(Type.Array(Type.String(), { description: "Paths to linked docs relative to .pm/ (e.g. docs/prd.md)" })),
});

export function createCreateIssueTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "create_issue",
    label: "Create Issue",
    description: "Create a new issue on the project board",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const id = nextId(cwd);
      const issue = {
        id,
        title: params.title,
        status: (params.status ?? "todo") as Status,
        priority: (params.priority ?? "medium") as Priority,
        createdAt: new Date().toISOString(),
        body: params.body ?? "",
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
