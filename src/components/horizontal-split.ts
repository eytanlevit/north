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

  handleInput(data: string): void {
    // Route input to whichever child has focus
    const leftFocused = "focused" in this.left && (this.left as Component & { focused: boolean }).focused;
    const rightFocused = "focused" in this.right && (this.right as Component & { focused: boolean }).focused;

    if (leftFocused && this.left.handleInput) {
      this.left.handleInput(data);
    } else if (rightFocused && this.right.handleInput) {
      this.right.handleInput(data);
    }
  }

  render(width: number): string[] {
    const terminalHeight = process.stdout.rows || 24;

    // separator takes 1 col
    const leftWidth = Math.floor((width - 1) * this.leftRatio);
    const rightWidth = width - leftWidth - 1;

    const leftLines = this.left.render(leftWidth);
    const rightLines = this.right.render(rightWidth);

    // Cap both panes to terminal height
    const cappedLeft = capToHeight(leftLines, terminalHeight, leftWidth);
    const cappedRight = capToHeight(rightLines, terminalHeight, rightWidth);

    const sep = chalk.dim("│");
    const result: string[] = [];

    for (let i = 0; i < terminalHeight; i++) {
      const l = padToWidth(cappedLeft[i] ?? "", leftWidth);
      const r = padToWidth(cappedRight[i] ?? "", rightWidth);
      result.push(l + sep + r);
    }

    this.cachedLines = result;
    this.cachedWidth = width;
    return result;
  }
}

function capToHeight(lines: string[], height: number, _width: number): string[] {
  if (lines.length <= height) {
    return lines;
  }
  // Truncate to terminal height, keeping the top lines
  return lines.slice(0, height);
}

function padToWidth(line: string, targetWidth: number): string {
  const vw = visibleWidth(line);
  if (vw >= targetWidth) {
    return truncateToWidth(line, targetWidth, "", true);
  }
  return line + " ".repeat(targetWidth - vw);
}
