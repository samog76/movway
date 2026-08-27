import { describe, it, expect, afterEach, vi } from "vitest";
import { describeFault } from "@/lib/faults";

const setOnline = (value: boolean) =>
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);

afterEach(() => vi.restoreAllMocks());

describe("describeFault", () => {
  it("calls out an offline device before anything else", () => {
    setOnline(false);
    const fault = describeFault(new Error("Failed to fetch"));
    expect(fault.cause).toMatch(/offline/i);
    expect(fault.hint).toMatch(/wi-?fi/i);
  });

  it("names a connection failure rather than blaming the app", () => {
    setOnline(true);
    for (const message of [
      "Failed to fetch",
      "Load failed",
      "NetworkError when attempting to fetch resource.",
    ]) {
      const fault = describeFault(new TypeError(message));
      expect(fault.cause, message).toContain("api.themoviedb.org");
      // The wrong-clock case is the one nobody thinks to check on a TV.
      expect(fault.hint, message).toMatch(/date and time/i);
    }
  });

  it("separates a rejected key from a throttled one", () => {
    setOnline(true);
    expect(describeFault(new Error("TMDB 401")).cause).toMatch(/rejected the API key/i);
    expect(describeFault(new Error("TMDB 429")).cause).toMatch(/rate limiting/i);
  });

  it("reports any other status verbatim", () => {
    setOnline(true);
    expect(describeFault(new Error("TMDB 503")).cause).toContain("503");
  });

  it("always carries the raw message through for diagnosis", () => {
    setOnline(true);
    expect(describeFault(new Error("something odd")).detail).toBe("something odd");
    expect(describeFault("plain string").detail).toBe("plain string");
    expect(describeFault(null).detail).toBe("unknown error");
  });
});
