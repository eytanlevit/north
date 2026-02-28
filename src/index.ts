import "dotenv/config";
import { ProcessTerminal, TUI, matchesKey } from "@mariozechner/pi-tui";
import { ChatPane } from "./components/chat-pane.js";
import { KanbanPane } from "./components/kanban-pane.js";
import { HorizontalSplit } from "./components/horizontal-split.js";
import { createPMAgent } from "./agent.js";
import { onIssueChange } from "./issues.js";
import type { AgentEvent } from "@mariozechner/pi-agent-core";

const cwd = process.cwd();

// Bootstrap TUI
const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

// Create components
const chatPane = new ChatPane(tui);
const kanbanPane = new KanbanPane(cwd);
const split = new HorizontalSplit(chatPane, kanbanPane, 0.55);
tui.addChild(split);

// Focus the chat editor by default
tui.setFocus(chatPane.editor);
tui.requestRender();

// Create agent
const agent = createPMAgent(cwd);

// Wire issue changes → kanban refresh
onIssueChange(() => {
  kanbanPane.refresh();
  tui.requestRender();
});

// Wire chat submit → agent prompt
chatPane.onSubmit = (text: string) => {
  chatPane.addUserMessage(text);
  agent.prompt(text).catch((err: Error) => {
    chatPane.addAssistantMessage(`**Error:** ${err.message}`);
  });
};

// Wire agent events → chat pane
let streamingText = "";

agent.subscribe((event: AgentEvent) => {
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
  }
});

// Focus starts on chat
chatPane.focused = true;
kanbanPane.focused = false;

// Global key handling
tui.addInputListener((data: string) => {
  // Ctrl+C → clean exit
  if (matchesKey(data, "ctrl+c")) {
    agent.abort();
    tui.stop();
    process.exit(0);
    return { consume: true };
  }
  // Tab → toggle focus between chat and kanban
  if (matchesKey(data, "tab")) {
    if (chatPane.focused) {
      chatPane.focused = false;
      kanbanPane.focused = true;
      tui.setFocus(null);
    } else {
      kanbanPane.focused = false;
      chatPane.focused = true;
      tui.setFocus(chatPane.editor);
    }
    tui.requestRender();
    return { consume: true };
  }
  // Route input to focused pane when kanban has focus
  if (kanbanPane.focused) {
    kanbanPane.handleInput(data);
    tui.requestRender();
    return { consume: true };
  }
  return undefined;
});

// Clear screen before starting TUI
process.stdout.write("\x1b[2J\x1b[H");
tui.start();
