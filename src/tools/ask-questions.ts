import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const schema = Type.Object({
  questions: Type.Array(Type.String(), { description: "List of clarifying questions to ask the user" }),
  context: Type.Optional(Type.String({ description: "Brief context for why these questions are being asked" })),
});

export function createAskQuestionsTool(): AgentTool<typeof schema> {
  return {
    name: "ask_questions",
    label: "Ask Questions",
    description: "Ask the user clarifying questions before creating or updating issues. Use this when requirements are vague or you need more information.",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const lines: string[] = [];
      if (params.context) {
        lines.push(`**${params.context}**`, "");
      }
      params.questions.forEach((q, i) => {
        lines.push(`${i + 1}. ${q}`);
      });
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { questions: params.questions },
      };
    },
  };
}
