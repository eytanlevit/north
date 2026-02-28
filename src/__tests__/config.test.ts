import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { defaultConfig, loadConfig, validateConfig, initProject } from "../config.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmtui-config-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("defaultConfig", () => {
  it("returns expected defaults", () => {
    const config = defaultConfig();
    expect(config.prefix).toBe("ISS");
    expect(config.name).toBe("My Project");
    expect(config.description).toBe("");
    expect(config.statuses).toEqual(["todo", "in-progress", "done"]);
    expect(config.priorities).toEqual(["high", "medium", "low"]);
  });
});

describe("loadConfig", () => {
  it("returns defaults when no config file exists", () => {
    const config = loadConfig(tmpDir);
    expect(config).toEqual(defaultConfig());
  });

  it("reads and parses a config.yaml file", () => {
    const pmDir = path.join(tmpDir, ".pm");
    fs.mkdirSync(pmDir, { recursive: true });
    fs.writeFileSync(
      path.join(pmDir, "config.yaml"),
      [
        "prefix: PROJ",
        "name: Test Project",
        "description: A test project",
        "statuses:",
        "  - backlog",
        "  - active",
        "  - review",
        "  - shipped",
        "priorities:",
        "  - critical",
        "  - normal",
        "  - low",
      ].join("\n"),
      "utf-8",
    );

    const config = loadConfig(tmpDir);
    expect(config.prefix).toBe("PROJ");
    expect(config.name).toBe("Test Project");
    expect(config.description).toBe("A test project");
    expect(config.statuses).toEqual(["backlog", "active", "review", "shipped"]);
    expect(config.priorities).toEqual(["critical", "normal", "low"]);
  });

  it("merges partial config with defaults", () => {
    const pmDir = path.join(tmpDir, ".pm");
    fs.mkdirSync(pmDir, { recursive: true });
    fs.writeFileSync(
      path.join(pmDir, "config.yaml"),
      "prefix: TASK\nname: Partial\n",
      "utf-8",
    );

    const config = loadConfig(tmpDir);
    expect(config.prefix).toBe("TASK");
    expect(config.name).toBe("Partial");
    // defaults should fill in the rest
    expect(config.statuses).toEqual(["todo", "in-progress", "done"]);
    expect(config.priorities).toEqual(["high", "medium", "low"]);
  });
});

describe("validateConfig", () => {
  it("passes for valid config", () => {
    expect(() => validateConfig(defaultConfig())).not.toThrow();
  });

  it("throws on null", () => {
    expect(() => validateConfig(null)).toThrow("Config must be an object");
  });

  it("throws on empty prefix", () => {
    const config = { ...defaultConfig(), prefix: "" };
    expect(() => validateConfig(config)).toThrow("prefix must be a non-empty string");
  });

  it("throws on empty statuses array", () => {
    const config = { ...defaultConfig(), statuses: [] };
    expect(() => validateConfig(config)).toThrow("statuses must be a non-empty array");
  });

  it("throws on empty priorities array", () => {
    const config = { ...defaultConfig(), priorities: [] };
    expect(() => validateConfig(config)).toThrow("priorities must be a non-empty array");
  });

  it("throws on non-string status entry", () => {
    const config = { ...defaultConfig(), statuses: ["valid", 123 as unknown as string] };
    expect(() => validateConfig(config)).toThrow("Each status must be a non-empty string");
  });

  it("throws on empty string priority entry", () => {
    const config = { ...defaultConfig(), priorities: ["high", ""] };
    expect(() => validateConfig(config)).toThrow("Each priority must be a non-empty string");
  });
});

describe("initProject", () => {
  it("scaffolds correct directory structure", () => {
    initProject(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, ".pm"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".pm", "issues"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".pm", "docs"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".pm", "config.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".pm", "project.md"))).toBe(true);
  });

  it("writes default config.yaml content", () => {
    initProject(tmpDir);

    const config = loadConfig(tmpDir);
    expect(config.prefix).toBe("ISS");
    expect(config.statuses).toEqual(["todo", "in-progress", "done"]);
  });

  it("does not overwrite existing config.yaml", () => {
    const pmDir = path.join(tmpDir, ".pm");
    fs.mkdirSync(pmDir, { recursive: true });
    fs.writeFileSync(
      path.join(pmDir, "config.yaml"),
      "prefix: EXISTING\nname: Keep Me\nstatuses:\n  - a\npriorities:\n  - b\n",
      "utf-8",
    );

    initProject(tmpDir);

    const config = loadConfig(tmpDir);
    expect(config.prefix).toBe("EXISTING");
    expect(config.name).toBe("Keep Me");
  });
});
