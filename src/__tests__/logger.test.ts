import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ConversationLogger } from "../logger.js";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, ToolResultMessage } from "@mariozechner/pi-ai";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmtui-logger-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function readLines(pmDir: string): Record<string, unknown>[] {
  const logsDir = path.join(pmDir, "logs");
  const files = fs.readdirSync(logsDir).filter((f) => f.endsWith(".jsonl"));
  expect(files.length).toBeGreaterThan(0);
  const content = fs.readFileSync(path.join(logsDir, files[0]), "utf-8");
  return content
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

describe("ConversationLogger", () => {
  it("creates logs dir and session file", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.close();

    const logsDir = path.join(tmpDir, "logs");
    expect(fs.existsSync(logsDir)).toBe(true);
    const files = fs.readdirSync(logsDir).filter((f) => f.endsWith(".jsonl"));
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-.+\.jsonl$/);
  });

  it("writes session_start as first entry with seq=0", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.close();

    const lines = readLines(tmpDir);
    expect(lines[0]).toMatchObject({
      seq: 0,
      turnId: 0,
      event: "session_start",
    });
    expect(lines[0]).toHaveProperty("ts");
    expect(lines[0]).toHaveProperty("cwd");
  });

  it("logs user prompt with incremented turnId", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.logUserPrompt("hello");
    logger.close();

    const lines = readLines(tmpDir);
    const prompt = lines.find((l) => l.event === "user_prompt");
    expect(prompt).toMatchObject({
      seq: 1,
      turnId: 1,
      event: "user_prompt",
      text: "hello",
    });
  });

  it("increments seq across multiple log calls", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.logUserPrompt("first");
    logger.logUserPrompt("second");
    logger.close();

    const lines = readLines(tmpDir);
    const seqs = lines.map((l) => l.seq);
    // session_start=0, first prompt=1, second prompt=2, session_end=3
    expect(seqs).toEqual([0, 1, 2, 3]);
  });

  it("correlates events with same turnId", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.logUserPrompt("question");

    const agentStart: AgentEvent = { type: "agent_start" };
    logger.log(agentStart);

    const agentEnd: AgentEvent = {
      type: "agent_end",
      messages: [],
    };
    logger.log(agentEnd);

    logger.close();

    const lines = readLines(tmpDir);
    const promptLine = lines.find((l) => l.event === "user_prompt");
    const startLine = lines.find((l) => l.event === "agent_start");
    const endLine = lines.find((l) => l.event === "agent_end");

    expect(promptLine!.turnId).toBe(1);
    expect(startLine!.turnId).toBe(1);
    expect(endLine!.turnId).toBe(1);
  });

  it("logs assistant message_end with text, model, usage, stopReason", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.logUserPrompt("hi");

    const msg: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello there!" }],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      usage: {
        input: 100,
        output: 50,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 150,
        cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };

    const event: AgentEvent = { type: "message_end", message: msg };
    logger.log(event);
    logger.close();

    const lines = readLines(tmpDir);
    const entry = lines.find((l) => l.event === "message_end" && l.role === "assistant");
    expect(entry).toMatchObject({
      event: "message_end",
      role: "assistant",
      text: "Hello there!",
      model: "claude-sonnet-4-5-20250929",
      stopReason: "stop",
    });
    expect(entry!.usage).toMatchObject({ input: 100, output: 50, totalTokens: 150 });
  });

  it("logs tool_execution_start and tool_execution_end", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.logUserPrompt("create issue");

    const startEvent: AgentEvent = {
      type: "tool_execution_start",
      toolCallId: "tc_1",
      toolName: "create_issue",
      args: { title: "Auth", priority: "high" },
    };
    logger.log(startEvent);

    const endEvent: AgentEvent = {
      type: "tool_execution_end",
      toolCallId: "tc_1",
      toolName: "create_issue",
      result: {
        content: [{ type: "text", text: "Created ISS-001" }],
        details: {},
      },
      isError: false,
    };
    logger.log(endEvent);
    logger.close();

    const lines = readLines(tmpDir);
    const toolStart = lines.find((l) => l.event === "tool_start");
    expect(toolStart).toMatchObject({
      event: "tool_start",
      toolName: "create_issue",
      toolCallId: "tc_1",
      args: { title: "Auth", priority: "high" },
    });

    const toolEnd = lines.find((l) => l.event === "tool_end");
    expect(toolEnd).toMatchObject({
      event: "tool_end",
      toolName: "create_issue",
      toolCallId: "tc_1",
      isError: false,
    });
    expect(toolEnd!.resultText).toBeDefined();
  });

  it("logs toolResult message_end with toolName and isError", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.logUserPrompt("test");

    const msg: ToolResultMessage = {
      role: "toolResult",
      toolCallId: "tc_1",
      toolName: "create_issue",
      content: [{ type: "text", text: "Created ISS-001" }],
      isError: false,
      timestamp: Date.now(),
    };

    const event: AgentEvent = { type: "message_end", message: msg };
    logger.log(event);
    logger.close();

    const lines = readLines(tmpDir);
    const entry = lines.find((l) => l.event === "message_end" && l.role === "toolResult");
    expect(entry).toMatchObject({
      event: "message_end",
      role: "toolResult",
      toolName: "create_issue",
      isError: false,
      text: "Created ISS-001",
    });
  });

  it("truncates large payloads to 10KB", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.logUserPrompt("test");

    const bigArgs = { data: "x".repeat(20_000) };
    const event: AgentEvent = {
      type: "tool_execution_start",
      toolCallId: "tc_big",
      toolName: "big_tool",
      args: bigArgs,
    };
    logger.log(event);
    logger.close();

    const lines = readLines(tmpDir);
    const entry = lines.find((l) => l.event === "tool_start");
    const argsStr = JSON.stringify(entry!.args);
    expect(argsStr.length).toBeLessThanOrEqual(10_300); // 10KB + small overhead
    expect(entry!.truncated).toBe(true);
  });

  it("skips noisy events (message_start, message_update, turn_start, turn_end, tool_execution_update)", () => {
    const logger = new ConversationLogger(tmpDir);

    const msg: AssistantMessage = {
      role: "assistant",
      content: [],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "test",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    };

    const noisyEvents: AgentEvent[] = [
      { type: "message_start", message: msg },
      { type: "message_update", message: msg, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hi", partial: msg } },
      { type: "turn_start" },
      { type: "turn_end", message: msg, toolResults: [] },
      { type: "tool_execution_update", toolCallId: "tc_1", toolName: "test", args: {}, partialResult: {} },
    ];

    for (const event of noisyEvents) {
      logger.log(event);
    }
    logger.close();

    const lines = readLines(tmpDir);
    const events = lines.map((l) => l.event);
    // Only session_start and session_end
    expect(events).toEqual(["session_start", "session_end"]);
  });

  it("writes session_end on close and all lines are valid JSONL", () => {
    const logger = new ConversationLogger(tmpDir);
    logger.logUserPrompt("hi");
    logger.close();

    const logsDir = path.join(tmpDir, "logs");
    const files = fs.readdirSync(logsDir).filter((f) => f.endsWith(".jsonl"));
    const content = fs.readFileSync(path.join(logsDir, files[0]), "utf-8");
    const rawLines = content.trim().split("\n");

    // Every line should be valid JSON
    for (const line of rawLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    const lines = rawLines.map((l) => JSON.parse(l));
    const lastLine = lines[lines.length - 1];
    expect(lastLine.event).toBe("session_end");
  });

  it("creates separate files for multiple loggers", () => {
    const logger1 = new ConversationLogger(tmpDir);
    logger1.close();

    const logger2 = new ConversationLogger(tmpDir);
    logger2.close();

    const logsDir = path.join(tmpDir, "logs");
    const files = fs.readdirSync(logsDir).filter((f) => f.endsWith(".jsonl"));
    expect(files.length).toBe(2);
    expect(files[0]).not.toBe(files[1]);
  });
});
