import fs from "node:fs";
import path from "node:path";

/**
 * Walk up from startDir looking for a directory containing `.pm/`.
 * Returns the directory that contains `.pm/`, or throws if not found.
 */
export function findProjectRoot(startDir?: string): string {
  let dir = path.resolve(startDir ?? process.cwd());

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
