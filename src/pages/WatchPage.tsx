import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getMovieDetails,
  getTVDetails,
  getMovieCredits,
  getTVCredits,
  img,
  backdrop,
  mediaTypeOf,
  pickLogo,
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
import { Star } from "lucide-react";
import { TitleArt } from "@/components/HeroSection";
import MyListButton from "@/components/MyListButton";
import { useState, useEffect, useMemo, useRef, useCallback, ReactNode } from "react";

/** A labelled glass pill around a native select. */
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
    <label
      className="glass flex items-center gap-2 rounded-full pl-4 pr-2 transition-shadow focus-within:ring-2 focus-within:ring-white/70"
      title={hint}
    >
      <span className="text-sm font-medium text-white/50">{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  "cursor-pointer rounded-full bg-transparent py-2.5 pr-2 text-sm font-medium text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 [&>option]:bg-[hsl(var(--popover))]";

const formatRuntime = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

const formatMoney = (n?: number) =>
  n ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : undefined;

const formatDate = (iso?: string) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined;

function languageName(code?: string): string | undefined {
  if (!code) return undefined;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** "Ends 9:42 PM": when it would finish if started now. */
const endsAt = (min: number) =>
  new Date(Date.now() + min * 60_000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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



  const runtime =
    movie && "runtime" in movie && movie.runtime
      ? movie.runtime
      : movie && "episode_run_time" in movie
        ? movie.episode_run_time?.[0]
        : undefined;
  const logoPath = pickLogo(movie?.images?.logos);
  const credit = isTV
    ? (movie && "created_by" in movie ? movie.created_by : undefined)?.map((c) => c.name).slice(0, 2).join(", ")
    : credits?.crew?.filter((c) => c.job === "Director").map((c) => c.name).slice(0, 2).join(", ");

  const facts: [string, ReactNode][] = [];
  if (movie) {
    if (runtime)
      facts.push([
        isTV ? "Episode length" : "Runtime",
        <>
          {formatRuntime(runtime)}
          {!isTV && <span className="text-white/40"> · Ends {endsAt(runtime)}</span>}
        </>,
      ]);
    const lang = languageName(movie.original_language);
    if (lang) facts.push(["Language", lang]);
    if (isTV) {
      if ("number_of_seasons" in movie && movie.number_of_seasons) facts.push(["Seasons", movie.number_of_seasons]);
      if ("number_of_episodes" in movie && movie.number_of_episodes) facts.push(["Episodes", movie.number_of_episodes]);
      const first = formatDate(movie.first_air_date);
      if (first) facts.push(["First aired", first]);
      if (movie.status) facts.push(["Status", movie.status]);
    } else {
      const released = formatDate(movie.release_date);
      if (released) facts.push(["Release date", released]);
      const budget = formatMoney("budget" in movie ? movie.budget : undefined);
      if (budget) facts.push(["Budget", budget]);
      const revenue = formatMoney("revenue" in movie ? movie.revenue : undefined);
      if (revenue) facts.push(["Revenue", revenue]);
    }
  }
  const studios = (movie?.production_companies ?? []).filter((c) => c.logo_path).slice(0, 3);

  return (
    <div className="relative">
      {/* ── Backdrop: the title's art behind everything, fading into the ground ── */}
      {movie?.backdrop_path && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] overflow-hidden">
          <img src={backdrop(movie.backdrop_path)} alt="" className="h-full w-full animate-hero-fade object-cover object-top opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
        </div>
      )}

      <div className="tv-safe relative space-y-10 px-4 pb-6 pt-[var(--nav-h)] md:px-12 lg:px-16">
        {/* ── Player ── */}
        <div className="mx-auto max-w-[1400px] space-y-3">
          <div className="overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10">
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

          {/* ── Source and subtitles ── */}
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
              label="Subtitles"
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

            <span className="ml-auto text-sm text-white/45">
              {useNativePlayer ? streams?.sources[0]?.provider?.name ?? "Direct" : provider.name}
              {isTV && ` · S${season} · E${episode}`}
            </span>

            {!provider.supportsSubtitles && (
              <span className="w-full text-xs text-white/45">
                Use the player's own subtitle menu for this source.
              </span>
            )}
            {!useNativePlayer && provider.reportsPlayback === false && (
              <span className="w-full text-xs text-white/45">
                {provider.name} doesn't report whether it is playing, so Movway won't switch away from it
                on its own. If it doesn't start, pick another source above.
              </span>
            )}
          </div>
        </div>

        {/* ── Title ── */}
        {movie && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="space-y-5">
              <TitleArt logoPath={logoPath} title={title} className="object-left" />

              {movie.genres?.length ? (
                <p className="flex flex-wrap items-center gap-x-3 text-lg font-medium text-white/90">
                  {movie.genres.map((g, i) => (
                    <span key={g.id} className="flex items-center gap-3">
                      {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-white/40" />}
                      {g.name}
                    </span>
                  ))}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-lg font-medium text-white/90">
                {year && <span>{year}</span>}
                {runtime ? <span>{formatRuntime(runtime)}</span> : null}
                {isTV && "number_of_seasons" in movie && movie.number_of_seasons ? (
                  <span className="tag">{movie.number_of_seasons} {movie.number_of_seasons === 1 ? "season" : "seasons"}</span>
                ) : null}
                {movie.vote_average ? (
                  <span className="flex items-center gap-1.5">
                    <Star size={18} className="fill-acid text-acid" />
                    {movie.vote_average.toFixed(1)}
                  </span>
                ) : null}
                <MyListButton item={{ ...movie, media_type: mediaTypeOf(movie) }} className="h-10 w-10 min-w-0" />
              </div>

              {credit && (
                <p className="text-[17px] text-white/90">
                  <span className="text-white/45">{isTV ? "Created by" : "Director"}:</span> {credit}
                </p>
              )}

              <Overview text={movie.overview} />
            </div>

            {facts.length > 0 && (
              <aside className="space-y-6 self-start">
                <dl className="glass overflow-hidden rounded-xl text-sm">
                  {facts.map(([label, value], i) => (
                    <div key={label} className={`flex items-center justify-between gap-4 px-4 py-3 ${i ? "border-t border-white/[0.06]" : ""}`}>
                      <dt className="text-white/50">{label}</dt>
                      <dd className="text-right font-medium text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
                {/* Studio marks, white on the ground. Some logos ship with an
                    opaque white background; inverted and screened, that
                    background turns black and drops out instead of leaving a
                    grey slab. */}
                {studios.length > 0 && (
                  <div className="flex items-center justify-around gap-6 px-2">
                    {studios.map((c) => (
                      <img
                        key={c.id}
                        src={img(c.logo_path, "w185")}
                        alt={c.name}
                        title={c.name}
                        className="max-h-9 max-w-[7rem] object-contain opacity-80 mix-blend-screen contrast-125 grayscale invert"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
              </aside>
            )}
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
          <section className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Cast</h2>
            <div className="scrollbar-hide -mx-4 flex gap-5 overflow-x-auto px-4 pb-2 md:-mx-0 md:px-0">
              {cast.map((member) => (
                <div key={member.id} className="w-[7.5rem] shrink-0 text-center">
                  {member.profile_path ? (
                    <img
                      src={img(member.profile_path, "w185")}
                      alt=""
                      className="mx-auto aspect-square w-full rounded-full object-cover shadow-lg shadow-black/40 ring-1 ring-white/10"
                      loading="lazy"
                    />
                  ) : (
                    <div className="mx-auto flex aspect-square w-full items-center justify-center rounded-full bg-card text-2xl font-semibold text-white/50">
                      {member.name.charAt(0)}
                    </div>
                  )}
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">{member.name}</p>
                  {member.character && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{member.character}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** Overview clamped to three lines, with "Read more" when it runs longer. */
function Overview({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 240;
  return (
    <div className="max-w-[44rem]">
      <p className={`text-[17px] leading-7 text-white/80 ${open || !long ? "" : "line-clamp-3"}`}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 rounded text-sm font-semibold text-white/60 hover:text-white focus-visible:text-white"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
