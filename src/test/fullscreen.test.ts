import { describe, it, expect, vi } from "vitest";
import {
  exitDocumentFullscreen,
  getFullscreenElement,
  requestElementFullscreen,
} from "@/lib/fullscreen";

describe("fullscreen helpers", () => {
  it("uses standard fullscreen request when available", async () => {
    const element = document.createElement("div");
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.assign(element, { requestFullscreen });

    await expect(requestElementFullscreen(element)).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("falls back to webkit request when standard API is missing", async () => {
    const element = document.createElement("div");
    const webkitRequestFullscreen = vi.fn();
    Object.assign(element, { webkitRequestFullscreen });

    await expect(requestElementFullscreen(element)).resolves.toBe(true);
    expect(webkitRequestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("returns false on a rejected request", async () => {
    const element = document.createElement("div");
    const requestFullscreen = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(element, { requestFullscreen });

    await expect(requestElementFullscreen(element)).resolves.toBe(false);
  });

  it("finds vendor fullscreen element fields", () => {
    const doc = {} as Document & { webkitFullscreenElement?: Element | null };
    const frame = document.createElement("iframe");
    doc.webkitFullscreenElement = frame;
    expect(getFullscreenElement(doc)).toBe(frame);
  });

  it("uses standard exit fullscreen when available", async () => {
    const doc = {} as Document & { exitFullscreen?: () => Promise<void> };
    doc.exitFullscreen = vi.fn().mockResolvedValue(undefined);
    await expect(exitDocumentFullscreen(doc)).resolves.toBe(true);
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("falls back to vendor exit fullscreen APIs", async () => {
    const doc = {} as Document & { webkitExitFullscreen?: () => void };
    doc.webkitExitFullscreen = vi.fn();
    await expect(exitDocumentFullscreen(doc)).resolves.toBe(true);
    expect(doc.webkitExitFullscreen).toHaveBeenCalledTimes(1);
  });
});
