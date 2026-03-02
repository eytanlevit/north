import { describe, it, expect } from "vitest";
import { ConfirmationDialog } from "../components/confirmation-dialog.js";

describe("ConfirmationDialog", () => {
  it("defaults to cancel", () => {
    const dialog = new ConfirmationDialog("Delete PMT-001: Test issue?");
    // Render to inspect initial state — Cancel should be selected (highlighted)
    const lines = dialog.render(40);
    const output = lines.join("\n");
    // Cancel button should be selected (bold/highlighted), Delete should not
    expect(dialog.selectedButton).toBe("cancel");
    expect(output).toContain("Cancel");
    expect(output).toContain("Delete");
  });

  it("Tab switches buttons", () => {
    const dialog = new ConfirmationDialog("Delete PMT-001: Test issue?");
    expect(dialog.selectedButton).toBe("cancel");
    dialog.handleInput("\t");
    expect(dialog.selectedButton).toBe("delete");
    dialog.handleInput("\t");
    expect(dialog.selectedButton).toBe("cancel");
  });

  it("Enter on cancel resolves false", async () => {
    const dialog = new ConfirmationDialog("Delete PMT-001: Test issue?");
    const promise = dialog.promise;
    // Default is cancel, press Enter
    dialog.handleInput("\r");
    const result = await promise;
    expect(result).toBe(false);
  });

  it("Enter on confirm resolves true", async () => {
    const dialog = new ConfirmationDialog("Delete PMT-001: Test issue?");
    const promise = dialog.promise;
    // Tab to Delete, then Enter
    dialog.handleInput("\t");
    expect(dialog.selectedButton).toBe("delete");
    dialog.handleInput("\r");
    const result = await promise;
    expect(result).toBe(true);
  });

  it("Escape resolves false", async () => {
    const dialog = new ConfirmationDialog("Delete PMT-001: Test issue?");
    const promise = dialog.promise;
    dialog.handleInput("\x1b");
    const result = await promise;
    expect(result).toBe(false);
  });

  it("idempotent resolve guard prevents double-resolve", async () => {
    const dialog = new ConfirmationDialog("Delete PMT-001: Test issue?");
    const promise = dialog.promise;
    // Press Escape twice — should not throw
    dialog.handleInput("\x1b");
    dialog.handleInput("\x1b");
    const result = await promise;
    expect(result).toBe(false);
  });
});
