import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth, truncateToWidth, matchesKey } from "@mariozechner/pi-tui";
import chalk from "chalk";

export class ConfirmationDialog implements Component {
  private message: string;
  private resolved = false;
  private resolve!: (value: boolean) => void;
  readonly promise: Promise<boolean>;
  selectedButton: "cancel" | "delete" = "cancel";

  constructor(message: string) {
    this.message = message;
    this.promise = new Promise<boolean>((res) => {
      this.resolve = res;
    });
  }

  private finish(value: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.resolve(value);
  }

  handleInput(data: string): void {
    if (this.resolved) return;

    if (matchesKey(data, "escape")) {
      this.finish(false);
      return;
    }
    if (matchesKey(data, "tab")) {
      this.selectedButton = this.selectedButton === "cancel" ? "delete" : "cancel";
      return;
    }
    if (matchesKey(data, "enter")) {
      this.finish(this.selectedButton === "delete");
      return;
    }
  }

  render(width: number): string[] {
    const innerWidth = width - 4; // border + padding
    const lines: string[] = [];

    // Top border
    const titleLabel = " Delete Issue? ";
    const topBarLen = Math.max(0, width - 2 - visibleWidth(titleLabel));
    const topLeft = Math.floor(topBarLen / 3);
    const topRight = topBarLen - topLeft;
    lines.push(
      chalk.dim("\u250c") +
      chalk.dim("\u2500".repeat(topLeft)) +
      chalk.bold.red(titleLabel) +
      chalk.dim("\u2500".repeat(topRight)) +
      chalk.dim("\u2510"),
    );

    // Blank line
    lines.push(chalk.dim("\u2502") + " ".repeat(width - 2) + chalk.dim("\u2502"));

    // Message line(s) — word-wrap
    const msgLines = wrapText(this.message, innerWidth);
    for (const ml of msgLines) {
      lines.push(chalk.dim("\u2502") + " " + padLine(ml, innerWidth) + " " + chalk.dim("\u2502"));
    }

    // Blank line
    lines.push(chalk.dim("\u2502") + " ".repeat(width - 2) + chalk.dim("\u2502"));

    // Buttons
    const cancelBtn = this.selectedButton === "cancel"
      ? chalk.bgWhite.black(" Cancel ")
      : chalk.dim(" Cancel ");
    const deleteBtn = this.selectedButton === "delete"
      ? chalk.bgRed.white(" Delete ")
      : chalk.dim(" Delete ");

    const buttonLine = `  ${cancelBtn}   ${deleteBtn}  `;
    lines.push(chalk.dim("\u2502") + " " + padLine(buttonLine, innerWidth) + " " + chalk.dim("\u2502"));

    // Blank line
    lines.push(chalk.dim("\u2502") + " ".repeat(width - 2) + chalk.dim("\u2502"));

    // Footer
    const help = chalk.dim(" Tab switch \u2022 Enter confirm \u2022 Esc cancel");
    lines.push(chalk.dim("\u2502") + " " + padLine(help, innerWidth) + " " + chalk.dim("\u2502"));

    // Bottom border
    lines.push(chalk.dim("\u2514") + chalk.dim("\u2500".repeat(width - 2)) + chalk.dim("\u2518"));

    return lines;
  }
}

function padLine(line: string, width: number): string {
  const vw = visibleWidth(line);
  if (vw >= width) return truncateToWidth(line, width, "\u2026", true);
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
