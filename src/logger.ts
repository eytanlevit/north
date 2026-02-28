import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, ToolResultMessage, TextContent } from "@mariozechner/pi-ai";

const MAX_PAYLOAD_BYTES = 10_240; // 10KB

function truncateString(value: unknown): { value: unknown; truncated: boolean } {
  const str = JSON.stringify(value);
  if (str.length <= MAX_PAYLOAD_BYTES) return { value, truncated: false };
  return { value: str.slice(0, MAX_PAYLOAD_BYTES), truncated: true };
}

function extractText(content: (TextContent | { type: string })[]) {
  return content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text)
    .join("");
}

function extractResultText(result: unknown): string {
  if (!result || typeof result !== "object") return String(result ?? "");
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.content)) return extractText(r.content as TextContent[]);
  return JSON.stringify(result).slice(0, MAX_PAYLOAD_BYTES);
}

export class ConversationLogger {
  private fd: number;
  private seq = 0;
  private turnId = 0;
  private closed = false;

  constructor(private pmDir: string) {
    const logsDir = path.join(pmDir, "logs");
    fs.mkdirSync(logsDir, { recursive: true });

    const now = new Date().toISOString().replace(/:/g, "-").replace(/\.\d+Z$/, "");
    const suffix = crypto.randomBytes(3).toString("hex");
    const filename = `session-${now}-${suffix}.jsonl`;

    this.fd = fs.openSync(path.join(logsDir, filename), "a");

    this.writeLine({
      event: "session_start",
      cwd: process.cwd(),
    });
  }

  log(event: AgentEvent): void {
    switch (event.type) {
      case "agent_start":
        this.writeLine({ event: "agent_start" });
        break;

      case "agent_end":
        this.writeLine({
          event: "agent_end",
          messageCount: event.messages.length,
        });
        break;

      case "message_end": {
        const msg = event.message;
        if ("role" in msg && msg.role === "assistant") {
          const am = msg as AssistantMessage;
          this.writeLine({
            event: "message_end",
            role: "assistant",
            text: extractText(am.content),
            model: am.model,
            usage: { input: am.usage.input, output: am.usage.output, totalTokens: am.usage.totalTokens },
            stopReason: am.stopReason,
          });
        } else if ("role" in msg && msg.role === "toolResult") {
          const tr = msg as ToolResultMessage;
          this.writeLine({
            event: "message_end",
            role: "toolResult",
            toolName: tr.toolName,
            isError: tr.isError,
            text: extractText(tr.content),
          });
        }
        break;
      }

      case "tool_execution_start": {
        const { value: args, truncated } = truncateString(event.args);
        const entry: Record<string, unknown> = {
          event: "tool_start",
          toolName: event.toolName,
          toolCallId: event.toolCallId,
          args,
        };
        if (truncated) entry.truncated = true;
        this.writeLine(entry);
        break;
      }

      case "tool_execution_end": {
        const resultText = extractResultText(event.result);
        const { value: text, truncated } = truncateString(resultText);
        const entry: Record<string, unknown> = {
          event: "tool_end",
          toolName: event.toolName,
          toolCallId: event.toolCallId,
          isError: event.isError,
          resultText: text,
        };
        if (truncated) entry.truncated = true;
        this.writeLine(entry);
        break;
      }

      // Skip noisy events: message_start, message_update, turn_start, turn_end, tool_execution_update
    }
  }

  logUserPrompt(text: string): void {
    this.turnId++;
    this.writeLine({
      event: "user_prompt",
      text,
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.writeLine({ event: "session_end" });
    fs.closeSync(this.fd);
  }

  private writeLine(entry: Record<string, unknown>): void {
    entry.seq = this.seq++;
    entry.turnId = this.turnId;
    entry.ts = new Date().toISOString();
    try {
      fs.writeSync(this.fd, JSON.stringify(entry) + "\n");
    } catch (err) {
      process.stderr.write(`[ConversationLogger] write error: ${err}\n`);
    }
  }
}
