import fs from "node:fs";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { loadConfig } from "../config.js";
import { stringify } from "yaml";

const schema = Type.Object({
  name: Type.Optional(Type.String({ description: "Project name" })),
  prefix: Type.Optional(Type.String({ description: "Issue ID prefix (e.g. PMT)" })),
  description: Type.Optional(Type.String({ description: "Short project description" })),
  statuses: Type.Optional(Type.Array(Type.String(), { description: "Ordered list of statuses" })),
  priorities: Type.Optional(Type.Array(Type.String(), { description: "Ordered list of priorities" })),
  project_md: Type.Optional(Type.String({ description: "Content for .north/project.md" })),
});

export function createUpdateProjectTool(cwd: string): AgentTool<typeof schema> {
  return {
    name: "update_project",
    label: "Update Project",
    description: "Update project configuration or notes",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const config = loadConfig(cwd);
      const updated: string[] = [];

      if (params.name !== undefined) {
        config.name = params.name;
        updated.push("name");
      }
      if (params.prefix !== undefined) {
        config.prefix = params.prefix;
        updated.push("prefix");
      }
      if (params.description !== undefined) {
        config.description = params.description;
        updated.push("description");
      }
      if (params.statuses !== undefined) {
        config.statuses = params.statuses;
        updated.push("statuses");
      }
      if (params.priorities !== undefined) {
        config.priorities = params.priorities;
        updated.push("priorities");
      }

      const configPath = path.join(cwd, ".north", "config.yaml");
      const configTmp = configPath + ".tmp";
      fs.writeFileSync(configTmp, stringify(config), "utf-8");
      fs.renameSync(configTmp, configPath);

      if (params.project_md !== undefined) {
        const projectMdPath = path.join(cwd, ".north", "project.md");
        const mdTmp = projectMdPath + ".tmp";
        fs.writeFileSync(mdTmp, params.project_md, "utf-8");
        fs.renameSync(mdTmp, projectMdPath);
        updated.push("project.md");
      }

      const text = updated.length > 0
        ? `Updated project: ${updated.join(", ")}`
        : "No changes made";

      return {
        content: [{ type: "text", text }],
        details: config,
      };
    },
  };
}
