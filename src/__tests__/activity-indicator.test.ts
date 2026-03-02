import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ActivityIndicator } from "../components/activity-indicator.js";

describe("ActivityIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with Thinking and 0s", () => {
    const indicator = new ActivityIndicator();
    indicator.start();
    const output = indicator.render();
    expect(output).toContain("Thinking");
    expect(output).toContain("0s");
    indicator.stop();
  });

  it("updates elapsed time after 1 second", () => {
    const indicator = new ActivityIndicator();
    indicator.start();
    vi.advanceTimersByTime(1000);
    const output = indicator.render();
    expect(output).toContain("1s");
    indicator.stop();
  });

  it("addTool shows tool name instead of Thinking", () => {
    const indicator = new ActivityIndicator();
    indicator.start();
    indicator.addTool("read_file");
    const output = indicator.render();
    expect(output).toContain("read_file");
    expect(output).not.toContain("Thinking");
    indicator.stop();
  });

  it("multiple tools are comma-separated", () => {
    const indicator = new ActivityIndicator();
    indicator.start();
    indicator.addTool("read_file");
    indicator.addTool("write_file");
    const output = indicator.render();
    expect(output).toContain("read_file, write_file");
    indicator.stop();
  });

  it("does not add duplicate tool names", () => {
    const indicator = new ActivityIndicator();
    indicator.start();
    indicator.addTool("read_file");
    indicator.addTool("read_file");
    const output = indicator.render();
    // Should only appear once
    const matches = output.match(/read_file/g);
    expect(matches).toHaveLength(1);
    indicator.stop();
  });

  it("stop clears interval", () => {
    const clearSpy = vi.spyOn(global, "clearInterval");
    const indicator = new ActivityIndicator();
    indicator.start();
    indicator.stop();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("cycles spinner frames on 80ms interval", () => {
    const indicator = new ActivityIndicator();
    indicator.start();
    const first = indicator.render();
    // Braille spinner starts with ⠋
    expect(first).toContain("⠋");
    vi.advanceTimersByTime(80);
    const second = indicator.render();
    expect(second).toContain("⠙");
    indicator.stop();
  });

  it("shows elapsed time with tools", () => {
    const indicator = new ActivityIndicator();
    indicator.start();
    indicator.addTool("grep");
    vi.advanceTimersByTime(3000);
    const output = indicator.render();
    expect(output).toContain("grep");
    expect(output).toContain("3s");
    indicator.stop();
  });
});
