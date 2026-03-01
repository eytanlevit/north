import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";

// Types
export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  markdown?: string;
}

export interface Question {
  id: string;
  label: string;
  prompt: string;
  options: QuestionOption[];
  allowOther: boolean;
}

export interface Answer {
  id: string;
  value: string;
  label: string;
  wasCustom: boolean;
  index?: number;
}

export interface QuestionnaireResult {
  questions: Question[];
  answers: Answer[];
  cancelled: boolean;
}

export type ShowQuestionnaireFn = (
  questions: Question[],
  signal?: AbortSignal,
) => Promise<QuestionnaireResult>;

// Schema
const QuestionOptionSchema = Type.Object({
  value: Type.String({ description: "The value returned when selected" }),
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(Type.String({ description: "Optional description shown below label" })),
  markdown: Type.Optional(Type.String({ description: "ASCII preview content shown beside the option" })),
});

const QuestionSchema = Type.Object({
  id: Type.String({ description: "Unique identifier for this question" }),
  label: Type.Optional(
    Type.String({ description: "Short label for tab bar, e.g. 'Scope', 'Priority' (defaults to Q1, Q2)" }),
  ),
  prompt: Type.String({ description: "The full question text to display" }),
  options: Type.Array(QuestionOptionSchema, { description: "Available options to choose from" }),
  allowOther: Type.Optional(Type.Boolean({ description: "Allow 'Type something' option (default: true)" })),
});

const schema = Type.Object({
  questions: Type.Array(QuestionSchema, { description: "Questions to ask the user" }),
});

function inlineResult(questions: Question[]): string {
  return questions
    .map((q) => {
      const opts = q.options.map((o, i) => `  ${i + 1}. ${o.label}`).join("\n");
      return `**${q.prompt}**\n${opts}`;
    })
    .join("\n\n");
}

export function createAskQuestionsTool(
  showQuestionnaire?: ShowQuestionnaireFn,
): AgentTool<typeof schema> {
  let overlayActive = false;

  return {
    name: "ask_questions",
    label: "Ask Questions",
    description:
      "Ask the user one or more questions. Use for clarifying requirements, getting preferences, or confirming decisions. For single questions, shows a simple option list. For multiple questions, shows a tab-based interface.",
    parameters: schema,
    execute: async (_toolCallId, params, signal) => {
      if (params.questions.length === 0) {
        return {
          content: [{ type: "text", text: "Error: No questions provided" }],
          details: { questions: [], answers: [], cancelled: true },
        };
      }

      // Normalize questions with defaults
      const questions: Question[] = params.questions.map((q, i) => ({
        ...q,
        label: q.label || `Q${i + 1}`,
        allowOther: q.allowOther !== false,
      }));

      // Fallback: inline text if no overlay callback
      if (!showQuestionnaire) {
        return {
          content: [{ type: "text", text: inlineResult(questions) }],
          details: { questions, answers: [], cancelled: false },
        };
      }

      // Guard against concurrent overlays
      if (overlayActive) {
        return {
          content: [{ type: "text", text: "Error: questionnaire already active" }],
          details: { questions, answers: [], cancelled: true },
        };
      }

      overlayActive = true;
      let result: QuestionnaireResult;
      try {
        result = await showQuestionnaire(questions, signal);
      } catch {
        result = { questions, answers: [], cancelled: true };
      } finally {
        overlayActive = false;
      }

      if (result.cancelled) {
        return {
          content: [{ type: "text", text: "User cancelled the questionnaire." }],
          details: result,
        };
      }

      const answerLines = result.answers.map((a) => {
        const qLabel = questions.find((q) => q.id === a.id)?.label || a.id;
        if (a.wasCustom) {
          return `${qLabel}: user wrote: ${a.label}`;
        }
        return `${qLabel}: user selected: ${a.index}. ${a.label}`;
      });

      return {
        content: [{ type: "text", text: answerLines.join("\n") }],
        details: result,
      };
    },
  };
}
