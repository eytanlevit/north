import fs from "node:fs";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { loadConfig } from "../config.js";

const schema = Type.Object({});

export function createShowProjectTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "show_project",
    label: "Show Project",
    description: "Show project configuration and notes",
    parameters: schema,
    execute: async (_toolCallId, _params) => {
      const config = loadConfig(cwd);
      const projectMdPath = path.join(cwd, ".north", "project.md");
      let projectMd: string | undefined;
      if (fs.existsSync(projectMdPath)) {
        projectMd = fs.readFileSync(projectMdPath, "utf-8");
      }

      const lines = [
        `# ${config.name}`,
        `**Prefix:** ${config.prefix}`,
        `**Description:** ${config.description || "_No description_"}`,
        `**Statuses:** ${config.statuses.join(", ")}`,
        `**Priorities:** ${config.priorities.join(", ")}`,
      ];

      if (projectMd) {
        lines.push("", "---", "## Project Notes", "", projectMd);
      }

      const text = lines.join("\n");
      return {
        content: [{ type: "text", text }],
        details: { config, projectMd },
      };
    },
  };
}
