import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const CLI_PATH = path.resolve(__dirname, "..", "cli.ts");

describe("CLI", { timeout: 30000 }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "north-cli-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function run(...cliArgs: string[]): { stdout: string; stderr: string; status: number } {
    try {
      const stdout = execFileSync("npx", ["tsx", CLI_PATH, ...cliArgs], {
        cwd: tmpDir,
        encoding: "utf-8",
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
        timeout: 15000,
      });
      return { stdout, stderr: "", status: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
        status: err.status ?? 1,
      };
    }
  }

  // ---- init ---------------------------------------------------------------

  describe("init", () => {
    it("creates .north/ directory structure", () => {
      const result = run("init");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Initialized");

      expect(fs.existsSync(path.join(tmpDir, ".north"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".north", "issues"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".north", "docs"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".north", "config.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".north", "project.md"))).toBe(true);
    });

    it("fails if .north/ already exists", () => {
      run("init");
      const result = run("init");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("already initialized");
    });
  });

  // ---- create -------------------------------------------------------------

  describe("create", () => {
    beforeEach(() => {
      run("init");
    });

    it("creates an issue file", () => {
      const result = run("create", "My first issue");
      expect(result.status).toBe(0);

      // stdout is non-TTY in tests, so output is JSON
      const issue = JSON.parse(result.stdout);
      expect(issue.id).toBe("NOR-001");
      expect(issue.title).toBe("My first issue");
      expect(issue.status).toBe("todo");
      expect(issue.priority).toBe("medium");

      // File should exist on disk
      const issuePath = path.join(tmpDir, ".north", "issues", "NOR-001.md");
      expect(fs.existsSync(issuePath)).toBe(true);
    });

    it("creates issues with custom status and priority", () => {
      const result = run("create", "Urgent bug", "--status", "in-progress", "--priority", "high");
      expect(result.status).toBe(0);
      const issue = JSON.parse(result.stdout);
      expect(issue.status).toBe("in-progress");
      expect(issue.priority).toBe("high");
    });

    it("auto-increments IDs", () => {
      run("create", "First");
      const result = run("create", "Second");
      const issue = JSON.parse(result.stdout);
      expect(issue.id).toBe("NOR-002");
    });

    it("uses prefix from config.yaml", () => {
      // Override config with custom prefix
      const configPath = path.join(tmpDir, ".north", "config.yaml");
      const config = fs.readFileSync(configPath, "utf-8").replace("prefix: NOR", "prefix: TASK");
      fs.writeFileSync(configPath, config, "utf-8");

      const result = run("create", "Custom prefix issue");
      expect(result.status).toBe(0);
      const issue = JSON.parse(result.stdout);
      expect(issue.id).toBe("TASK-001");

      // File should exist with the custom prefix
      expect(fs.existsSync(path.join(tmpDir, ".north", "issues", "TASK-001.md"))).toBe(true);
    });
  });

  // ---- list ---------------------------------------------------------------

  describe("list", () => {
    beforeEach(() => {
      run("init");
    });

    it("returns empty array when no issues", () => {
      const result = run("list", "--json");
      expect(result.status).toBe(0);
      const issues = JSON.parse(result.stdout);
      expect(issues).toEqual([]);
    });

    it("lists created issues", () => {
      run("create", "Issue A");
      run("create", "Issue B");
      const result = run("list", "--json");
      expect(result.status).toBe(0);
      const issues = JSON.parse(result.stdout);
      expect(issues).toHaveLength(2);
      expect(issues[0].title).toBe("Issue A");
      expect(issues[1].title).toBe("Issue B");
    });

    it("filters by status", () => {
      run("create", "Todo item");
      run("create", "Done item", "--status", "done");
      const result = run("list", "--json", "--status", "done");
      const issues = JSON.parse(result.stdout);
      expect(issues).toHaveLength(1);
      expect(issues[0].title).toBe("Done item");
    });
  });

  // ---- show ---------------------------------------------------------------

  describe("show", () => {
    beforeEach(() => {
      run("init");
      run("create", "Test issue", "--body", "Some details");
    });

    it("shows issue details as JSON", () => {
      const result = run("show", "NOR-001", "--json");
      expect(result.status).toBe(0);
      const issue = JSON.parse(result.stdout);
      expect(issue.id).toBe("NOR-001");
      expect(issue.title).toBe("Test issue");
      expect(issue.body).toBe("Some details");
    });

    it("accepts plain number as ID", () => {
      const result = run("show", "1", "--json");
      expect(result.status).toBe(0);
      const issue = JSON.parse(result.stdout);
      expect(issue.id).toBe("NOR-001");
    });

    it("returns error for non-existent issue", () => {
      const result = run("show", "999");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("not found");
    });
  });

  // ---- update -------------------------------------------------------------

  describe("update", () => {
    beforeEach(() => {
      run("init");
      run("create", "Original title");
    });

    it("updates issue fields", () => {
      const result = run("update", "NOR-001", "--title", "New title", "--status", "done", "--priority", "high");
      expect(result.status).toBe(0);

      const showResult = run("show", "1", "--json");
      const issue = JSON.parse(showResult.stdout);
      expect(issue.title).toBe("New title");
      expect(issue.status).toBe("done");
      expect(issue.priority).toBe("high");
    });

    it("returns error for non-existent issue", () => {
      const result = run("update", "999", "--title", "nope");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("not found");
    });
  });

  // ---- comment ------------------------------------------------------------

  describe("comment", () => {
    beforeEach(() => {
      run("init");
      run("create", "Commentable issue");
    });

    it("adds a comment to an issue", () => {
      const result = run("comment", "1", "This is a comment", "--author", "tester");
      expect(result.status).toBe(0);

      const showResult = run("show", "1", "--json");
      const issue = JSON.parse(showResult.stdout);
      expect(issue.body).toContain("This is a comment");
      expect(issue.body).toContain("tester");
    });
  });

  // ---- help / unknown -----------------------------------------------------

  describe("help", () => {
    it("prints help for unknown command", () => {
      const result = run("foobar");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Unknown command");
    });

    it("prints help with --help flag", () => {
      const result = run("--help");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("north");
      expect(result.stdout).toContain("Commands:");
    });
  });
});
