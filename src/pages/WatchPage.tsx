import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getMovieDetails,
  getTVDetails,
  getMovieCredits,
  getTVCredits,
  img,
  buildMovieEmbedUrl,
  buildTVEpisodeEmbedUrl,
  buildVidPlusAnimeEmbedUrl,
  getDefaultEmbedApiProvider,
  resolveEmbedApiProvider,
  type EmbedApiProvider,
  type MovieDetails,
  type TVDetails,
} from "@/lib/tmdb";
import { upsertWatchEntry } from "@/lib/continueWatching";
import { ArrowLeft, Star } from "lucide-react";
import { useState, useEffect } from "react";

const resolveEmbedApiProviderFromParams = (
  params: URLSearchParams,
  defaultProvider: EmbedApiProvider
): EmbedApiProvider => resolveEmbedApiProvider(params.get("embedApi") ?? defaultProvider);

export default function WatchPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tmdbId = Number(id);
  const defaultEmbedApiProvider = getDefaultEmbedApiProvider();
  const rawAnilistId = searchParams.get("anilistId") ?? "";
  const anilistId = Number.parseInt(rawAnilistId, 10);
  const [embedApiProvider, setEmbedApiProvider] = useState<EmbedApiProvider>(() =>
    resolveEmbedApiProviderFromParams(searchParams, defaultEmbedApiProvider)
  );
  const isAnime = type === "anime";
  const isTV = type === "tv" || isAnime;

  useEffect(() => {
    setEmbedApiProvider(resolveEmbedApiProviderFromParams(searchParams, defaultEmbedApiProvider));
  }, [searchParams, defaultEmbedApiProvider]);

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
  const [dub, setDub] = useState(false);

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
  const hasAnilistId = !Number.isNaN(anilistId) && anilistId > 0;
  const embedUrl = isAnime
    ? hasAnilistId
      ? buildVidPlusAnimeEmbedUrl(anilistId, episode, dub)
      : null
    : isTV
      ? buildTVEpisodeEmbedUrl(embedApiProvider, tmdbId, season, episode)
      : buildMovieEmbedUrl(embedApiProvider, tmdbId);
  const embedUnavailableMessage = isAnime && !hasAnilistId
    ? "Anime playback requires an AniList ID in the URL (`?anilistId=...`)."
    : "Video playback is currently unavailable.";

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-sm">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="rounded-2xl overflow-hidden border border-border bg-card">
        <div className="aspect-video w-full">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
              title={title}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
              {embedUnavailableMessage}
            </div>
          )}
        </div>
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
                {isAnime && (
                  <label className="flex items-center gap-2 text-sm">
                    Dub
                    <input
                      type="checkbox"
                      checked={dub}
                      onChange={(e) => setDub(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                )}
              </div>
            )}

            {!isAnime && (
              <div className="pt-2">
                <label className="flex items-center gap-2 text-sm">
                  Embed API
                  <select
                    value={embedApiProvider}
                    onChange={(e) => {
                      const provider = resolveEmbedApiProvider(e.target.value);
                      setEmbedApiProvider(provider);
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.set("embedApi", provider);
                      setSearchParams(nextParams, { replace: true });
                    }}
                    className="bg-secondary text-foreground rounded-lg px-3 py-1.5 text-sm border border-border"
                  >
                    <option value="vidplus">VidPlus</option>
                    <option value="vidsrc-embed">Vidsrc Embed</option>
                  </select>
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
