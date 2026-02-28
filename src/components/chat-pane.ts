import type { Component, Focusable, MarkdownTheme } from "@mariozechner/pi-tui";
import { Container, Editor, Markdown, Text, Spacer, visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";
import type { TUI, EditorTheme } from "@mariozechner/pi-tui";
import chalk from "chalk";

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

export class ChatPane implements Component, Focusable {
  focused = false;
  onSubmit?: (text: string) => void;

  private tui: TUI;
  private container: Container;
  private messagesContainer: Container;
  private statusText: Text;
  private _editor: Editor;
  private streamingMarkdown: Markdown | null = null;

  constructor(tui: TUI) {
    this.tui = tui;
    this.container = new Container();
    this.messagesContainer = new Container();

    // Title
    this.messagesContainer.addChild(new Text(chalk.bold(" PM AGENT"), 0, 0));
    this.messagesContainer.addChild(new Text(chalk.dim(" Type a message to create/manage issues"), 0, 0));
    this.messagesContainer.addChild(new Spacer(1));

    this.statusText = new Text("", 0, 0);

    this._editor = new Editor(tui, editorTheme);
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

  addUserMessage(text: string): void {
    this.messagesContainer.addChild(
      new Text(chalk.bold.green("You: ") + text, 1, 0)
    );
    this.messagesContainer.addChild(new Spacer(1));
    this.tui.requestRender();
  }

  addAssistantMessage(text: string): void {
    this.messagesContainer.addChild(
      new Markdown(text, 1, 0, markdownTheme, {
        color: (t: string) => chalk.white(t),
      })
    );
    this.messagesContainer.addChild(new Spacer(1));
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

  invalidate(): void {
    this.container.invalidate();
  }

  render(width: number): string[] {
    return this.container.render(width);
  }

  handleInput(data: string): void {
    this._editor.handleInput(data);
  }
}
