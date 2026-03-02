import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChatPane } from "../components/chat-pane.js";

// Minimal TUI stub for ChatPane constructor
function createStubTui() {
  return {
    requestRender: vi.fn(),
    setFocus: vi.fn(),
    addChild: vi.fn(),
    addInputListener: vi.fn(),
    showOverlay: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    terminal: { rows: 50, columns: 80 },
  } as any;
}

describe("Screenshot paste: pendingImages", () => {
  let chatPane: ChatPane;
  const originalRows = process.stdout.rows;
  const originalColumns = process.stdout.columns;

  beforeEach(() => {
    // Must set stdout dimensions before creating ChatPane so Editor can render
    Object.defineProperty(process.stdout, "rows", {
      value: 50,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "columns", {
      value: 80,
      writable: true,
      configurable: true,
    });
    chatPane = new ChatPane(createStubTui());
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "rows", {
      value: originalRows,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "columns", {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
  });

  it("addPendingImage stores images and getPendingImages drains them", () => {
    chatPane.addPendingImage("base64data1", "image/png");
    chatPane.addPendingImage("base64data2", "image/jpeg");

    const images = chatPane.getPendingImages();
    expect(images).toHaveLength(2);
    expect(images[0]).toEqual({ data: "base64data1", mimeType: "image/png" });
    expect(images[1]).toEqual({ data: "base64data2", mimeType: "image/jpeg" });

    // After drain, should be empty
    const imagesAgain = chatPane.getPendingImages();
    expect(imagesAgain).toHaveLength(0);
  });

  it("getPendingImages returns empty array when no images pending", () => {
    const images = chatPane.getPendingImages();
    expect(images).toHaveLength(0);
  });

  it("addUserMessage with pending images shows image count indicator", () => {
    chatPane.addPendingImage("img1", "image/png");
    chatPane.addPendingImage("img2", "image/png");

    chatPane.addUserMessage("Check this out");
    const lines = chatPane.render(80);
    const output = lines.join("\n");
    expect(output).toContain("2 images");
  });

  it("addUserMessage with one pending image shows singular indicator", () => {
    chatPane.addPendingImage("img1", "image/png");

    chatPane.addUserMessage("Look at this");
    const lines = chatPane.render(80);
    const output = lines.join("\n");
    expect(output).toContain("1 image");
  });

  it("addUserMessage without pending images does not show indicator", () => {
    chatPane.addUserMessage("Just text");
    const lines = chatPane.render(80);
    const output = lines.join("\n");
    expect(output).not.toMatch(/\d+ image/);
  });
});
