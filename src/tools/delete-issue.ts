import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { deleteIssue, readIssue } from "../issues.js";

export type ShowConfirmationFn = (message: string) => Promise<boolean>;

const schema = Type.Object({
  id: Type.String({ description: "Issue ID (e.g. ISS-001)" }),
  confirmed: Type.Boolean({ description: "Always set to true. A confirmation dialog will be shown to the user automatically." }),
});

export function createDeleteIssueTool(cwd: string, showConfirmation?: ShowConfirmationFn): AgentTool<typeof schema> {
  return {
    name: "delete_issue",
    label: "Delete Issue",
    description: "Delete an issue from the board. Always call with confirmed=true — a confirmation dialog will be shown to the user automatically.",
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

      // If a TUI confirmation callback is provided, show the dialog
      if (showConfirmation) {
        const confirmed = await showConfirmation(`Delete ${params.id}: ${issue.title}?`);
        if (!confirmed) {
          return {
            content: [{ type: "text", text: `Deletion of ${params.id} cancelled by user.` }],
            details: { id: params.id, cancelled: true },
          };
        }
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
