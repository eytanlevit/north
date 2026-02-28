import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { createReadTool, createGrepTool, createFindTool } from "@mariozechner/pi-coding-agent";
import { createCreateIssueTool } from "./tools/create-issue.js";
import { createListIssuesTool } from "./tools/list-issues.js";
import { createUpdateIssueTool } from "./tools/update-issue.js";
import { createShowIssueTool } from "./tools/show-issue.js";
import { createAskQuestionsTool } from "./tools/ask-questions.js";
import { createAddCommentTool } from "./tools/add-comment.js";

const SYSTEM_PROMPT = `You are a project management assistant embedded in a TUI application.

## Your capabilities
- Create, update, list, and show issues on the project board
- Add comments to issues for discussion and tracking
- Manage issue relationships: set parent issues and blocked_by dependencies
- Tag issues with labels for categorization
- Ask clarifying questions before creating issues when requirements are vague
- Explore the codebase to create technically-informed issues (use read, grep, find tools)

## Guidelines
- Be concise. Use markdown formatting.
- When the user gives a vague request like "I want to build X", use the ask_questions tool to ask clarifying questions before creating issues.
- When creating multiple issues, create them one at a time using the create_issue tool.
- Set appropriate priorities: high for blockers/critical, medium for normal work, low for nice-to-have.
- Default new issues to "todo" status unless specified otherwise.
- When asked to move or update an issue, use the update_issue tool.
- When listing issues, format them clearly with status and priority.
`;

export function createPMAgent(cwd: string): Agent {
  const model = getModel("anthropic", "claude-sonnet-4-5-20250929");

  const tools = [
    createCreateIssueTool(cwd),
    createListIssuesTool(cwd),
    createUpdateIssueTool(cwd),
    createShowIssueTool(cwd),
    createAddCommentTool(cwd),
    createAskQuestionsTool(),
    createReadTool(cwd),
    createGrepTool(cwd),
    createFindTool(cwd),
  ];

  const agent = new Agent({
    initialState: {
      systemPrompt: SYSTEM_PROMPT,
      model,
      tools,
    },
  });

  return agent;
}
