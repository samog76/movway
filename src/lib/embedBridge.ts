/**
 * Reading playback out of an embedded player.
 *
 * The frame is cross-origin, so nothing here can touch its <video>. What it
 * does do is post its state outward — `PLAYER_EVENT` carrying currentTime and
 * duration — and that is enough to show a true position and a working scrub
 * bar rather than a guess.
 *
 * Control travels the other way round: not through messages, which the player
 * ignores, but through the URL. See `providers.ts` for what was measured.
 */

export interface Playback {
  /** Seconds into the title. */
  position: number;
  /** Total seconds, once the player has said. */
  duration: number | null;
  /** True once the player's own numbers have arrived. */
  reported: boolean;
}

export const emptyPlayback = (): Playback => ({
  position: 0,
  duration: null,
  reported: false,
});

/** Events the player emits that are worth acting on. */
const KNOWN_EVENTS = /^(play|playing|pause|paused|seeked|seeking|ended|timeupdate)$/i;

/**
 * VidAPI reports a *status* where the others report an event name, and calls
 * the end of a title `completed` rather than `ended`.
 */
const STATUS_AS_EVENT: Record<string, string> = {
  playing: "playing",
  paused: "pause",
  completed: "ended",
  seeked: "seeked",
};

/**
 * Numbers arrive as numbers from some sources and as strings from others — the
 * same service that returns `"rating": "7.1"` in its catalogue is not a safe bet
 * to send `player_progress` as a number every time.
 */
const num = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export interface Telemetry {
  event?: string;
  currentTime?: number;
  duration?: number;
}

/**
 * Pull playback out of a posted message.
 *
 * VixSrc documents `{type:"PLAYER_EVENT", data:{event, currentTime, duration}}`.
 * A bare `type` is deliberately not enough to qualify: pages receive plenty of
 * unrelated messages carrying one, and treating those as playback would move
 * the scrub bar at random.
 */
export function parseTelemetry(data: unknown): Telemetry | null {
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;

  // VixSrc nests the payload under `event`, not `data` as its docs describe —
  // the real message is
  //   {type:"PLAYER_EVENT", event:{event:"timeupdate", currentTime, duration}}
  // Both shapes are accepted so a provider changing its mind, or another
  // provider being added, does not silently stop the scrub bar.
  const nested =
    (msg.event && typeof msg.event === "object" ? msg.event : null) ??
    (msg.data && typeof msg.data === "object" ? msg.data : null);
  const inner = (nested ?? msg) as Record<string, unknown>;

  // VidAPI uses the documented `data` nesting but its own field names:
  //   {type:"PLAYER_EVENT", data:{player_status, player_progress, player_duration}}
  const status =
    typeof inner.player_status === "string" ? inner.player_status.toLowerCase() : undefined;

  const event =
    typeof inner.event === "string" ? inner.event : status ? STATUS_AS_EVENT[status] : undefined;
  const currentTime = num(inner.currentTime) ?? num(inner.player_progress);
  const duration = num(inner.duration) ?? num(inner.player_duration);

  const known = event !== undefined && KNOWN_EVENTS.test(event);
  if (currentTime === undefined && duration === undefined && !known) return null;

  return { event: known ? event : undefined, currentTime, duration };
}

/** mm:ss, or h:mm:ss once a title runs past an hour. */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
