import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Try to find the git repository root via `git rev-parse --show-toplevel`.
 * Returns the trimmed path or null if not in a git repo.
 */
function getGitRoot(): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

export interface FindProjectRootOptions {
  startDir?: string;
  /** Override git-root detection (for testing). */
  gitRoot?: () => string | null;
}

/**
 * Resolve the project root directory.
 *
 * Strategy:
 *  1. Ask git for the repo root; if `.pm/` exists there, use it.
 *  2. Otherwise fall back to walking up from startDir.
 */
export function findProjectRoot(startDirOrOpts?: string | FindProjectRootOptions): string {
  const opts: FindProjectRootOptions =
    typeof startDirOrOpts === "string"
      ? { startDir: startDirOrOpts }
      : startDirOrOpts ?? {};

  const resolveGitRoot = opts.gitRoot ?? getGitRoot;

  // --- Strategy 1: git root ---
  const gitRoot = resolveGitRoot();
  if (gitRoot) {
    const pmAtGitRoot = path.join(gitRoot, ".pm");
    if (fs.existsSync(pmAtGitRoot) && fs.statSync(pmAtGitRoot).isDirectory()) {
      return gitRoot;
    }
  }

  // --- Strategy 2: walk-up ---
  let dir = path.resolve(opts.startDir ?? process.cwd());

  while (true) {
    const pmDir = path.join(dir, ".pm");
    if (fs.existsSync(pmDir) && fs.statSync(pmDir).isDirectory()) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        "No .pm/ directory found. Are you inside a pmtui project?\nRun `pmtui init` to initialize one."
      );
    }
    dir = parent;
  }
}
