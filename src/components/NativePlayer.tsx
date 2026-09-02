import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Captions,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { effectiveStreamType, type OmssSource, type OmssSubtitle } from "@/lib/omss";
import { formatTime } from "@/lib/playTime";

interface Props {
  sources: OmssSource[];
  subtitles: OmssSubtitle[];
  title: string;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  /** Called when nothing here can be played, so the page can fall back. */
  onUnplayable: (reason: string) => void;
  /**
   * The source actually playing, which is not always the first one: a stream
   * that fails hands over to the next silently, and the viewer can switch by
   * hand. Without this the page can only name `sources[0]`, which stops being
   * true the moment either happens.
   */
  onActiveSourceChange?: (source: OmssSource | undefined) => void;
}

function Key({
  label,
  onClick,
  wide,
  primary,
  autoFocusTarget,
  children,
}: {
  label: string;
  onClick: () => void;
  wide?: boolean;
  primary?: boolean;
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
      className={`player-key inline-flex shrink-0 items-center justify-center gap-2 border px-2.5 py-2 transition-colors duration-150 ${
        primary
          ? "border-acid bg-acid text-ink"
          : "border-transparent text-bone hover:border-acid hover:bg-acid hover:text-ink focus-visible:border-acid focus-visible:bg-acid focus-visible:text-ink"
      }`}
    >
      {children}
      {wide && (
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">{label}</span>
      )}
    </button>
  );
}

export default function NativePlayer({
  sources,
  subtitles,
  title,
  onPrevEpisode,
  onNextEpisode,
  onUnplayable,
  onActiveSourceChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [paused, setPaused] = useState(true);
  const [waiting, setWaiting] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  /**
   * Muted to begin with, because every browser refuses to autoplay a video
   * with sound and refuses it silently — the stream loads, sits paused, and
   * looks for all the world like a dead source. Muted autoplay is allowed
   * everywhere, so the picture starts and the viewer unmutes.
   */
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);

  const source = sources[sourceIndex];

  useEffect(() => {
    onActiveSourceChange?.(source);
  }, [source, onActiveSourceChange]);

  // Only WebVTT can be handed straight to a <track>; the others would need
  // converting, so they are not offered rather than silently doing nothing.
  const vttSubtitles = subtitles.filter((s) => s.format === "vtt");
  const [subtitleIndex, setSubtitleIndex] = useState(-1);

  // ── Attach the stream ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;

    setWaiting(true);
    let hls: Hls | null = null;

    const failOver = (reason: string) => {
      if (sourceIndex + 1 < sources.length) setSourceIndex((i) => i + 1);
      else onUnplayable(reason);
    };

    const streamType = effectiveStreamType(source);

    if (streamType === "hls") {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari and some TV browsers play HLS themselves.
        video.src = source.url;
      } else if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(source.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          failOver(`HLS ${data.type}: ${data.details}`);
        });
      } else {
        failOver("This device cannot play HLS");
        return;
      }
    } else {
      video.src = source.url;
    }

    const onError = () => failOver(`Could not load the ${source.quality} stream`);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("error", onError);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.url, source?.type]);

  // ── Track playback ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      setPaused(video.paused);
      setPosition(video.currentTime);
      if (Number.isFinite(video.duration)) setDuration(video.duration);
      setMuted(video.muted);
    };
    const started = () => setWaiting(false);
    for (const ev of ["play", "pause", "timeupdate", "durationchange", "volumechange", "seeked"]) {
      video.addEventListener(ev, sync);
    }
    video.addEventListener("playing", started);
    video.addEventListener("canplay", started);
    video.addEventListener("waiting", () => setWaiting(true));
    return () => {
      for (const ev of ["play", "pause", "timeupdate", "durationchange", "volumechange", "seeked"]) {
        video.removeEventListener(ev, sync);
      }
      video.removeEventListener("playing", started);
      video.removeEventListener("canplay", started);
    };
  }, []);

  // ── Chrome idles back, never disappears: a control at zero opacity is
  //    skipped by the D-pad walker, which strands the remote. ──
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

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // ── Controls. Every one of these acts on our own element, so it simply works. ──
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPaused(true));
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + delta));
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = seconds;
  }, []);

  const restart = useCallback(() => seekTo(0), [seekTo]);

  // State owns `muted` now that the element is controlled by it; setting the
  // DOM directly here would fight React on the next render.
  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boxRef.current?.requestFullscreen?.();
  }, []);

  const cycleSubtitle = useCallback(() => {
    setSubtitleIndex((prev) => {
      const next = prev + 1 >= vttSubtitles.length ? -1 : prev + 1;
      const tracks = videoRef.current?.textTracks;
      if (tracks) {
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = i === next ? "showing" : "disabled";
        }
      }
      return next;
    });
  }, [vttSubtitles.length]);

  const cycleQuality = useCallback(() => {
    setSourceIndex((i) => (i + 1) % Math.max(1, sources.length));
  }, [sources.length]);

  if (!source) return null;

  const chrome = idle ? "opacity-40" : "opacity-100";
  const subtitleLabel =
    subtitleIndex >= 0 ? vttSubtitles[subtitleIndex]?.label ?? "Subtitles" : "Subtitles off";

  return (
    <div
      ref={boxRef}
      data-player-box
      className={`relative overflow-hidden bg-ink ${isFullscreen ? "h-full w-full" : "aspect-video w-full"}`}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-ink"
        playsInline
        autoPlay
        muted={muted}
        crossOrigin="anonymous"
        title={title}
      >
        {vttSubtitles.map((s, i) => (
          <track
            key={s.url}
            kind="subtitles"
            src={s.url}
            label={s.label}
            default={i === subtitleIndex}
          />
        ))}
      </video>

      {waiting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-acid" />
        </div>
      )}

      {/* ── Centre transport ── */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 bottom-1/4 flex items-center justify-center transition-opacity duration-300 ${chrome}`}
      >
        <button
          type="button"
          onClick={togglePlay}
          data-tv-autofocus
          aria-label={paused ? "Play" : "Pause"}
          className="pointer-events-auto flex h-16 w-16 items-center justify-center border-2 border-acid bg-ink/70 text-acid backdrop-blur-sm transition-colors hover:bg-acid hover:text-ink focus-visible:bg-acid focus-visible:text-ink sm:h-20 sm:w-20"
        >
          {paused ? <Play size={28} fill="currentColor" className="ml-1" /> : <Pause size={28} fill="currentColor" />}
        </button>
      </div>

      {/* ── Bottom chrome ── */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/85 to-transparent pt-12 transition-opacity duration-300 ${chrome}`}
      >
        <div className="flex items-center gap-3 px-3">
          <span className="font-mono text-[11px] tabular-nums text-acid">
            {formatTime(position)}
          </span>
          {/* A range input on purpose: lib/tv.ts hands arrow keys straight to
              one, so the D-pad scrubs without any extra key handling. */}
          <input
            type="range"
            className="player-scrub h-1 flex-1"
            min={0}
            max={duration || 100}
            step={5}
            value={Math.min(position, duration || 100)}
            onChange={(e) => seekTo(Number(e.target.value))}
            disabled={!duration}
            aria-label="Seek"
          />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {duration ? formatTime(duration) : "--:--"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-0.5 px-2 pb-2 pt-1">
          {onPrevEpisode && (
            <Key label="Previous episode" onClick={onPrevEpisode}>
              <SkipBack size={15} />
            </Key>
          )}
          <Key label="Back 1 minute" onClick={() => seekBy(-60)}>
            <ChevronsLeft size={16} />
          </Key>
          <Key label={paused ? "Play" : "Pause"} onClick={togglePlay}>
            {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
          </Key>
          <Key label="Forward 1 minute" onClick={() => seekBy(60)}>
            <ChevronsRight size={16} />
          </Key>
          {onNextEpisode && (
            <Key label="Next episode" onClick={onNextEpisode}>
              <SkipForward size={15} />
            </Key>
          )}
          <Key label="Restart" onClick={restart}>
            <RotateCcw size={14} />
          </Key>
          <Key label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </Key>

          <span className="ml-auto flex items-center gap-0.5">
            {sources.length > 1 && (
              <Key
                label={`${source.provider?.name ?? "Source"} · ${source.quality || "auto"}`}
                onClick={cycleQuality}
                wide
              >
                <span className="font-mono text-[10px] tabular-nums">
                  {sourceIndex + 1}/{sources.length}
                </span>
              </Key>
            )}
            {vttSubtitles.length > 0 && (
              <Key label={subtitleLabel} onClick={cycleSubtitle} wide>
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
      </div>
    </div>
  );
}
