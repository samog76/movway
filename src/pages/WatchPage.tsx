import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getMovieDetails,
  getTVDetails,
  getMovieCredits,
  getTVCredits,
  img,
  type MovieDetails,
  type TVDetails,
} from "@/lib/tmdb";
import {
  VIDEO_PROVIDERS,
  SUBTITLE_LANGUAGES,
  getProvider,
  nextProviderId,
  loadProviderId,
  saveProviderId,
  loadSubtitle,
  saveSubtitle,
} from "@/lib/providers";
import { upsertWatchEntry } from "@/lib/continueWatching";
import NativePlayer from "@/components/NativePlayer";
import { fetchEpisodeSources, fetchMovieSources, loadBackendUrl } from "@/lib/omss";
import EpisodePicker from "@/components/EpisodePicker";
import EmbedPlayer from "@/components/EmbedPlayer";
import { useEmbedPlayback } from "@/hooks/useEmbedPlayback";
import { ArrowLeft, Star } from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback, ReactNode } from "react";

/** A bordered control slab — the only form idiom in this UI. */
function Control({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="group flex items-stretch border border-border transition-colors focus-within:border-acid" title={hint}>
      <span className="flex items-center bg-secondary px-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const selectClass =
  "bg-card px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-bone focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed";

export default function WatchPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const tmdbId = Number(id);
  const isAnime = type === "anime";
  const isTV = type === "tv" || isAnime;

  const { data: movie } = useQuery<MovieDetails | TVDetails>({
    queryKey: ["details", type, tmdbId],
    queryFn: async () => {
      if (isTV) return getTVDetails(tmdbId);
      return getMovieDetails(tmdbId);
    },
  });

  const { data: credits } = useQuery({
    queryKey: ["credits", type, tmdbId],
    queryFn: () => (isTV ? getTVCredits(tmdbId) : getMovieCredits(tmdbId)),
  });

  const cast = credits?.cast?.slice(0, 12) ?? [];

  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [providerId, setProviderId] = useState(() => loadProviderId());
  const [subtitle, setSubtitle] = useState(() => loadSubtitle());

  const provider = getProvider(providerId);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  /** Set once the viewer chooses a source themselves, which ends switching. */
  const [sourcePickedByHand, setSourcePickedByHand] = useState(false);

  /**
   * A configured OMSS backend replaces the embed with a stream Movway plays
   * itself, which is the only arrangement where its own controls actually do
   * anything. With none set, or if nothing it returns will play, the embed
   * stays exactly as it was.
   */
  const [backendUrl] = useState(() => loadBackendUrl());
  const [nativeUnplayable, setNativeUnplayable] = useState<string | null>(null);

  const { data: streams, isError: streamsError } = useQuery({
    queryKey: ["omss", backendUrl, type, tmdbId, season, episode],
    queryFn: ({ signal }) =>
      isTV
        ? fetchEpisodeSources(backendUrl, tmdbId, season, episode, signal)
        : fetchMovieSources(backendUrl, tmdbId, signal),
    enabled: backendUrl.length > 0,
    retry: 1,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!movie) return;
    upsertWatchEntry({
      id: tmdbId,
      title: movie.title,
      name: movie.name,
      overview: movie.overview,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      vote_average: movie.vote_average,
      media_type: isTV ? "tv" : "movie",
      release_date: movie.release_date,
      first_air_date: movie.first_air_date,
      ...(isTV ? { season, episode } : {}),
    });
  }, [movie, season, episode, tmdbId, isTV]);

  const title = movie?.title || movie?.name || "Loading…";
  const embedOptions = { sub: subtitle || undefined };
  const embedUrl = isTV
    ? provider.buildTVUrl(tmdbId, season, episode, embedOptions)
    : provider.buildMovieUrl(tmdbId, embedOptions);

  const handleProviderChange = (value: string) => {
    setProviderId(value);
    saveProviderId(value);
    // An explicit choice ends automatic switching; being moved off a source you
    // just picked would be baffling.
    setSourcePickedByHand(true);
  };

  /**
   * The current source never started. Move to the next one, keeping the
   * position, so a source that refuses this network costs a few seconds rather
   * than the evening. Not saved — the preferred source is tried again next time
   * rather than written off over one bad night.
   */
  const onNotResponding = useCallback(() => {
    if (sourcePickedByHand) return;
    const next = nextProviderId(provider.id);
    if (next) setProviderId(next);
  }, [provider.id, sourcePickedByHand]);

  const handleSubtitleChange = (code: string) => {
    setSubtitle(code);
    saveSubtitle(code);
  };

  const year = (movie?.release_date || movie?.first_air_date || "").slice(0, 4);

  const playableStreams = streams?.sources ?? [];
  const useNativePlayer =
    backendUrl.length > 0 && !nativeUnplayable && !streamsError && playableStreams.length > 0;

  /**
   * Season summaries for the picker. TMDB lists empty and placeholder seasons,
   * which would render as dead tabs, so keep only ones with episodes. Falls
   * back to synthesising from number_of_seasons when the field is absent.
   */
  const seasons = useMemo(() => {
    if (!movie || !isTV) return [];
    const listed = "seasons" in movie ? movie.seasons : undefined;
    if (listed?.length) {
      return listed
        .filter((s) => s.episode_count > 0)
        .sort((a, b) => {
          // Season 0 is Specials; it belongs after the numbered run, not before it.
          if (a.season_number === 0) return 1;
          if (b.season_number === 0) return -1;
          return a.season_number - b.season_number;
        });
    }
    const total = ("number_of_seasons" in movie ? movie.number_of_seasons : 1) || 1;
    return Array.from({ length: total }, (_, i) => ({
      id: i + 1,
      season_number: i + 1,
      name: `Season ${i + 1}`,
      episode_count: 0,
      poster_path: null,
    }));
  }, [movie, isTV]);

  const selectEpisode = useCallback((nextSeason: number, nextEpisode: number) => {
    setSeason(nextSeason);
    setEpisode(nextEpisode);
  }, []);

  // ── Playback control ────────────────────────────────────────────────────

  /** Anything here changes the loaded stream, so the position tracker resets. */
  const resetKey = `${provider.id}|${subtitle}|${season}|${episode}`;

  const playback = useEmbedPlayback({
    iframeRef,
    origin: provider.origin,
    resetKey,
    titleKey: `${type}|${tmdbId}|${season}|${episode}`,
    baseline: 0,
    paused: false,
  });

  // A new title deserves a fresh attempt at the good path.
  useEffect(() => {
    setNativeUnplayable(null);
  }, [tmdbId, season, episode]);



  return (
    <div className="space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-acid focus-visible:border-acid hover:bg-acid focus-visible:bg-acid hover:text-ink focus-visible:text-ink"
      >
        <ArrowLeft size={13} /> Back to Lobby
      </Link>

      {/* ── Projector ── */}
      <div className="reveal border border-border bg-card">
        {/* Slate bar */}
        <div className="flex items-center gap-3 border-b border-border px-3 py-2">
          <span className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-flare" />
            <span className="h-2 w-2 rounded-full bg-acid animate-flicker" />
            <span className="h-2 w-2 rounded-full bg-violet" />
          </span>
          <span className="kicker text-muted-foreground">
            Now Playing
          </span>
          <span className="ml-auto truncate font-mono text-[10px] uppercase tracking-[0.14em] text-acid">
            {useNativePlayer ? streams?.sources[0]?.provider?.name ?? "Direct" : provider.name}
            {isTV && ` · S${season}E${episode}`}
          </span>
        </div>

        {useNativePlayer ? (
          <NativePlayer
            sources={playableStreams}
            subtitles={streams?.subtitles ?? []}
            title={title}
            onPrevEpisode={isTV && episode > 1 ? () => selectEpisode(season, episode - 1) : undefined}
            onNextEpisode={isTV ? () => selectEpisode(season, episode + 1) : undefined}
            onUnplayable={setNativeUnplayable}
          />
        ) : (
          <EmbedPlayer
            embedUrl={embedUrl}
            frameKey={resetKey}
            title={title}
            iframeRef={iframeRef}
            provider={provider}
            playback={playback}
            onNotResponding={onNotResponding}
            lastResort={sourcePickedByHand || nextProviderId(provider.id) === null}
          />
        )}
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Control label="Source">
          <select
            value={provider.id}
            onChange={(e) => handleProviderChange(e.target.value)}
            className={selectClass}
          >
            {VIDEO_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Control>

        <Control
          label="Subs"
          hint={provider.supportsSubtitles ? undefined : "This source doesn't support default subtitles"}
        >
          <select
            value={subtitle}
            onChange={(e) => handleSubtitleChange(e.target.value)}
            disabled={!provider.supportsSubtitles}
            className={selectClass}
          >
            {SUBTITLE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </Control>

        {!provider.supportsSubtitles && (
          <span className="font-mono text-[10px] text-muted-foreground">
            Use the player's own subtitle menu for this source.
          </span>
        )}
      </div>

      {/* ── Title card ── */}
      {movie && (
        <div className="space-y-4">
          <h1 className="font-display font-variation-tight max-w-4xl text-[clamp(1.75rem,5vw,3.75rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.05em] text-bone">
            {title}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 bg-acid px-2 py-1 font-mono text-[10px] font-bold tabular-nums text-ink">
              <Star size={10} fill="currentColor" />
              {movie.vote_average ? movie.vote_average.toFixed(1) : "—"}
            </span>
            {year && (
              <span className="border border-border px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                {year}
              </span>
            )}
            {"runtime" in movie && movie.runtime ? (
              <span className="border border-border px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                {movie.runtime} MIN
              </span>
            ) : null}
            {movie.genres?.map((g) => (
              <span
                key={g.id}
                className="border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
              >
                {g.name}
              </span>
            ))}
          </div>

          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{movie.overview}</p>
        </div>
      )}

      {/* ── Episodes ── */}
      {isTV && seasons.length > 0 && (
        <EpisodePicker
          tmdbId={tmdbId}
          seasons={seasons}
          season={season}
          episode={episode}
          showSeasons={!isAnime}
          onSelect={selectEpisode}
        />
      )}

      {/* ── Cast ── */}
      {cast.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] font-bold text-acid">CR</span>
            <h2 className="font-display text-lg font-extrabold uppercase tracking-[-0.02em] text-bone">
              Cast
            </h2>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cast.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 border border-border bg-card p-2 transition-colors hover:border-acid focus-visible:border-acid"
              >
                {member.profile_path ? (
                  <img
                    src={img(member.profile_path, "w92")}
                    alt={member.name}
                    className="h-11 w-11 shrink-0 object-cover grayscale transition-all duration-300 hover:grayscale-0 focus-visible:grayscale-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-secondary font-mono text-xs text-muted-foreground">
                    {member.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] uppercase tracking-[0.08em] text-bone">
                    {member.name}
                  </p>
                  {member.character && (
                    <p className="truncate text-[11px] text-muted-foreground">{member.character}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
