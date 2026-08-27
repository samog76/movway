/**
 * Reading playback out of the VixSrc embed.
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

  const event = typeof inner.event === "string" ? inner.event : undefined;
  const currentTime = typeof inner.currentTime === "number" ? inner.currentTime : undefined;
  const duration = typeof inner.duration === "number" ? inner.duration : undefined;

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
