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

describe("reading VidAPI telemetry", () => {
  /**
   * VidAPI uses the documented `data` nesting but names every field itself.
   * This is its published payload verbatim — the scrub bar reads position and
   * duration straight out of it.
   */
  const payload = (over: Record<string, unknown> = {}) => ({
    type: "PLAYER_EVENT",
    data: {
      player_info: { imdb: "tt23779058", tmdb: null, mediaType: "movie" },
      player_status: "playing",
      player_progress: 125.4,
      player_duration: 7200,
      quality: { label: "1080p", width: 1920, height: 1080 },
      ...over,
    },
  });

  it("reads position and duration from its own field names", () => {
    expect(parseTelemetry(payload())).toEqual({
      event: "playing",
      currentTime: 125.4,
      duration: 7200,
    });
  });

  it("reports a pause as a pause", () => {
    expect(parseTelemetry(payload({ player_status: "paused" }))?.event).toBe("pause");
  });

  // It calls the end of a title `completed` where the others say `ended`.
  it("translates completed into ended", () => {
    expect(parseTelemetry(payload({ player_status: "completed" }))?.event).toBe("ended");
  });

  it("reads a seek", () => {
    expect(parseTelemetry(payload({ player_status: "seeked" }))?.event).toBe("seeked");
  });

  it("accepts numbers sent as strings", () => {
    const info = parseTelemetry(payload({ player_progress: "310.5", player_duration: "7200" }));
    expect(info?.currentTime).toBe(310.5);
    expect(info?.duration).toBe(7200);
  });

  it("ignores a status it does not know rather than inventing one", () => {
    expect(parseTelemetry({ type: "PLAYER_EVENT", data: { player_status: "buffering" } })).toBeNull();
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
