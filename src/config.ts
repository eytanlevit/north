import fs from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";

export interface ProjectConfig {
  prefix: string;
  name: string;
  description: string;
  statuses: string[];
  priorities: string[];
}

export function defaultConfig(): ProjectConfig {
  return {
    prefix: "NOR",
    name: "My Project",
    description: "",
    statuses: ["todo", "in-progress", "done"],
    priorities: ["high", "medium", "low"],
  };
}

export function validateConfig(config: unknown): asserts config is ProjectConfig {
  if (typeof config !== "object" || config === null) {
    throw new Error("Config must be an object");
  }
  const c = config as Record<string, unknown>;
  if (typeof c.prefix !== "string" || c.prefix.length === 0) {
    throw new Error("Config prefix must be a non-empty string");
  }
  if (typeof c.name !== "string") {
    throw new Error("Config name must be a string");
  }
  if (!Array.isArray(c.statuses) || c.statuses.length === 0) {
    throw new Error("Config statuses must be a non-empty array");
  }
  for (const s of c.statuses) {
    if (typeof s !== "string" || s.length === 0) {
      throw new Error("Each status must be a non-empty string");
    }
  }
  if (!Array.isArray(c.priorities) || c.priorities.length === 0) {
    throw new Error("Config priorities must be a non-empty array");
  }
  for (const p of c.priorities) {
    if (typeof p !== "string" || p.length === 0) {
      throw new Error("Each priority must be a non-empty string");
    }
  }
}

export function loadConfig(cwd: string): ProjectConfig {
  const configPath = path.join(cwd, ".north", "config.yaml");
  if (!fs.existsSync(configPath)) {
    return defaultConfig();
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = parse(raw) as Record<string, unknown> | null;
  if (!parsed) {
    return defaultConfig();
  }
  const config: ProjectConfig = {
    ...defaultConfig(),
    ...parsed,
  };
  validateConfig(config);
  return config;
}

export function initProject(cwd: string): void {
  const pmDir = path.join(cwd, ".north");
  const dirs = [pmDir, path.join(pmDir, "issues"), path.join(pmDir, "docs")];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const configPath = path.join(pmDir, "config.yaml");
  if (!fs.existsSync(configPath)) {
    const config = defaultConfig();
    const tmp = configPath + ".tmp";
    fs.writeFileSync(tmp, stringify(config), "utf-8");
    fs.renameSync(tmp, configPath);
  }

  const projectMdPath = path.join(pmDir, "project.md");
  if (!fs.existsSync(projectMdPath)) {
    const tmp = projectMdPath + ".tmp";
    fs.writeFileSync(tmp, "# Project\n\nDescribe your project here.\n", "utf-8");
    fs.renameSync(tmp, projectMdPath);
  }
}
