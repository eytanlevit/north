/**
 * Generic skill alias expander.
 *
 * Detects registered skill aliases (e.g. `/issue`) anywhere in user text
 * and expands them to the library's `<skill>` XML block format.
 */

export interface SkillAliasConfig {
  trigger: string;        // e.g. "issue"
  skillName: string;      // e.g. "issue"
  skillFilePath: string;
  skillBaseDir: string;
  skillContent: string;   // cached body (frontmatter already stripped)
  requireArgs: boolean;   // true → bare /issue shows error
}

export type ExpandResult =
  | { type: "expanded"; prompt: string }
  | { type: "error"; message: string }
  | { type: "passthrough" };

/**
 * Expand a skill alias found anywhere in the user's text.
 *
 * Regex boundary rules (Codex-reviewed):
 *   Preceding: start-of-string OR whitespace/punctuation
 *   Following: whitespace OR end-of-string
 * This prevents matching `/issues`, `/issuetracker`, `/foo/issue`, or `/issue.`
 */
export function expandSkillAlias(
  text: string,
  aliases: SkillAliasConfig[],
): ExpandResult {
  for (const alias of aliases) {
    const pattern = new RegExp(
      `(^|[\\s([{"'])\\/` + escapeRegExp(alias.trigger) + `(?=\\s|$)`,
    );
    const match = pattern.exec(text);
    if (!match) continue;

    // Extract text before and after the /trigger
    const matchStart = match.index + match[1].length; // skip preceding boundary char
    const matchEnd = matchStart + alias.trigger.length + 1; // +1 for the slash

    const before = text.slice(0, matchStart);
    const after = text.slice(matchEnd);

    // Build cleaned user text (no double spaces)
    const args = after.trimStart();
    const userText = (before.trimEnd() + (args ? " " + args : "")).trim();

    // Check requireArgs
    if (alias.requireArgs && !args) {
      return {
        type: "error",
        message: `/${alias.trigger} requires a description. Example: /${alias.trigger} add dark mode`,
      };
    }

    // Build <skill> XML block matching library format
    const skillBlock = [
      `<skill name="${alias.skillName}" location="${alias.skillFilePath}">`,
      `References are relative to ${alias.skillBaseDir}.`,
      "",
      alias.skillContent,
      `</skill>`,
    ].join("\n");

    const prompt = userText
      ? `${skillBlock}\n\n${userText}`
      : skillBlock;

    return { type: "expanded", prompt };
  }

  return { type: "passthrough" };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
