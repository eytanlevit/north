import { createBashTool } from "@mariozechner/pi-coding-agent";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*[rfRF]|--recursive|--force)/,
  /\bgit\s+push\s+.*--force/,
  /\bgit\s+push\s+-f\b/,
  /\bgit\s+reset\s+--hard/,
  /\bgit\s+clean\s+-[a-zA-Z]*f/,
  /\bgit\s+checkout\s+--\s/,
  /\bgit\s+branch\s+-[dD]\b/,
  /\bchmod\s+.*777\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
];

export function createSafeBashTool(cwd: string): AgentTool {
  const realBash = createBashTool(cwd);
  return {
    ...realBash,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const command = (params as { command: string }).command;
      for (const pattern of DESTRUCTIVE_PATTERNS) {
        if (pattern.test(command)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `BLOCKED: "${command}" appears destructive. Ask the user to confirm before running this command.`,
              },
            ],
            details: { blocked: true, command },
          };
        }
      }
      return realBash.execute(toolCallId, params as any, signal, onUpdate);
    },
  };
}
