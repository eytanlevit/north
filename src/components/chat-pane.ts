import type { Component, Focusable, MarkdownTheme } from "@mariozechner/pi-tui";
import { Container, Editor, Markdown, Text, Spacer, visibleWidth, truncateToWidth, matchesKey } from "@mariozechner/pi-tui";
import type { TUI, EditorTheme } from "@mariozechner/pi-tui";
import chalk from "chalk";
import { ActivityIndicator } from "./activity-indicator.js";

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

const markdownTheme: MarkdownTheme = {
  heading: (t: string) => chalk.bold.cyan(t),
  link: (t: string) => chalk.blue(t),
  linkUrl: (t: string) => chalk.dim.blue(t),
  code: (t: string) => chalk.yellow(t),
  codeBlock: (t: string) => chalk.gray(t),
  codeBlockBorder: (t: string) => chalk.dim(t),
  quote: (t: string) => chalk.italic.dim(t),
  quoteBorder: (t: string) => chalk.dim(t),
  hr: (t: string) => chalk.dim(t),
  listBullet: (t: string) => chalk.cyan(t),
  bold: (t: string) => chalk.bold(t),
  italic: (t: string) => chalk.italic(t),
  strikethrough: (t: string) => chalk.strikethrough(t),
  underline: (t: string) => chalk.underline(t),
};

export interface PendingImage {
  data: string;
  mimeType: string;
}

export class ChatPane implements Component, Focusable {
  focused = false;
  onSubmit?: (text: string) => void;

  private tui: TUI;
  private container: Container;
  private messagesContainer: Container;
  private statusText: Text;
  private _editor: Editor;
  private streamingMarkdown: Markdown | null = null;
  private scrollOffset = 0;
  private scrollLocked = true; // true = auto-scroll to bottom
  private activityIndicator: ActivityIndicator | null = null;
  private activityRenderInterval: ReturnType<typeof setInterval> | null = null;
  private _pendingImages: PendingImage[] = [];

  constructor(tui: TUI) {
    this.tui = tui;
    this.container = new Container();
    this.messagesContainer = new Container();

    // Title
    this.messagesContainer.addChild(new Text(chalk.bold(" PM AGENT"), 0, 0));
    this.messagesContainer.addChild(new Text(chalk.dim(" Type a message to create/manage issues"), 0, 0));
    this.messagesContainer.addChild(new Spacer(1));

    this.statusText = new Text("", 0, 0);

    this._editor = new Editor(tui, editorTheme, { paddingX: 2 });
    this._editor.onSubmit = (text: string) => {
      if (!text.trim()) return;
      this._editor.setText("");
      this.onSubmit?.(text);
    };

    this.container.addChild(this.messagesContainer);
    this.container.addChild(this.statusText);
    this.container.addChild(this._editor);
  }

  get editor(): Editor {
    return this._editor;
  }

  addPendingImage(data: string, mimeType: string): void {
    this._pendingImages.push({ data, mimeType });
  }

  getPendingImages(): PendingImage[] {
    const images = this._pendingImages;
    this._pendingImages = [];
    return images;
  }

  addUserMessage(text: string): void {
    const imageCount = this._pendingImages.length;
    let display = chalk.green("▎ ") + chalk.bgRgb(25, 35, 25)(" " + text + " ");
    if (imageCount > 0) {
      const label = imageCount === 1 ? "1 image" : `${imageCount} images`;
      display += " " + chalk.dim(`[📎 ${label}]`);
    }
    this.messagesContainer.addChild(new Text(display, 1, 0));
    this.messagesContainer.addChild(new Spacer(1));
    this.scrollLocked = true;
    this.scrollOffset = 0;
    this.tui.requestRender();
  }

  addAssistantMessage(text: string): void {
    this.messagesContainer.addChild(
      new Markdown(text, 1, 0, markdownTheme, {
        color: (t: string) => chalk.white(t),
      })
    );
    this.messagesContainer.addChild(new Spacer(1));
    this.scrollLocked = true;
    this.scrollOffset = 0;
    this.tui.requestRender();
  }

  setStreamingText(text: string): void {
    if (!this.streamingMarkdown) {
      this.streamingMarkdown = new Markdown(text, 1, 0, markdownTheme, {
        color: (t: string) => chalk.white(t),
      });
      this.messagesContainer.addChild(this.streamingMarkdown);
    } else {
      this.streamingMarkdown.setText(text);
    }
    this.scrollLocked = true;
    this.scrollOffset = 0;
    this.tui.requestRender();
  }

  finalizeMessage(): void {
    if (this.streamingMarkdown) {
      this.messagesContainer.addChild(new Spacer(1));
      this.streamingMarkdown = null;
    }
    this.tui.requestRender();
  }

  setToolStatus(toolName: string | null): void {
    if (toolName) {
      this.statusText.setText(chalk.dim(`  ⟳ Running: ${toolName}...`));
    } else {
      this.statusText.setText("");
    }
    this.tui.requestRender();
  }

  startActivity(): void {
    this.stopActivity();
    this.activityIndicator = new ActivityIndicator();
    this.activityIndicator.start();
    this.updateActivityStatus();
    this.activityRenderInterval = setInterval(() => {
      this.updateActivityStatus();
    }, 80);
  }

  addActivityTool(toolName: string): void {
    if (this.activityIndicator) {
      this.activityIndicator.addTool(toolName);
      this.updateActivityStatus();
    }
  }

  stopActivity(): void {
    if (this.activityRenderInterval !== null) {
      clearInterval(this.activityRenderInterval);
      this.activityRenderInterval = null;
    }
    if (this.activityIndicator) {
      this.activityIndicator.stop();
      this.activityIndicator = null;
    }
    this.statusText.setText("");
    this.tui.requestRender();
  }

  isActivityActive(): boolean {
    return this.activityIndicator !== null;
  }

  private updateActivityStatus(): void {
    if (this.activityIndicator) {
      this.statusText.setText(chalk.dim(`  ${this.activityIndicator.render()}`));
      this.tui.requestRender();
    }
  }

  clear(): void {
    this.messagesContainer.clear();
    this.messagesContainer.addChild(new Text(chalk.bold(" PM AGENT"), 0, 0));
    this.messagesContainer.addChild(new Text(chalk.dim(" Type a message to create/manage issues"), 0, 0));
    this.messagesContainer.addChild(new Spacer(1));
    this.streamingMarkdown = null;
    this.scrollOffset = 0;
    this.scrollLocked = true;
    this.tui.requestRender();
  }

  invalidate(): void {
    this.container.invalidate();
  }

  render(width: number): string[] {
    const terminalHeight = process.stdout.rows || 24;

    // Render editor and status first to know their heights
    const editorLines = this._editor.render(width);
    // Inject "> " prompt into the first content line (after the border)
    if (editorLines.length > 1) {
      editorLines[1] = chalk.cyan("> ") + editorLines[1].slice(2);
    }
    const statusLines = this.statusText.render(width);

    const reservedHeight = editorLines.length + statusLines.length;
    const availableForMessages = Math.max(1, terminalHeight - reservedHeight);

    // Render all messages
    const messageLines = this.messagesContainer.render(width);

    let visibleMessages: string[];
    if (messageLines.length <= availableForMessages) {
      // Pad so editor sticks to the bottom
      const pad = new Array(availableForMessages - messageLines.length).fill("");
      visibleMessages = [...messageLines, ...pad];
      this.scrollOffset = 0;
    } else if (this.scrollLocked) {
      // Auto-scroll to bottom
      this.scrollOffset = 0;
      visibleMessages = messageLines.slice(messageLines.length - availableForMessages);
    } else {
      // Manual scroll position: scrollOffset is lines from the bottom
      const maxOffset = messageLines.length - availableForMessages;
      this.scrollOffset = Math.min(this.scrollOffset, maxOffset);
      const endIndex = messageLines.length - this.scrollOffset;
      const startIndex = endIndex - availableForMessages;
      visibleMessages = messageLines.slice(startIndex, endIndex);
    }

    return [...visibleMessages, ...statusLines, ...editorLines];
  }

  /** Scroll by delta lines (positive = up, negative = down) */
  scrollBy(delta: number): void {
    if (delta > 0) {
      // Scroll up
      this.scrollLocked = false;
      this.scrollOffset += delta;
    } else if (delta < 0) {
      // Scroll down
      this.scrollOffset += delta;
      if (this.scrollOffset <= 0) {
        this.scrollOffset = 0;
        this.scrollLocked = true;
      }
    }
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    // Scroll history with PageUp/PageDown or Shift+Up/Shift+Down
    if (matchesKey(data, "pageUp") || matchesKey(data, "shift+up")) {
      this.scrollLocked = false;
      this.scrollOffset += 5;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, "pageDown") || matchesKey(data, "shift+down")) {
      if (this.scrollOffset > 0) {
        this.scrollOffset -= 5;
        if (this.scrollOffset <= 0) {
          this.scrollOffset = 0;
          this.scrollLocked = true;
        }
      }
      this.tui.requestRender();
      return;
    }

    // All other input goes to the editor
    this._editor.handleInput(data);
  }
}
