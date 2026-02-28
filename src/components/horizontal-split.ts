import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";
import chalk from "chalk";

export class HorizontalSplit implements Component {
  private left: Component;
  private right: Component;
  private leftRatio: number;
  private cachedLines?: string[];
  private cachedWidth?: number;

  constructor(left: Component, right: Component, leftRatio = 0.55) {
    this.left = left;
    this.right = right;
    this.leftRatio = leftRatio;
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
    this.left.invalidate();
    this.right.invalidate();
  }

  render(width: number): string[] {
    // separator takes 1 col
    const leftWidth = Math.floor((width - 1) * this.leftRatio);
    const rightWidth = width - leftWidth - 1;

    const leftLines = this.left.render(leftWidth);
    const rightLines = this.right.render(rightWidth);

    const maxLines = Math.max(leftLines.length, rightLines.length);
    const sep = chalk.dim("│");
    const result: string[] = [];

    for (let i = 0; i < maxLines; i++) {
      const l = padToWidth(leftLines[i] ?? "", leftWidth);
      const r = padToWidth(rightLines[i] ?? "", rightWidth);
      result.push(l + sep + r);
    }

    this.cachedLines = result;
    this.cachedWidth = width;
    return result;
  }
}

function padToWidth(line: string, targetWidth: number): string {
  const vw = visibleWidth(line);
  if (vw >= targetWidth) {
    return truncateToWidth(line, targetWidth, "", true);
  }
  return line + " ".repeat(targetWidth - vw);
}
