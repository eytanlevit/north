import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { addComment } from "../issues.js";

const schema = Type.Object({
  id: Type.String({ description: "Issue ID (e.g. ISS-001)" }),
  body: Type.String({ description: "Comment text" }),
  author: Type.Optional(Type.String({ description: "Comment author (default: user)" })),
});

export function createAddCommentTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "add_comment",
    label: "Add Comment",
    description: "Add a comment to an existing issue",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const comment = {
        author: params.author ?? "user",
        date: new Date().toISOString(),
        body: params.body,
      };
      const issue = addComment(cwd, params.id, comment);
      return {
        content: [{ type: "text", text: `Added comment to ${params.id} by ${comment.author}` }],
        details: issue,
      };
    },
  };
}
