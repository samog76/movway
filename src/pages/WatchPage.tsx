import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMovieDetails, getTVDetails, playerUrl, backdrop } from "@/lib/tmdb";
import { ArrowLeft, Star } from "lucide-react";
import { useState } from "react";

export default function WatchPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const tmdbId = Number(id);
  const isTV = type === "tv";

  const { data: movie } = useQuery({
    queryKey: ["details", type, tmdbId],
    queryFn: async () => {
      if (isTV) return getTVDetails(tmdbId) as Promise<any>;
      return getMovieDetails(tmdbId) as Promise<any>;
    },
  });

  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  const embedUrl = isTV
    ? playerUrl.tv(tmdbId, season, episode)
    : playerUrl.movie(tmdbId);

  const title = movie?.title || movie?.name || "Loading...";

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-sm">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="rounded-2xl overflow-hidden border border-border bg-card">
        <div className="aspect-video w-full">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
            title={title}
          />
        </div>
      </div>

      {movie && (
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            <h1 className="font-display text-3xl font-bold">{title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
              <div className="flex items-center gap-4 pt-2">
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
    </div>
  );
}
