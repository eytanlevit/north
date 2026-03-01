import "dotenv/config";
import { ProcessTerminal, TUI, matchesKey, isKeyRelease } from "@mariozechner/pi-tui";
import type { OverlayHandle } from "@mariozechner/pi-tui";
import { ChatPane } from "./components/chat-pane.js";
import { KanbanPane } from "./components/kanban-pane.js";
import { HorizontalSplit } from "./components/horizontal-split.js";
import { IssueDetailView } from "./components/issue-detail.js";
import { ProjectDetailView } from "./components/project-detail.js";
import { QuestionnaireOverlay } from "./components/questionnaire-overlay.js";
import type { Question, QuestionnaireResult } from "./tools/ask-questions.js";
import { createPMSession } from "./agent.js";
import { onIssueChange } from "./issues.js";
import { loadConfig } from "./config.js";

const cwd = process.cwd();
const config = loadConfig(cwd);

// Bootstrap TUI
const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

// Create components
const chatPane = new ChatPane(tui);
const kanbanPane = new KanbanPane(cwd, config);
const split = new HorizontalSplit(chatPane, kanbanPane, 0.55);
tui.addChild(split);

// Focus the chat editor by default
tui.setFocus(chatPane.editor);
tui.requestRender();

// Questionnaire overlay callback for the ask_questions tool
function showQuestionnaire(questions: Question[], signal?: AbortSignal): Promise<QuestionnaireResult> {
  return new Promise<QuestionnaireResult>((resolve) => {
    const onDone = (result: QuestionnaireResult) => {
      if (questionnaireOverlay) {
        questionnaireOverlay.hide();
        questionnaireOverlay = null;
      }
      questionnaireView = null;
      tui.setFocus(chatPane.editor);

      // Add Q&A summary to chat log
      if (result.cancelled) {
        chatPane.addAssistantMessage("*Questionnaire cancelled.*");
      } else {
        const answerMap = new Map(result.answers.map((a) => [a.id, a.label]));
        const lines = result.questions.map((q) => {
          const answer = answerMap.get(q.id) ?? "—";
          return `**Q: ${q.prompt}**\n\u2192 ${answer}`;
        });
        chatPane.addAssistantMessage(lines.join("\n\n"));
      }

      tui.requestRender();
      resolve(result);
    };

    try {
      questionnaireView = new QuestionnaireOverlay(tui, questions, onDone, signal);
      questionnaireOverlay = tui.showOverlay(questionnaireView, {
        width: "70%",
        maxHeight: "60%",
        anchor: "center",
      });
      tui.requestRender();
    } catch {
      questionnaireView = null;
      resolve({ questions, answers: [], cancelled: true });
    }
  });
}

// Create session (resumes previous if available)
const { session, resumed } = await createPMSession(cwd, showQuestionnaire);

// Replay previous messages into the chat pane on resume
if (resumed) {
  const context = session.sessionManager.buildSessionContext();
  for (const msg of context.messages) {
    if (msg.role === "user") {
      const text = typeof msg.content === "string"
        ? msg.content
        : (msg.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === "text")
            .map((c) => c.text ?? "")
            .join("");
      if (text) chatPane.addUserMessage(text);
    } else if (msg.role === "assistant") {
      const text = (msg.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
      if (text) chatPane.addAssistantMessage(text);
    }
  }
  chatPane.addAssistantMessage("*Resumed previous session.* Type `/new` to start fresh.");
}

// Overlay state
let detailOverlay: OverlayHandle | null = null;
let detailView: IssueDetailView | ProjectDetailView | null = null;
let questionnaireOverlay: OverlayHandle | null = null;
let questionnaireView: QuestionnaireOverlay | null = null;

// Wire kanban selection → show detail overlay
kanbanPane.onSelectIssue = (issue) => {
  detailView = new IssueDetailView(issue, () => {
    // Close the overlay
    if (detailOverlay) {
      detailOverlay.hide();
      detailOverlay = null;
    }
    detailView = null;
    tui.requestRender();
  });
  detailOverlay = tui.showOverlay(detailView, {
    width: "100%",
    maxHeight: "100%",
    anchor: "center",
  });
  tui.requestRender();
};

// Wire kanban project header → show project detail overlay
kanbanPane.onSelectProject = () => {
  detailView = new ProjectDetailView(cwd, config, () => {
    if (detailOverlay) {
      detailOverlay.hide();
      detailOverlay = null;
    }
    detailView = null;
    tui.requestRender();
  });
  detailOverlay = tui.showOverlay(detailView, {
    width: "100%",
    maxHeight: "100%",
    anchor: "center",
  });
  tui.requestRender();
};

// Wire issue changes → kanban refresh
onIssueChange(() => {
  kanbanPane.refresh();
  tui.requestRender();
});

// Wire chat submit → session prompt
chatPane.onSubmit = (text: string) => {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === "/new" || trimmed === "/clear") {
    session.newSession().then(() => {
      chatPane.clear();
      chatPane.addAssistantMessage("New session started.");
    });
    return;
  }

  chatPane.addUserMessage(text);
  session.prompt(text).catch((err: Error) => {
    chatPane.addAssistantMessage(`**Error:** ${err.message}`);
  });
};

// Wire session events → chat pane
let streamingText = "";

session.subscribe((event) => {
  switch (event.type) {
    case "message_update": {
      if (event.assistantMessageEvent.type === "text_delta") {
        streamingText += event.assistantMessageEvent.delta;
        chatPane.setStreamingText(streamingText);
      }
      break;
    }
    case "message_end": {
      if (event.message.role === "assistant") {
        chatPane.finalizeMessage();
        streamingText = "";
      }
      break;
    }
    case "tool_execution_start": {
      chatPane.setToolStatus(event.toolName);
      break;
    }
    case "tool_execution_end": {
      chatPane.setToolStatus(null);
      break;
    }
    case "agent_end": {
      chatPane.setToolStatus(null);
      streamingText = "";
      break;
    }
    case "auto_compaction_start": {
      chatPane.setToolStatus("Compacting context...");
      break;
    }
    case "auto_compaction_end": {
      chatPane.setToolStatus(null);
      break;
    }
    case "auto_retry_start": {
      chatPane.setToolStatus(`Retrying (attempt ${(event as any).attempt})...`);
      break;
    }
    case "auto_retry_end": {
      chatPane.setToolStatus(null);
      break;
    }
  }
});

// Focus starts on chat
chatPane.focused = true;
kanbanPane.focused = false;

// Global key handling
const SCROLL_LINES = 3;
const SGR_MOUSE_RE = /\x1b\[<(\d+);(\d+);(\d+)[mM]/;

tui.addInputListener((data: string) => {
  // Ctrl+C → clean exit
  if (matchesKey(data, "ctrl+c")) {
    session.abort();
    tui.stop();
    process.exit(0);
    return { consume: true };
  }

  // Handle SGR mouse scroll events
  const mouseMatch = SGR_MOUSE_RE.exec(data);
  if (mouseMatch) {
    const button = parseInt(mouseMatch[1], 10);
    const x = parseInt(mouseMatch[2], 10);

    // Only handle scroll: 64 = scroll up, 65 = scroll down
    if (button !== 64 && button !== 65) return undefined;

    const termWidth = process.stdout.columns || 80;
    const splitBoundary = Math.floor(termWidth * 0.55);

    if (x <= splitBoundary) {
      // Chat pane: positive delta = scroll up (away from bottom)
      chatPane.scrollBy(button === 64 ? SCROLL_LINES : -SCROLL_LINES);
    } else {
      // Kanban pane: positive delta = scroll down (content moves up)
      kanbanPane.scrollBy(button === 64 ? -SCROLL_LINES : SCROLL_LINES);
      tui.requestRender();
    }
    return { consume: true };
  }

  // Filter out key release events (Kitty protocol sends both press + release)
  if (isKeyRelease(data)) return { consume: true };

  // Route input to questionnaire overlay when it's open
  if (questionnaireView) {
    questionnaireView.handleInput(data);
    tui.requestRender();
    return { consume: true };
  }

  // Route input to detail view when it's open
  if (detailView) {
    detailView.handleInput(data);
    tui.requestRender();
    return { consume: true };
  }

  // Tab → 3-stop cycle: chat → kanban issues → project header → chat
  if (matchesKey(data, "tab")) {
    if (chatPane.focused) {
      // chat → kanban issues
      chatPane.focused = false;
      kanbanPane.focused = true;
      kanbanPane.headerSelected = false;
      kanbanPane.invalidate();
      tui.setFocus(null);
    } else if (kanbanPane.focused && !kanbanPane.headerSelected) {
      // kanban issues → project header
      kanbanPane.headerSelected = true;
      kanbanPane.invalidate();
    } else {
      // project header → chat
      kanbanPane.focused = false;
      kanbanPane.headerSelected = false;
      kanbanPane.invalidate();
      chatPane.focused = true;
      tui.setFocus(chatPane.editor);
    }
    tui.requestRender();
    return { consume: true };
  }

  // When kanban is focused, route input to it
  if (kanbanPane.focused) {
    kanbanPane.handleInput(data);
    tui.requestRender();
    return { consume: true };
  }

  return undefined;
});

// Clean exit handler: disable mouse reporting and stop TUI
function cleanup() {
  process.stdout.write("\x1b[?1000l\x1b[?1006l");
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });

// Clear screen before starting TUI
process.stdout.write("\x1b[2J\x1b[H");
tui.start();

// Enable mouse button/wheel reporting with SGR encoding
process.stdout.write("\x1b[?1000h\x1b[?1006h");
