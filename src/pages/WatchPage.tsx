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
import { upsertWatchEntry } from "@/lib/continueWatching";
import NativePlayer from "@/components/NativePlayer";
import FaultReport from "@/components/FaultReport";
import { describeBackendFault } from "@/lib/faults";
import {
  fetchEpisodeSources,
  fetchMovieSources,
  loadBackendUrl,
  describeActiveSource,
  type OmssSource,
} from "@/lib/omss";
import EpisodePicker from "@/components/EpisodePicker";
import { ArrowLeft, Star } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, ReactNode } from "react";

/** A notice in the projector frame, where the picture would otherwise be. */
function Placard({
  kicker,
  children,
}: {
  kicker: string;
  children: ReactNode;
}) {
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-ink px-4">
      <div className="max-w-2xl text-center">
        <span className="kicker text-flare">{kicker}</span>
        <div className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

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

  /**
   * Every title plays through Movway's own player, fed by an OMSS backend.
   *
   * The embedded third-party players this page used to fall back to are gone.
   * They could only ever show a picture: they accept no commands, expose no
   * keyboard handling, and cannot be reached into, so no remote could pause
   * one. Keeping them as a fallback also hid a broken backend behind a working
   * picture, which made the backend impossible to test — a title that plays is
   * now a title the backend actually served.
   */
  const [backendUrl] = useState(() => loadBackendUrl());
  const [nativeUnplayable, setNativeUnplayable] = useState<string | null>(null);

  /**
   * Which source is playing, reported by the player rather than assumed here.
   * A stream that fails hands over to the next one silently, so naming
   * `sources[0]` would confidently print the wrong provider — and knowing
   * which one you are actually watching is the whole point of showing it.
   */
  const [activeSource, setActiveSource] = useState<OmssSource | undefined>(undefined);

  const {
    data: streams,
    isError: streamsFailed,
    error: streamsError,
    isFetching: streamsFetching,
  } = useQuery({
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
  const year = (movie?.release_date || movie?.first_air_date || "").slice(0, 4);

  const playableStreams = streams?.sources ?? [];
  const hasBackend = backendUrl.length > 0;
  const canPlay = hasBackend && !nativeUnplayable && !streamsFailed && playableStreams.length > 0;

  /**
   * Season summaries for the picker. TMDB lists empty and placeholder seasons,
   * which would render as dead tabs, so keep only ones with episodes. Falls
   * back to synthesising from number_of_seasons when the field is absent.
   */
  const sourceLabel = describeActiveSource(activeSource, playableStreams);

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

  // A new title deserves a fresh attempt at the good path.
  useEffect(() => {
    setNativeUnplayable(null);
    setActiveSource(undefined);
  }, [tmdbId, season, episode]);

  /**
   * Why there is no picture, said plainly.
   *
   * There is no console on a television, so the difference between "no backend
   * set", "the backend is unreachable" and "the backend had nothing for this
   * title" has to be printed — they need completely different fixes, and every
   * one of them used to render as the same silent switch to an embed.
   */
  let notice: ReactNode = null;
  if (!hasBackend) {
    notice = (
      <Placard kicker="No streaming backend">
        <p>
          Movway plays every title through its own player, which needs an OMSS backend to
          supply the stream. Set one under Settings and this page will play it here.
        </p>
        <Link
          to="/settings"
          data-tv-autofocus
          className="mt-3 inline-flex items-center border-2 border-border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-bone transition-colors hover:border-acid hover:bg-acid hover:text-ink focus-visible:border-acid focus-visible:bg-acid focus-visible:text-ink"
        >
          Open Settings
        </Link>
      </Placard>
    );
  } else if (streamsFailed) {
    notice = (
      <div className="flex aspect-video w-full items-center justify-center bg-ink px-4">
        <FaultReport
          title="Streaming backend"
          error={streamsError}
          describe={describeBackendFault}
        />
      </div>
    );
  } else if (streamsFetching && !streams) {
    notice = (
      <Placard kicker="Asking the backend">
        <p>
          Looking for a source for {title}. A backend that sleeps when idle can take up to a
          minute to wake.
        </p>
      </Placard>
    );
  } else if (nativeUnplayable) {
    notice = (
      <Placard kicker="Nothing would play">
        <p>
          The backend returned {playableStreams.length}{" "}
          {playableStreams.length === 1 ? "source" : "sources"}, and every one of them failed
          to play.
        </p>
        <p className="mt-1.5 text-muted-foreground/60">{nativeUnplayable}</p>
      </Placard>
    );
  } else {
    notice = (
      <Placard kicker="No source for this title">
        <p>
          The backend answered but offered nothing playable
          {isTV ? ` for S${season}E${episode}` : ""}. Try another title to tell this apart
          from a backend that is failing for everything.
        </p>
      </Placard>
    );
  }

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
            {canPlay ? "Now Playing" : "No stream"}
          </span>
          <span className="ml-auto truncate font-mono text-[10px] uppercase tracking-[0.14em] text-acid">
            {canPlay ? sourceLabel : "CinePro"}
            {isTV && ` · S${season}E${episode}`}
          </span>
        </div>

        {canPlay ? (
          <NativePlayer
            sources={playableStreams}
            subtitles={streams?.subtitles ?? []}
            title={title}
            onPrevEpisode={isTV && episode > 1 ? () => selectEpisode(season, episode - 1) : undefined}
            onNextEpisode={isTV ? () => selectEpisode(season, episode + 1) : undefined}
            onUnplayable={setNativeUnplayable}
            onActiveSourceChange={setActiveSource}
          />
        ) : (
          notice
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
