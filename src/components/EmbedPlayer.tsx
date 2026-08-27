import { useCallback, useEffect, useRef, useState } from "react";
import {
  Captions,
  ChevronsLeft,
  ChevronsRight,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { formatTime, type Playback } from "@/lib/embedBridge";
import type { VideoProvider } from "@/lib/providers";

interface Props {
  /** Empty while paused — tearing the frame down is what stops playback. */
  embedUrl: string;
  frameKey: string;
  title: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  provider: VideoProvider;

  playback: Playback;
  paused: boolean;
  onTogglePlay: () => void;
  onSeekTo: (seconds: number) => void;
  onSeekBy: (delta: number) => void;
  onRestart: () => void;

  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;

  languageLabel: string;
  onCycleLanguage: () => void;
}

function Key({
  label,
  onClick,
  wide,
  autoFocusTarget,
  children,
}: {
  label: string;
  onClick: () => void;
  wide?: boolean;
  autoFocusTarget?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      {...(autoFocusTarget ? { "data-tv-autofocus": true } : {})}
      className="player-key inline-flex shrink-0 items-center justify-center gap-2 border border-transparent px-2.5 py-2 text-bone transition-colors duration-150 hover:border-acid hover:bg-acid hover:text-ink focus-visible:border-acid focus-visible:bg-acid focus-visible:text-ink"
    >
      {children}
      {wide && (
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">{label}</span>
      )}
    </button>
  );
}

/**
 * The VixSrc embed with Movway's own controls over it.
 *
 * Every control here acts through a channel that was measured to work: seeking
 * reloads the frame at an offset, and pausing tears it down and puts it back
 * where it was. The player's own chrome stays visible underneath — a
 * cross-origin frame's UI cannot be removed — but nothing on screen depends on
 * it, so a remote is never stuck.
 */
export default function EmbedPlayer({
  embedUrl,
  frameKey,
  title,
  iframeRef,
  provider,
  playback,
  paused,
  onTogglePlay,
  onSeekTo,
  onSeekBy,
  onRestart,
  onPrevEpisode,
  onNextEpisode,
  languageLabel,
  onCycleLanguage,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);

  /**
   * Resuming and seeking both reload the frame, and a blank frame with an
   * empty scrub bar reads as "the film started over". Saying where it is going
   * makes the wait legible instead.
   *
   * The wait ends when the player reports in — not on the iframe's load event,
   * which fires when the provider's shell arrives, well before there is any
   * video. It is also capped: a provider that never reports would otherwise
   * leave the notice sitting over film that is already playing, which is worse
   * than saying nothing at all.
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

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  /**
   * The chrome fades back when nothing is happening, but never disappears: a
   * control at zero opacity is skipped by the D-pad walker in lib/tv.ts, and
   * hiding the only controls on screen is how a remote ends up with nowhere to
   * go.
   */
  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), 4000);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), 4000);
    };
    for (const ev of ["keydown", "pointermove", "pointerdown"]) {
      window.addEventListener(ev, wake, true);
    }
    document.addEventListener("focusin", wake, true);
    return () => {
      window.clearTimeout(timer);
      for (const ev of ["keydown", "pointermove", "pointerdown"]) {
        window.removeEventListener(ev, wake, true);
      }
      document.removeEventListener("focusin", wake, true);
    };
  }, []);

  /**
   * Scrubbing commits once the viewer settles, not on every value change.
   *
   * A range input fires onChange continuously — on each step of a drag, and on
   * every D-pad press — and each seek here reloads the provider's page. Wired
   * straight through, dragging across a two-hour film issued hundreds of page
   * loads in seconds, which reads to any bot protection exactly like an attack
   * and got the viewer's own address blocked. The value on screen follows the
   * handle immediately; only the reload waits.
   */
  const [scrubTo, setScrubTo] = useState<number | null>(null);
  const commitTimer = useRef<number | undefined>(undefined);

  const onScrubChange = useCallback(
    (value: number) => {
      setScrubTo(value);
      window.clearTimeout(commitTimer.current);
      commitTimer.current = window.setTimeout(() => {
        setScrubTo(null);
        onSeekTo(value);
      }, 900);
    },
    [onSeekTo]
  );

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boxRef.current?.requestFullscreen?.();
  }, []);

  const chrome = idle && !paused ? "opacity-40" : "opacity-100";
  const scrubMax = playback.duration && playback.duration > 0 ? Math.round(playback.duration) : 0;

  return (
    <div
      ref={boxRef}
      data-player-box
      className={`relative overflow-hidden bg-ink ${
        isFullscreen ? "h-full w-full" : "aspect-video w-full"
      }`}
    >
      {embedUrl ? (
        <iframe
          ref={iframeRef}
          key={frameKey}
          src={embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="origin"
          title={title}
        />
      ) : (
        /* Paused means the stream is torn down, so there is no frame to show. */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink">
          <span className="kicker text-muted-foreground">Paused</span>
          {playback.position > 1 && (
            <span className="font-mono text-[11px] tabular-nums text-bone/70">
              {formatTime(playback.position)}
            </span>
          )}
        </div>
      )}

      {waiting && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70">
          <Loader2 className="h-9 w-9 animate-spin text-acid" />
          <span className="kicker text-bone">
            {playback.position > 1 ? `Resuming at ${formatTime(playback.position)}` : "Starting"}
          </span>
        </div>
      )}

      {notResponding && (
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

      {/* ── Centre transport ── */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 bottom-1/4 flex items-center justify-center transition-opacity duration-300 ${chrome}`}
      >
        <button
          type="button"
          onClick={onTogglePlay}
          data-tv-autofocus
          aria-label={paused ? "Play" : "Pause"}
          className="pointer-events-auto flex h-16 w-16 items-center justify-center border-2 border-acid bg-ink/70 text-acid backdrop-blur-sm transition-colors hover:bg-acid hover:text-ink focus-visible:bg-acid focus-visible:text-ink sm:h-20 sm:w-20"
        >
          {paused ? (
            <Play size={28} fill="currentColor" className="ml-1" />
          ) : (
            <Pause size={28} fill="currentColor" />
          )}
        </button>
      </div>

      {/* ── Bottom chrome ── */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/85 to-transparent pt-12 transition-opacity duration-300 ${chrome}`}
      >
        <div className="flex items-center gap-3 px-3">
          <span className="font-mono text-[11px] tabular-nums text-acid">
            {scrubTo === null && !playback.reported && "~"}
            {formatTime(scrubTo ?? playback.position)}
          </span>
          {/* A range input on purpose: lib/tv.ts hands arrow keys straight to
              one, so the D-pad scrubs without any extra key handling. */}
          <input
            type="range"
            className="player-scrub h-1 flex-1"
            min={0}
            max={scrubMax || 100}
            step={10}
            value={Math.min(scrubTo ?? playback.position, scrubMax || 100)}
            onChange={(e) => onScrubChange(Number(e.target.value))}
            disabled={!scrubMax}
            aria-label="Seek"
          />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {playback.duration ? formatTime(playback.duration) : "--:--"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-0.5 px-2 pb-2 pt-1">
          {onPrevEpisode && (
            <Key label="Previous episode" onClick={onPrevEpisode}>
              <SkipBack size={15} />
            </Key>
          )}
          <Key label="Back 1 minute" onClick={() => onSeekBy(-60)}>
            <ChevronsLeft size={16} />
          </Key>
          <Key label={paused ? "Play" : "Pause"} onClick={onTogglePlay}>
            {paused ? (
              <Play size={16} fill="currentColor" />
            ) : (
              <Pause size={16} fill="currentColor" />
            )}
          </Key>
          <Key label="Forward 1 minute" onClick={() => onSeekBy(60)}>
            <ChevronsRight size={16} />
          </Key>
          {onNextEpisode && (
            <Key label="Next episode" onClick={onNextEpisode}>
              <SkipForward size={15} />
            </Key>
          )}
          <Key label="Restart" onClick={onRestart}>
            <RotateCcw size={14} />
          </Key>

          <span className="ml-auto flex items-center gap-0.5">
            {provider.supportsSubtitles && (
              <Key label={languageLabel} onClick={onCycleLanguage} wide>
                <Captions size={14} />
              </Key>
            )}
            <Key
              label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            </Key>
          </span>
        </div>

        <p className="px-3 pb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
          {playback.reported
            ? `Position reported by ${provider.name}`
            : "Estimated until the player reports in · seeking reloads the stream"}
        </p>
      </div>
    </div>
  );
}
