import { useEffect, useRef, useState } from "react";
import { emptyPlayback, parseTelemetry, type Playback } from "@/lib/embedBridge";

interface Options {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Origin the telemetry must come from. */
  origin: string;
  /** Changes whenever the stream reloads (episode, language, seek). */
  resetKey: string;
  /**
   * Changes only when the actual title changes. Reloading the *same* title —
   * which is what pausing and seeking do — keeps what is already known about
   * it, so the scrub bar and duration stay put instead of emptying and
   * refilling. That blanking is what made resuming look like starting over.
   */
  titleKey: string;
  /** Offset this load started at. */
  baseline: number;
  /** True while the stream is torn down, which is how pausing works. */
  paused: boolean;
}

/**
 * Tracks where the embed has got to.
 *
 * Its own numbers are used the moment they arrive. Until then a local clock
 * counts up from the offset this load began at, so the scrub bar is usable in
 * the first seconds rather than sitting at zero — and the difference is shown
 * on screen rather than hidden, since one is fact and the other is an estimate.
 */
export function useEmbedPlayback({
  iframeRef,
  origin,
  resetKey,
  titleKey,
  baseline,
  paused,
}: Options) {
  const [playback, setPlayback] = useState<Playback>(emptyPlayback);
  const reportedRef = useRef(false);

  // A different title knows nothing yet.
  useEffect(() => {
    reportedRef.current = false;
    setPlayback(emptyPlayback());
  }, [titleKey]);

  /**
   * The same title reloading — a pause, a resume, a seek — keeps its duration
   * and simply moves to the new offset. Only the position is provisional again,
   * until the player reports in.
   */
  useEffect(() => {
    reportedRef.current = false;
    setPlayback((prev) => ({ ...prev, position: baseline, reported: false }));
    // baseline moves together with resetKey; reacting to it alone would rewind
    // the clock mid-play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const info = parseTelemetry(event.data);
      if (!info) return;

      setPlayback((prev) => {
        const next: Playback = { ...prev };
        if (typeof info.currentTime === "number" && Number.isFinite(info.currentTime)) {
          next.position = info.currentTime;
          next.reported = true;
          reportedRef.current = true;
        }
        if (typeof info.duration === "number" && info.duration > 0) next.duration = info.duration;
        return next;
      });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, iframeRef]);

  // Local clock, only while the player has not spoken for itself.
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setPlayback((prev) => (reportedRef.current ? prev : { ...prev, position: prev.position + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  return playback;
}
