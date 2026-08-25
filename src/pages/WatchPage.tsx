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
  loadProviderId,
  saveProviderId,
  loadSubtitle,
  saveSubtitle,
} from "@/lib/providers";
import { upsertWatchEntry } from "@/lib/continueWatching";
import { ArrowLeft, Star } from "lucide-react";
import { useState, useEffect, ReactNode } from "react";

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
  };

  const handleSubtitleChange = (code: string) => {
    setSubtitle(code);
    saveSubtitle(code);
  };

  const year = (movie?.release_date || movie?.first_air_date || "").slice(0, 4);

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
          <span className="kicker text-muted-foreground">Now Playing</span>
          <span className="ml-auto truncate font-mono text-[10px] uppercase tracking-[0.14em] text-acid">
            {provider.name}
            {isTV && ` · S${season}E${episode}`}
          </span>
        </div>

        <div className="aspect-video w-full bg-ink">
          {embedUrl ? (
            <iframe
              key={`${provider.id}-${subtitle}`}
              src={embedUrl}
              className="h-full w-full"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
              referrerPolicy="origin"
              title={title}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center">
              <div>
                <span className="kicker text-flare">Signal Lost</span>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  Video playback is currently unavailable.
                </p>
              </div>
            </div>
          )}
        </div>
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

        {isTV && (
          <>
            {!isAnime && (
              <Control label="Season">
                <select
                  value={season}
                  onChange={(e) => {
                    setSeason(Number(e.target.value));
                    setEpisode(1);
                  }}
                  className={selectClass}
                >
                  {Array.from(
                    {
                      length:
                        (movie && "number_of_seasons" in movie ? movie.number_of_seasons : 1) || 1,
                    },
                    (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        S{i + 1}
                      </option>
                    )
                  )}
                </select>
              </Control>
            )}
            <Control label="Ep">
              <input
                type="number"
                min={1}
                value={episode}
                onChange={(e) => setEpisode(Number(e.target.value))}
                className={`${selectClass} w-20`}
              />
            </Control>
          </>
        )}

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
