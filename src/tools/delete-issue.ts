import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { deleteIssue, readIssue } from "../issues.js";

const schema = Type.Object({
  id: Type.String({ description: "Issue ID (e.g. ISS-001)" }),
  confirmed: Type.Boolean({ description: "Must be true. Always ask the user for confirmation before calling this tool." }),
});

export function createDeleteIssueTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "delete_issue",
    label: "Delete Issue",
    description: "Delete an issue from the board. IMPORTANT: Always ask the user for confirmation before calling this tool. Set confirmed=true only after the user explicitly approves.",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      if (!params.confirmed) {
        return {
          content: [{ type: "text", text: "Please confirm with the user before deleting. Call this tool again with confirmed=true after the user approves." }],
          details: null,
        };
      }
      const issue = readIssue(cwd, params.id);
      if (!issue) {
        throw new Error(`Issue ${params.id} not found`);
      }
      const title = issue.title;
      const deleted = deleteIssue(cwd, params.id);
      if (!deleted) {
        throw new Error(`Failed to delete ${params.id}`);
      }
      return {
        content: [{ type: "text", text: `Deleted ${params.id}: ${title}` }],
        details: { id: params.id, title },
      };
    },
  };
}
