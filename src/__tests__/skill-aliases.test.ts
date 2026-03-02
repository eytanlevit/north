import { describe, it, expect } from "vitest";
import { expandSkillAlias, type SkillAliasConfig } from "../skill-aliases.js";

const config: SkillAliasConfig = {
  trigger: "issue",
  skillName: "issue",
  skillFilePath: "/project/src/skills/issue.md",
  skillBaseDir: "/project/src/skills",
  skillContent: "# Quick Issue Creation\n\nCreate issues from descriptions.",
  requireArgs: true,
};

describe("expandSkillAlias", () => {
  // Cycle 1 — /issue at start of text
  it("expands /issue at start of text", () => {
    const result = expandSkillAlias("/issue add dark mode", [config]);
    expect(result.type).toBe("expanded");
    if (result.type !== "expanded") return;
    expect(result.prompt).toContain('<skill name="issue"');
    expect(result.prompt).toContain("add dark mode");
    // User text portion (after </skill>) should not contain /issue
    const afterSkill = result.prompt.split("</skill>")[1] ?? "";
    expect(afterSkill).not.toContain("/issue");
  });

  // Cycle 2 — mid-sentence /issue
  it("expands /issue mid-sentence", () => {
    const result = expandSkillAlias("I think we should /issue add dark mode", [config]);
    expect(result.type).toBe("expanded");
    if (result.type !== "expanded") return;
    expect(result.prompt).toContain("I think we should add dark mode");
    // No double spaces
    expect(result.prompt).not.toMatch(/  /);
  });

  // Cycle 3 — passthrough when no alias present
  it("passes through normal messages", () => {
    const result = expandSkillAlias("just a normal message", [config]);
    expect(result).toEqual({ type: "passthrough" });
  });

  // Cycle 4 — error on bare /issue with no args
  it("returns error for bare /issue", () => {
    const result = expandSkillAlias("/issue", [config]);
    expect(result.type).toBe("error");
    if (result.type !== "error") return;
    expect(result.message).toContain("requires a description");
  });

  it("returns error for /issue with only whitespace", () => {
    const result = expandSkillAlias("/issue   ", [config]);
    expect(result.type).toBe("error");
  });

  // Cycle 5 — /issues and /issuetracker don't match
  it("does not match /issues", () => {
    const result = expandSkillAlias("/issues list all", [config]);
    expect(result).toEqual({ type: "passthrough" });
  });

  it("does not match /issuetracker", () => {
    const result = expandSkillAlias("/issuetracker open", [config]);
    expect(result).toEqual({ type: "passthrough" });
  });

  // Cycle 6 — /foo/issue in path doesn't match
  it("does not match /foo/issue in a path", () => {
    const result = expandSkillAlias("check /foo/issue for bugs", [config]);
    expect(result).toEqual({ type: "passthrough" });
  });

  // Cycle 7 — output matches library's <skill> XML format
  it("produces correct <skill> XML block", () => {
    const result = expandSkillAlias("/issue add dark mode", [config]);
    expect(result.type).toBe("expanded");
    if (result.type !== "expanded") return;
    expect(result.prompt).toContain(`<skill name="issue" location="/project/src/skills/issue.md">`);
    expect(result.prompt).toContain("References are relative to /project/src/skills");
    expect(result.prompt).toContain("</skill>");
  });

  // Cycle 8 — context before /issue preserved, no double spaces
  it("preserves context before /issue with proper spacing", () => {
    const result = expandSkillAlias("hello /issue   foo", [config]);
    expect(result.type).toBe("expanded");
    if (result.type !== "expanded") return;
    expect(result.prompt).toContain("hello foo");
    expect(result.prompt).not.toMatch(/hello  /);
  });

  // Additional: requireArgs=false allows bare alias
  it("allows bare alias when requireArgs is false", () => {
    const noArgs = { ...config, requireArgs: false };
    const result = expandSkillAlias("/issue", [noArgs]);
    expect(result.type).toBe("expanded");
    if (result.type !== "expanded") return;
    expect(result.prompt).toContain('<skill name="issue"');
    // No user text after the block
    expect(result.prompt.endsWith("</skill>")).toBe(true);
  });

  // /issue after punctuation should match
  it("matches /issue after opening paren", () => {
    const result = expandSkillAlias("let's (/issue add dark mode)", [config]);
    expect(result.type).toBe("expanded");
    if (result.type !== "expanded") return;
    expect(result.prompt).toContain("add dark mode)");
  });

  // /issue at end of text (no args after)
  it("returns error for /issue at end after text (requireArgs)", () => {
    const result = expandSkillAlias("we should /issue", [config]);
    expect(result.type).toBe("error");
  });
});
