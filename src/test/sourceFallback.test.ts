import { describe, it, expect } from "vitest";
import { shouldWatchForFailure, FALLBACK_AFTER_MS } from "@/lib/sourceFallback";
import { DEFAULT_PROVIDER_ID, FALLBACK_PROVIDER_ID } from "@/lib/providers";

const base = {
  providerId: DEFAULT_PROVIDER_ID,
  defaultProviderId: DEFAULT_PROVIDER_ID,
  pickedByHand: false,
  alreadyFellBack: false,
};

describe("falling back to the alternate source", () => {
  it("watches the default source", () => {
    expect(shouldWatchForFailure(base)).toBe(true);
  });

  it("leaves a source the viewer chose alone", () => {
    expect(shouldWatchForFailure({ ...base, pickedByHand: true })).toBe(false);
  });

  it("switches at most once, so it cannot ping-pong", () => {
    expect(shouldWatchForFailure({ ...base, alreadyFellBack: true })).toBe(false);
  });

  it("does not second-guess the alternate it just switched to", () => {
    expect(shouldWatchForFailure({ ...base, providerId: FALLBACK_PROVIDER_ID })).toBe(false);
  });

  it("allows long enough for a slow stick to start playing", () => {
    // Short enough that a dead source is not left up for ages, long enough
    // that a slow connection is not mistaken for a broken one.
    expect(FALLBACK_AFTER_MS).toBeGreaterThanOrEqual(8_000);
    expect(FALLBACK_AFTER_MS).toBeLessThanOrEqual(20_000);
  });
});
