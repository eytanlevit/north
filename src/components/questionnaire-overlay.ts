import type { Component, TUI, EditorTheme } from "@mariozechner/pi-tui";
import { Editor, visibleWidth, truncateToWidth, matchesKey } from "@mariozechner/pi-tui";
import chalk from "chalk";
import type { Question, QuestionOption, Answer, QuestionnaireResult } from "../tools/ask-questions.js";

type RenderOption = QuestionOption & { isOther?: boolean };

const editorTheme: EditorTheme = {
  borderColor: (s: string) => chalk.cyan(s),
  selectList: {
    selectedPrefix: (t: string) => chalk.cyan(t),
    selectedText: (t: string) => chalk.cyan(t),
    description: (t: string) => chalk.dim(t),
    scrollInfo: (t: string) => chalk.dim(t),
    noMatch: (t: string) => chalk.dim(t),
  },
};

export class QuestionnaireOverlay implements Component {
  private questions: Question[];
  private isMulti: boolean;
  private totalTabs: number;
  private currentTab = 0;
  private optionIndex = 0;
  private inputMode = false;
  private inputQuestionId: string | null = null;
  private cachedLines?: string[];
  private cachedWidth?: number;
  private answers = new Map<string, Answer>();
  private editor: Editor;
  private onDone: (result: QuestionnaireResult) => void;
  private signal?: AbortSignal;
  private abortHandler?: () => void;

  constructor(
    tui: TUI,
    questions: Question[],
    onDone: (result: QuestionnaireResult) => void,
    signal?: AbortSignal,
  ) {
    this.questions = questions;
    this.isMulti = questions.length > 1;
    this.totalTabs = questions.length + 1; // questions + Submit
    this.onDone = onDone;
    this.signal = signal;

    this.editor = new Editor(tui, editorTheme);
    this.editor.onSubmit = (value: string) => {
      if (!this.inputQuestionId) return;
      const trimmed = value.trim() || "(no response)";
      this.saveAnswer(this.inputQuestionId, trimmed, trimmed, true);
      this.inputMode = false;
      this.inputQuestionId = null;
      this.editor.setText("");
      this.advanceAfterAnswer();
    };

    // Listen for abort signal
    if (signal) {
      this.abortHandler = () => this.submit(true);
      signal.addEventListener("abort", this.abortHandler, { once: true });
    }
  }

  private cleanup(): void {
    if (this.signal && this.abortHandler) {
      this.signal.removeEventListener("abort", this.abortHandler);
    }
  }

  private submit(cancelled: boolean): void {
    this.cleanup();
    this.onDone({
      questions: this.questions,
      answers: Array.from(this.answers.values()),
      cancelled,
    });
  }

  private currentQuestion(): Question | undefined {
    return this.questions[this.currentTab];
  }

  private currentOptions(): RenderOption[] {
    const q = this.currentQuestion();
    if (!q) return [];
    const opts: RenderOption[] = [...q.options];
    if (q.allowOther) {
      opts.push({ value: "__other__", label: "Type something.", isOther: true });
    }
    return opts;
  }

  private allAnswered(): boolean {
    return this.questions.every((q) => this.answers.has(q.id));
  }

  private advanceAfterAnswer(): void {
    if (!this.isMulti) {
      this.submit(false);
      return;
    }
    if (this.currentTab < this.questions.length - 1) {
      this.currentTab++;
    } else {
      this.currentTab = this.questions.length; // Submit tab
    }
    this.optionIndex = 0;
    this.invalidate();
  }

  private saveAnswer(questionId: string, value: string, label: string, wasCustom: boolean, index?: number): void {
    this.answers.set(questionId, { id: questionId, value, label, wasCustom, index });
  }

  handleInput(data: string): void {
    // Input mode: route to editor
    if (this.inputMode) {
      if (matchesKey(data, "escape")) {
        this.inputMode = false;
        this.inputQuestionId = null;
        this.editor.setText("");
        this.invalidate();
        return;
      }
      this.editor.handleInput(data);
      this.invalidate();
      return;
    }

    const q = this.currentQuestion();
    const opts = this.currentOptions();

    // Tab navigation (multi-question only)
    if (this.isMulti) {
      if (matchesKey(data, "tab") || matchesKey(data, "right")) {
        this.currentTab = (this.currentTab + 1) % this.totalTabs;
        this.optionIndex = 0;
        this.invalidate();
        return;
      }
      if (matchesKey(data, "shift+tab") || matchesKey(data, "left")) {
        this.currentTab = (this.currentTab - 1 + this.totalTabs) % this.totalTabs;
        this.optionIndex = 0;
        this.invalidate();
        return;
      }
    }

    // Submit tab
    if (this.currentTab === this.questions.length) {
      if (matchesKey(data, "enter") && this.allAnswered()) {
        this.submit(false);
      } else if (matchesKey(data, "escape")) {
        this.submit(true);
      }
      return;
    }

    // Option navigation
    if (matchesKey(data, "up")) {
      this.optionIndex = Math.max(0, this.optionIndex - 1);
      this.invalidate();
      return;
    }
    if (matchesKey(data, "down")) {
      this.optionIndex = Math.min(opts.length - 1, this.optionIndex + 1);
      this.invalidate();
      return;
    }

    // Select option
    if (matchesKey(data, "enter") && q) {
      const opt = opts[this.optionIndex];
      if (opt.isOther) {
        this.inputMode = true;
        this.inputQuestionId = q.id;
        this.editor.setText("");
        this.invalidate();
        return;
      }
      this.saveAnswer(q.id, opt.value, opt.label, false, this.optionIndex + 1);
      this.advanceAfterAnswer();
      return;
    }

    // Cancel
    if (matchesKey(data, "escape")) {
      this.submit(true);
    }
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const innerWidth = width - 4; // border + padding
    const content = this.buildContent(innerWidth);

    // Frame it like issue-detail
    const lines: string[] = [];

    // Top border
    const titleLabel = " Questions ";
    const topBarLen = Math.max(0, width - 2 - visibleWidth(titleLabel));
    const topLeft = Math.floor(topBarLen / 3);
    const topRight = topBarLen - topLeft;
    lines.push(
      chalk.dim("┌") +
      chalk.dim("─".repeat(topLeft)) +
      chalk.bold.cyan(titleLabel) +
      chalk.dim("─".repeat(topRight)) +
      chalk.dim("┐"),
    );

    // Content rows — only render actual content, no fill
    for (const line of content) {
      const padded = padLine(line, innerWidth);
      lines.push(chalk.dim("│") + " " + padded + " " + chalk.dim("│"));
    }

    // Footer
    const help = this.inputMode
      ? " Enter submit • Esc cancel"
      : this.isMulti
        ? " Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel"
        : " ↑↓ select • Enter confirm • Esc cancel";
    const footerPadded = padLine(chalk.dim(help), innerWidth);
    lines.push(chalk.dim("│") + " " + footerPadded + " " + chalk.dim("│"));

    // Bottom border
    lines.push(chalk.dim("└") + chalk.dim("─".repeat(width - 2)) + chalk.dim("┘"));

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  private buildContent(width: number): string[] {
    const lines: string[] = [];
    const q = this.currentQuestion();
    const opts = this.currentOptions();
    const add = (s: string) => lines.push(truncateToWidth(s, width));

    // Tab bar (multi-question only)
    if (this.isMulti) {
      const tabs: string[] = ["← "];
      for (let i = 0; i < this.questions.length; i++) {
        const isActive = i === this.currentTab;
        const isAnswered = this.answers.has(this.questions[i].id);
        const lbl = this.questions[i].label;
        const box = isAnswered ? "☒" : "□";
        const text = ` ${box} ${lbl} `;
        if (isActive) {
          tabs.push(chalk.bgBlueBright.white(text) + " ");
        } else if (isAnswered) {
          tabs.push(chalk.green(text) + " ");
        } else {
          tabs.push(chalk.dim(text) + " ");
        }
      }
      const canSubmit = this.allAnswered();
      const isSubmitTab = this.currentTab === this.questions.length;
      const submitText = " ✓ Submit ";
      if (isSubmitTab) {
        tabs.push(chalk.bgBlueBright.white(submitText) + " →");
      } else if (canSubmit) {
        tabs.push(chalk.green(submitText) + " →");
      } else {
        tabs.push(chalk.dim(submitText) + " →");
      }
      add(` ${tabs.join("")}`);
      lines.push("");
    }

    // Narrow terminal threshold for side-by-side preview
    const narrowTerminal = width < 76;

    // Helper to render options list (optionally side-by-side with preview)
    const renderOptions = () => {
      // Find markdown preview for selected option
      const selectedOpt = opts[this.optionIndex];
      const markdown = selectedOpt?.markdown;
      const hasPreview = !!markdown && !selectedOpt?.isOther;

      if (hasPreview && !narrowTerminal) {
        // Side-by-side: options on left ~40%, preview on right ~60%
        const leftWidth = Math.floor(width * 0.4);
        const rightWidth = width - leftWidth - 3; // 3 for " │ " separator
        const previewLines = buildPreviewBox(markdown!, rightWidth);
        const optLines = buildOptionLines(opts, this.optionIndex, this.inputMode, leftWidth);

        // Merge side-by-side
        const maxRows = Math.max(optLines.length, previewLines.length);
        for (let r = 0; r < maxRows; r++) {
          const left = r < optLines.length ? padLine(optLines[r], leftWidth) : " ".repeat(leftWidth);
          const right = r < previewLines.length ? previewLines[r] : " ".repeat(rightWidth);
          lines.push(truncateToWidth(left + chalk.dim(" │ ") + right, width));
        }
      } else {
        // Simple vertical list
        const optLines = buildOptionLines(opts, this.optionIndex, this.inputMode, width);
        for (const line of optLines) {
          add(line);
        }
        // If has preview and narrow, render stacked below
        if (hasPreview && narrowTerminal) {
          lines.push("");
          const previewLines = buildPreviewBox(markdown!, width - 2);
          for (const line of previewLines) {
            add(" " + line);
          }
        }
      }
    };

    // Content
    if (this.inputMode && q) {
      add(chalk.white(` ${q.prompt}`));
      lines.push("");
      renderOptions();
      lines.push("");
      add(chalk.dim(" Your answer:"));
      for (const line of this.editor.render(width - 2)) {
        add(` ${line}`);
      }
      lines.push("");
    } else if (this.currentTab === this.questions.length) {
      // Submit tab: review answers
      add(chalk.bold.cyan(" Review your answers"));
      lines.push("");
      for (const question of this.questions) {
        const answer = this.answers.get(question.id);
        if (answer) {
          const prefix = answer.wasCustom ? "(wrote) " : "";
          add(chalk.dim(` ● ${question.prompt}`));
          add(`   → ${prefix}${answer.label}`);
        } else {
          add(chalk.dim(` ○ ${question.prompt}`));
          add(chalk.yellow("   → (unanswered)"));
        }
      }
      lines.push("");
      if (this.allAnswered()) {
        add(chalk.green(" Ready to submit. Press Enter to confirm."));
      } else {
        const missing = this.questions
          .filter((q2) => !this.answers.has(q2.id))
          .map((q2) => q2.label)
          .join(", ");
        add(chalk.yellow(` Unanswered: ${missing}`));
      }
    } else if (q) {
      add(chalk.white(` ${q.prompt}`));
      lines.push("");
      renderOptions();
    }

    lines.push("");
    return lines;
  }
}

function buildOptionLines(
  opts: RenderOption[],
  selectedIndex: number,
  inputMode: boolean,
  _width: number,
): string[] {
  const lines: string[] = [];
  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i];
    const selected = i === selectedIndex;
    const isOther = opt.isOther === true;
    const prefix = selected ? chalk.cyan("❯ ") : "  ";

    if (isOther && inputMode) {
      lines.push(prefix + chalk.cyan(`${i + 1}. ${opt.label} ✎`));
    } else if (selected) {
      lines.push(prefix + chalk.bold.white(`${i + 1}. ${opt.label}`));
    } else {
      lines.push(prefix + `${i + 1}. ${opt.label}`);
    }
    if (opt.description) {
      lines.push(`     ${chalk.dim(opt.description)}`);
    }
  }
  return lines;
}

function buildPreviewBox(markdown: string, width: number): string[] {
  const innerWidth = Math.max(1, width - 4); // border + padding
  const lines: string[] = [];

  // Top border
  lines.push(chalk.dim("┌" + "─".repeat(innerWidth + 2) + "┐"));

  // Content — wrap text
  const rawLines = markdown.split("\n");
  for (const raw of rawLines) {
    if (raw === "") {
      lines.push(chalk.dim("│") + " ".repeat(innerWidth + 2) + chalk.dim("│"));
      continue;
    }
    // Simple word-wrap
    const words = raw.split(/\s+/);
    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (visibleWidth(current + " " + word) <= innerWidth) {
        current += " " + word;
      } else {
        lines.push(chalk.dim("│") + " " + padLine(current, innerWidth) + " " + chalk.dim("│"));
        current = word;
      }
    }
    if (current) {
      lines.push(chalk.dim("│") + " " + padLine(current, innerWidth) + " " + chalk.dim("│"));
    }
  }

  // Bottom border
  lines.push(chalk.dim("└" + "─".repeat(innerWidth + 2) + "┘"));
  return lines;
}

function padLine(line: string, width: number): string {
  const vw = visibleWidth(line);
  if (vw >= width) return truncateToWidth(line, width, "…", true);
  return line + " ".repeat(width - vw);
}
