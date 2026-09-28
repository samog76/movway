import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import type { Playback } from "@/lib/embedBridge";
import {
  exitDocumentFullscreen,
  getFullscreenElement,
  requestElementFullscreen,
} from "@/lib/fullscreen";
import type { VideoProvider } from "@/lib/providers";

interface Props {
  embedUrl: string;
  frameKey: string;
  title: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  provider: VideoProvider;

  playback: Playback;

  /** Fired once when the player has stayed silent long enough to call it dead. */
  onNotResponding: () => void;
  /** True when there is no other source left to try. */
  lastResort: boolean;
}

/**
 * The embed, and nothing of ours on top of it.
 *
 * Movway used to draw its own transport here, because a cross-origin frame
 * answers no commands: pausing meant tearing the frame down and resuming meant
 * reloading it at an offset. Those controls worked, but every press cost a page
 * load, and they sat over the player's own chrome rather than replacing it.
 *
 * So they are gone, and the player's own controls are the controls. The frame
 * takes a tabindex so the D-pad walker in lib/tv.ts can land on it and keys go
 * to the player rather than to the page around it.
 *
 * What is left here is not control but reporting: telemetry still arrives, and
 * a source that never reports is still noticed, so the page can move on.
 */
export default function EmbedPlayer({
  embedUrl,
  frameKey,
  title,
  iframeRef,
  provider,
  playback,
  onNotResponding,
  lastResort,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  /**
   * The wait ends when the player reports in — not on the iframe's load event,
   * which fires when the provider's shell arrives, well before there is any
   * video. It is capped, because a provider that never reports would otherwise
   * leave the notice sitting over film that is already playing.
   */
  const [graceOver, setGraceOver] = useState(false);
  const [silentTooLong, setSilentTooLong] = useState(false);
  useEffect(() => {
    setGraceOver(false);
    setSilentTooLong(false);
    const settling = window.setTimeout(() => setGraceOver(true), 6000);
    const stalled = window.setTimeout(() => setSilentTooLong(true), 20000);
    return () => {
      window.clearTimeout(settling);
      window.clearTimeout(stalled);
    };
  }, [frameKey]);

  const waiting = !!embedUrl && !playback.reported && !graceOver;

  /**
   * The frame loaded but the player never reported in. The usual cause is the
   * source refusing this network — a rate-limit or bot check — which renders
   * its own page inside the frame. That page cannot be read from here, and its
   * challenge cannot be completed inside a frame either, so the viewer is shown
   * what to do rather than left staring at someone else's error.
   */
  const notResponding = !!embedUrl && !playback.reported && silentTooLong;

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setIsFullscreen(getFullscreenElement(document) === boxRef.current);
    const events = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
    events.forEach((eventName) => document.addEventListener(eventName, sync));
    return () => events.forEach((eventName) => document.removeEventListener(eventName, sync));
  }, []);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    frame.setAttribute("allowfullscreen", "true");
    frame.setAttribute("webkitallowfullscreen", "true");
    frame.setAttribute("mozallowfullscreen", "true");
  }, [iframeRef, frameKey]);

  // Told once per load, so the page can move to another source.
  const toldRef = useRef<string | null>(null);
  useEffect(() => {
    if (!notResponding || toldRef.current === frameKey) return;
    toldRef.current = frameKey;
    onNotResponding();
  }, [notResponding, frameKey, onNotResponding]);

  const toggleFullscreen = async () => {
    const active = getFullscreenElement(document);
    if (active) {
      await exitDocumentFullscreen(document);
      return;
    }
    await requestElementFullscreen(boxRef.current);
  };

  return (
    <div ref={boxRef} data-player-box className="relative aspect-video w-full overflow-hidden bg-ink">
      <iframe
        ref={iframeRef}
        key={frameKey}
        src={embedUrl}
        // Focusable on purpose: it is how the remote reaches the player's own
        // controls now that Movway draws none. lib/tv.ts treats anything with a
        // tabindex as somewhere the D-pad can go.
        tabIndex={0}
        data-tv-autofocus
        className="absolute inset-0 h-full w-full border-0"
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen *"
        referrerPolicy="origin"
        title={title}
      />

      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 border border-border bg-ink/80 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-bone transition-colors hover:border-acid hover:bg-acid hover:text-ink focus-visible:border-acid focus-visible:bg-acid focus-visible:text-ink"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>

      {waiting && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70">
          <Loader2 className="h-9 w-9 animate-spin text-acid" />
          <span className="kicker text-bone">Starting</span>
        </div>
      )}

      {notResponding && lastResort && (
        <div className="absolute inset-x-0 bottom-[26%] mx-auto max-w-lg border border-flare/50 bg-ink/95 px-4 py-3 text-center">
          <span className="kicker text-flare">{provider.name} is not responding</span>
          <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-bone">
            It usually means the source is refusing this network. Open{" "}
            <span className="text-acid">{provider.origin.replace("https://", "")}</span> in a
            browser tab, pass its check, then come back — it cannot be cleared from inside the
            player.
          </p>
        </div>
      )}
    </div>
  );
}
