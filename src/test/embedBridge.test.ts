import { describe, it, expect } from "vitest";
import { parseTelemetry, formatTime } from "@/lib/embedBridge";

describe("reading VixSrc telemetry", () => {
  it("reads the shape VixSrc actually sends", () => {
    // Captured live. Note the payload sits under `event`, not `data` as the
    // published docs describe — trusting the docs here left the scrub bar dead.
    const info = parseTelemetry({
      type: "PLAYER_EVENT",
      event: { event: "timeupdate", currentTime: 40, duration: 8175.708333, video_id: "214325" },
    });
    expect(info).toMatchObject({ event: "timeupdate", currentTime: 40 });
    expect(info?.duration).toBeCloseTo(8175.7, 1);
  });

  it("still reads the documented shape, in case they align later", () => {
    const info = parseTelemetry({
      type: "PLAYER_EVENT",
      data: { event: "pause", currentTime: 12.5, duration: 600 },
    });
    expect(info).toEqual({ event: "pause", currentTime: 12.5, duration: 600 });
  });

  it("reads a flat payload", () => {
    expect(parseTelemetry({ event: "play", currentTime: 3 })?.currentTime).toBe(3);
  });

  it("ignores messages that carry no playback", () => {
    expect(parseTelemetry({ type: "ANALYTICS", id: 5 })).toBeNull();
    expect(parseTelemetry("hello")).toBeNull();
    expect(parseTelemetry(null)).toBeNull();
  });
});

describe("formatTime", () => {
  it("formats under an hour as mm:ss", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(75)).toBe("01:15");
  });

  it("formats a feature-length run as h:mm:ss", () => {
    expect(formatTime(8175.7)).toBe("2:16:15");
  });

  it("never renders a negative clock", () => {
    expect(formatTime(-30)).toBe("00:00");
  });
});
