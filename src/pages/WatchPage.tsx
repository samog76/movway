import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getMovieDetails,
  getTVDetails,
  getMovieCredits,
  getTVCredits,
  img,
  buildMoviePlayerUrl,
  buildTVPlayerUrl,
  moviePlayerProviders,
  tvPlayerProviders,
  DEFAULT_MOVIE_PLAYER_PROVIDER,
  DEFAULT_TV_PLAYER_PROVIDER,
  type MoviePlayerProviderId,
  type TVPlayerProviderId,
} from "@/lib/tmdb";
import { upsertWatchEntry } from "@/lib/continueWatching";
import { ArrowLeft, Star } from "lucide-react";
import { useState, useEffect } from "react";

async function resolveSuperEmbedUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SuperEmbed ${res.status}`);

  const body = (await res.text()).trim();
  if (!body) throw new Error("SuperEmbed empty response");

  try {
    const parsed = JSON.parse(body);
    if (typeof parsed === "string" && /^https?:\/\//i.test(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const candidate = [parsed.url, parsed.embed, parsed.embed_url, parsed.link].find(
        (value) => typeof value === "string" && /^https?:\/\//i.test(value)
      );
      if (typeof candidate === "string") return candidate;
    }
  } catch {
    // Continue with text/HTML extraction
  }

  const iframeSrc = body.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  if (iframeSrc && /^https?:\/\//i.test(iframeSrc)) return iframeSrc;

  const rawUrl = body.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  if (rawUrl) return rawUrl;

  throw new Error("SuperEmbed URL not found in response");
}

export default function WatchPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const tmdbId = Number(id);
  // Normalize type: anything other than "tv" is treated as "movie" to ensure
  // the correct TMDB details and credits endpoints are always called.
  const isTV = type === "tv";

  const { data: movie } = useQuery({
    queryKey: ["details", type, tmdbId],
    queryFn: async () => {
      if (isTV) return getTVDetails(tmdbId) as Promise<any>;
      return getMovieDetails(tmdbId) as Promise<any>;
    },
  });

  const { data: credits } = useQuery({
    queryKey: ["credits", type, tmdbId],
    queryFn: () => isTV ? getTVCredits(tmdbId) : getMovieCredits(tmdbId),
  });

  const cast = credits?.cast?.slice(0, 12) ?? [];

  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [movieProvider, setMovieProvider] = useState<MoviePlayerProviderId>(DEFAULT_MOVIE_PLAYER_PROVIDER);
  const [tvProvider, setTvProvider] = useState<TVPlayerProviderId>(DEFAULT_TV_PLAYER_PROVIDER);

  useEffect(() => {
    const savedMovieProvider = localStorage.getItem("movway:movie-provider");
    const savedTvProvider = localStorage.getItem("movway:tv-provider");

    if (savedMovieProvider && moviePlayerProviders.some((provider) => provider.id === savedMovieProvider)) {
      setMovieProvider(savedMovieProvider as MoviePlayerProviderId);
    }
    if (savedTvProvider && tvPlayerProviders.some((provider) => provider.id === savedTvProvider)) {
      setTvProvider(savedTvProvider as TVPlayerProviderId);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("movway:movie-provider", movieProvider);
  }, [movieProvider]);

  useEffect(() => {
    localStorage.setItem("movway:tv-provider", tvProvider);
  }, [tvProvider]);

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

  const imdbId = isTV ? (movie as any)?.external_ids?.imdb_id : (movie as any)?.imdb_id;
  const selectedProvider = isTV ? tvProvider : movieProvider;

  const { data: embedUrl, error: embedError } = useQuery({
    queryKey: ["embed-url", isTV ? "tv" : "movie", selectedProvider, tmdbId, imdbId, season, episode],
    enabled: Boolean(movie),
    queryFn: async () => {
      if (isTV) {
        const url = buildTVPlayerUrl(tvProvider, tmdbId, season, episode, imdbId);
        if (!url) {
          throw new Error(`Provider "${tvProvider}" requires IMDb ID, but it was not found.`);
        }
        if (tvProvider === "getsuperembed") {
          return resolveSuperEmbedUrl(url);
        }
        return url;
      }

      if (!imdbId) {
        throw new Error("IMDb ID was not found for this movie.");
      }

      const url = buildMoviePlayerUrl(movieProvider, imdbId);
      if (movieProvider === "getsuperembed") {
        return resolveSuperEmbedUrl(url);
      }
      return url;
    },
  });

  const title = movie?.title || movie?.name || "Loading...";

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-sm">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="rounded-2xl overflow-hidden border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Source
            <select
              value={isTV ? tvProvider : movieProvider}
              onChange={(e) => {
                if (isTV) setTvProvider(e.target.value as TVPlayerProviderId);
                else setMovieProvider(e.target.value as MoviePlayerProviderId);
              }}
              className="bg-secondary text-foreground rounded-lg px-3 py-1.5 text-sm border border-border"
            >
              {(isTV ? tvPlayerProviders : moviePlayerProviders).map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
        </div>
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
              {(embedError as Error | null)?.message || "Loading player source..."}
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
              {(movie as any).runtime && <span>{(movie as any).runtime} min</span>}
              {(movie as any).genres?.map((g: any) => (
                <span key={g.id} className="px-2 py-0.5 rounded-md bg-secondary text-xs">{g.name}</span>
              ))}
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl">{movie.overview}</p>

            {isTV && (
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  Season
                  <select
                    value={season}
                    onChange={(e) => { setSeason(Number(e.target.value)); setEpisode(1); }}
                    className="bg-secondary text-foreground rounded-lg px-3 py-1.5 text-sm border border-border"
                  >
                    {Array.from({ length: (movie as any).number_of_seasons || 1 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>S{i + 1}</option>
                    ))}
                  </select>
                </label>
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
