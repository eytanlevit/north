import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth, truncateToWidth, matchesKey } from "@mariozechner/pi-tui";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import type { ProjectConfig } from "../config.js";

export class ProjectDetailView implements Component {
  private config: ProjectConfig;
  private cwd: string;
  private scrollOffset = 0;
  private contentLines?: string[];
  private contentWidth?: number;
  private onClose?: () => void;

  constructor(cwd: string, config: ProjectConfig, onClose?: () => void) {
    this.cwd = cwd;
    this.config = config;
    this.onClose = onClose;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.onClose?.();
      return;
    }
    if (matchesKey(data, "j") || matchesKey(data, "down")) {
      this.scrollOffset++;
      this.invalidate();
      return;
    }
    if (matchesKey(data, "k") || matchesKey(data, "up")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
      this.invalidate();
      return;
    }
    if (matchesKey(data, "pageDown") || matchesKey(data, "space")) {
      const pageSize = Math.max(1, (process.stdout.rows || 24) - 4);
      this.scrollOffset += pageSize;
      this.invalidate();
      return;
    }
    if (matchesKey(data, "pageUp")) {
      const pageSize = Math.max(1, (process.stdout.rows || 24) - 4);
      this.scrollOffset = Math.max(0, this.scrollOffset - pageSize);
      this.invalidate();
      return;
    }
  }

  invalidate(): void {
    this.contentLines = undefined;
    this.contentWidth = undefined;
  }

  render(width: number): string[] {
    const termHeight = process.stdout.rows || 24;
    const innerWidth = width - 4;

    const content = this.buildContent(innerWidth);

    const viewableRows = termHeight - 4;
    const maxScroll = Math.max(0, content.length - viewableRows);
    if (this.scrollOffset > maxScroll) this.scrollOffset = maxScroll;

    const visible = content.slice(this.scrollOffset, this.scrollOffset + viewableRows);

    const lines: string[] = [];

    // Top border with project name
    const nameLabel = ` ${this.config.name || "Project"} `;
    const topBarLen = Math.max(0, width - 2 - visibleWidth(nameLabel));
    const topLeft = Math.floor(topBarLen / 3);
    const topRight = topBarLen - topLeft;
    lines.push(
      chalk.dim("┌") +
      chalk.dim("─".repeat(topLeft)) +
      chalk.bold.cyan(nameLabel) +
      chalk.dim("─".repeat(topRight)) +
      chalk.dim("┐")
    );

    // Content rows
    for (const line of visible) {
      const padded = padLine(line, innerWidth);
      lines.push(chalk.dim("│") + " " + padded + " " + chalk.dim("│"));
    }

    // Fill remaining space
    const emptyRows = Math.max(0, viewableRows - visible.length);
    for (let i = 0; i < emptyRows; i++) {
      lines.push(chalk.dim("│") + " ".repeat(width - 2) + chalk.dim("│"));
    }

    // Scroll indicator
    const scrollInfo = content.length > viewableRows
      ? ` ${this.scrollOffset + 1}-${Math.min(this.scrollOffset + viewableRows, content.length)}/${content.length} `
      : "";

    const shortcuts = " [Esc] Close  [j/k] Scroll ";
    const footerContent = shortcuts + scrollInfo;
    const footerPadded = padLine(chalk.dim(footerContent), innerWidth);
    lines.push(chalk.dim("│") + " " + footerPadded + " " + chalk.dim("│"));

    // Bottom border
    lines.push(chalk.dim("└") + chalk.dim("─".repeat(width - 2)) + chalk.dim("┘"));

    while (lines.length < termHeight) {
      lines.push(" ".repeat(width));
    }

    return lines;
  }

  private buildContent(width: number): string[] {
    if (this.contentLines && this.contentWidth === width) {
      return this.contentLines;
    }

    const lines: string[] = [];

    // Project name
    lines.push("");
    lines.push(chalk.bold.white(this.config.name || "Untitled Project"));
    lines.push("");

    // Description
    if (this.config.description?.trim()) {
      lines.push(chalk.bold.cyan("Description"));
      lines.push(chalk.dim("─".repeat(Math.min(width, 40))));
      lines.push(...wrapText(this.config.description, width));
      lines.push("");
    }

    // Project.md content
    const projectMdPath = path.join(this.cwd, ".north", "project.md");
    if (fs.existsSync(projectMdPath)) {
      const mdContent = fs.readFileSync(projectMdPath, "utf-8").trim();
      if (mdContent) {
        lines.push(chalk.bold.cyan("Project Notes"));
        lines.push(chalk.dim("─".repeat(Math.min(width, 40))));
        lines.push(...wrapText(mdContent, width));
        lines.push("");
      }
    }

    // Config details
    lines.push(chalk.bold.cyan("Configuration"));
    lines.push(chalk.dim("─".repeat(Math.min(width, 40))));
    lines.push(chalk.dim("Prefix: ") + this.config.prefix);
    lines.push(chalk.dim("Statuses: ") + this.config.statuses.join(", "));
    lines.push(chalk.dim("Priorities: ") + this.config.priorities.join(", "));
    lines.push("");

    this.contentLines = lines;
    this.contentWidth = width;
    return lines;
  }
}

function padLine(line: string, width: number): string {
  const vw = visibleWidth(line);
  if (vw >= width) return truncateToWidth(line, width, "…", true);
  return line + " ".repeat(width - vw);
}

function wrapText(text: string, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      result.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let currentLine = "";
    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if (visibleWidth(currentLine + " " + word) <= width) {
        currentLine += " " + word;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) result.push(currentLine);
  }
  return result;
}
