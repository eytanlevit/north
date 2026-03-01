import chalk from "chalk";

export type IssueCategory = "bug" | "feature" | "research";

const LABEL_TO_CATEGORY: Record<string, IssueCategory> = {
  bug: "bug",
  fix: "bug",
  enhancement: "feature",
  feature: "feature",
  research: "research",
};

/** Priority order: bug > research > feature */
const CATEGORY_PRIORITY: Record<IssueCategory, number> = {
  bug: 0,
  research: 1,
  feature: 2,
};

export const CATEGORY_COLOR: Record<IssueCategory, (s: string) => string> = {
  bug: chalk.bgRed.white,
  feature: chalk.bgGreen.black,
  research: chalk.bgMagenta.white,
};

export function getCategory(labels?: string[]): IssueCategory | null {
  if (!labels?.length) return null;

  let best: IssueCategory | null = null;
  for (const raw of labels) {
    const cat = LABEL_TO_CATEGORY[raw.trim().toLowerCase()];
    if (cat && (best === null || CATEGORY_PRIORITY[cat] < CATEGORY_PRIORITY[best])) {
      best = cat;
    }
  }
  return best;
}
