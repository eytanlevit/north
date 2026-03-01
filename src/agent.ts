import { getModel } from "@mariozechner/pi-ai";
import {
  createAgentSession,
  readTool,
  grepTool,
  findTool,
  DefaultResourceLoader,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import type { AgentSession, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { createCreateIssueTool } from "./tools/create-issue.js";
import { createListIssuesTool } from "./tools/list-issues.js";
import { createUpdateIssueTool } from "./tools/update-issue.js";
import { createShowIssueTool } from "./tools/show-issue.js";
import { createAskQuestionsTool } from "./tools/ask-questions.js";
import type { ShowQuestionnaireFn } from "./tools/ask-questions.js";
import { createAddCommentTool } from "./tools/add-comment.js";
import { createDeleteIssueTool } from "./tools/delete-issue.js";
import { createShowProjectTool } from "./tools/show-project.js";
import { createUpdateProjectTool } from "./tools/update-project.js";
import { createSafeBashTool } from "./tools/bash-wrapper.js";
import { loadConfig } from "./config.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface PMSessionResult {
  session: AgentSession;
  resumed: boolean;
}

export async function createPMSession(
  cwd: string,
  showQuestionnaire?: ShowQuestionnaireFn,
): Promise<PMSessionResult> {
  const config = loadConfig(cwd);
  const model = getModel("anthropic", "claude-opus-4-6-20260201");

  const SYSTEM_PROMPT = `You are a project management assistant embedded in a TUI application.

## Your capabilities
- Create, update, delete, list, and show issues on the project board
- Add comments to issues for discussion and tracking
- Manage issue relationships: set parent issues and blocked_by dependencies
- Tag issues with labels for categorization
- Show and update project configuration (name, prefix, description, statuses, priorities)
- Show and update project notes (.pm/project.md)
- Ask clarifying questions before creating issues when requirements are vague
- Explore the codebase to create technically-informed issues (use read, grep, find tools)

## Project structure
- .pm/config.yaml — project configuration (name, prefix, statuses, priorities)
- .pm/project.md — project notes and description
- .pm/issues/{PREFIX}-NNN.md — issue files

## Project configuration
- Issue prefix: ${config.prefix}
- Available statuses: ${config.statuses.join(", ")}
- Available priorities: ${config.priorities.join(", ")}

## Guidelines
- Be concise. Use markdown formatting.
- When the user gives a vague request like "I want to build X", use the ask_questions tool to ask clarifying questions before creating issues.
- When creating multiple issues, create them one at a time using the create_issue tool.
- Set appropriate priorities: ${config.priorities[0]} for blockers/critical, ${config.priorities[1] ?? config.priorities[0]} for normal work, ${config.priorities[config.priorities.length - 1]} for nice-to-have.
- Default new issues to "${config.statuses[0]}" status unless specified otherwise.
- When asked to move or update an issue, use the update_issue tool.
- When listing issues, format them clearly with status and priority.
`;

  const pmTools = [
    createCreateIssueTool(cwd, config),
    createListIssuesTool(cwd, config),
    createUpdateIssueTool(cwd, config),
    createShowIssueTool(cwd),
    createAddCommentTool(cwd),
    createDeleteIssueTool(cwd),
    createShowProjectTool(cwd),
    createUpdateProjectTool(cwd),
    createAskQuestionsTool(showQuestionnaire),
  ];

  const safeBash = createSafeBashTool(cwd);

  const bundledSkillsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "skills");

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    systemPrompt: SYSTEM_PROMPT,
    additionalSkillPaths: [bundledSkillsDir],
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
  });
  await resourceLoader.reload();

  const sessionManager = SessionManager.continueRecent(cwd);
  const resumed = sessionManager.getEntries().length > 0;

  const { session } = await createAgentSession({
    cwd,
    model,
    thinkingLevel: "off",
    tools: [readTool, grepTool, findTool],
    customTools: [...pmTools, safeBash] as unknown as ToolDefinition[],
    resourceLoader,
    sessionManager: sessionManager,
  });

  return { session, resumed };
}
