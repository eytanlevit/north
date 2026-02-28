import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { listIssues, type Status } from "../issues.js";

const schema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("todo"), Type.Literal("in-progress"), Type.Literal("done")], { description: "Filter by status" })),
});

export function createListIssuesTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "list_issues",
    label: "List Issues",
    description: "List all issues, optionally filtered by status",
    parameters: schema,
    execute: async (_toolCallId, params) => {
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
