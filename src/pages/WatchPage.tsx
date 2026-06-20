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
import { useState, useEffect } from "react";

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
    queryFn: () => isTV ? getTVCredits(tmdbId) : getMovieCredits(tmdbId),
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

  const title = movie?.title || movie?.name || "Loading...";
  const embedOptions = { sub: subtitle || undefined };
  const embedUrl = isTV
    ? provider.buildTVUrl(tmdbId, season, episode, embedOptions)
    : provider.buildMovieUrl(tmdbId, embedOptions);

  const handleProviderChange = (id: string) => {
    setProviderId(id);
    saveProviderId(id);
  };

  const handleSubtitleChange = (code: string) => {
    setSubtitle(code);
    saveSubtitle(code);
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-sm">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="rounded-2xl overflow-hidden border border-border bg-card">
        <div className="aspect-video w-full">
          {embedUrl ? (
            <iframe
              key={`${provider.id}-${subtitle}`}
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
              referrerPolicy="origin"
              title={title}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
              Video playback is currently unavailable.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Source</span>
          <select
            value={provider.id}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="bg-secondary text-foreground rounded-lg px-3 py-1.5 text-sm border border-border"
          >
            {VIDEO_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Subtitles</span>
          <select
            value={subtitle}
            onChange={(e) => handleSubtitleChange(e.target.value)}
            disabled={!provider.supportsSubtitles}
            title={provider.supportsSubtitles ? undefined : "This source doesn't support default subtitles"}
            className="bg-secondary text-foreground rounded-lg px-3 py-1.5 text-sm border border-border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {SUBTITLE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </label>

        {!provider.supportsSubtitles && (
          <span className="text-xs text-muted-foreground">
            Use the player's own subtitle menu for this source.
          </span>
        )}
      </div>

      {movie && (
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            <h1 className="font-display text-xl md:text-3xl font-bold">{title}</h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star size={14} className="text-primary fill-primary" />
                {movie.vote_average.toFixed(1)}
              </span>
              {"runtime" in movie && movie.runtime ? <span>{movie.runtime} min</span> : null}
              {movie.genres?.map((g) => (
                <span key={g.id} className="px-2 py-0.5 rounded-md bg-secondary text-xs">{g.name}</span>
              ))}
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl">{movie.overview}</p>

            {isTV && (
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {!isAnime && (
                  <label className="flex items-center gap-2 text-sm">
                    Season
                    <select
                      value={season}
                      onChange={(e) => { setSeason(Number(e.target.value)); setEpisode(1); }}
                      className="bg-secondary text-foreground rounded-lg px-3 py-1.5 text-sm border border-border"
                    >
                      {Array.from({ length: ("number_of_seasons" in movie ? movie.number_of_seasons : 1) || 1 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>S{i + 1}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                  Episode
                  <input
                    type="number"
                    min={1}
                    value={episode}
                    onChange={(e) => setEpisode(Number(e.target.value))}
                    className="bg-secondary text-foreground rounded-lg px-3 py-1.5 text-sm border border-border w-20"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {cast.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-base font-semibold">Cast</h2>
          <div className="flex flex-wrap gap-4">
            {cast.map((member) => (
              <div key={member.id} className="flex items-center gap-3 bg-secondary rounded-xl px-3 py-2 min-w-[160px]">
                {member.profile_path ? (
                  <img
                    src={img(member.profile_path, "w92")}
                    alt={member.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs shrink-0">
                    {member.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  {member.character && (
                    <p className="text-xs text-muted-foreground truncate">{member.character}</p>
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
