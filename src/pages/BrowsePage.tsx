import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPopularMovies, getPopularTV, getAnime, img, Movie } from "@/lib/tmdb";
import { Star } from "lucide-react";

interface CategoryConfig {
  label: string;
  queryKey: string;
  fetcher: () => Promise<{ results: Movie[] }>;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  movie: { label: "Movies", queryKey: "browse-movie", fetcher: getPopularMovies },
  tv: { label: "TV Shows", queryKey: "browse-tv", fetcher: getPopularTV },
  anime: { label: "Anime", queryKey: "browse-anime", fetcher: getAnime },
};

export default function BrowsePage() {
  const { category } = useParams<{ category: string }>();
  const config = category ? CATEGORY_CONFIG[category] : undefined;

  const { data } = useQuery({
    queryKey: [config?.queryKey ?? "browse", category],
    queryFn: config?.fetcher ?? (() => Promise.resolve({ results: [] as Movie[] })),
    enabled: !!config,
  });

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">Coming Soon</p>
        <p className="text-sm mt-2">This section is not available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl md:text-3xl font-bold">{config.label}</h1>
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.results.map((item) => {
            const type =
              item.media_type === "tv" ||
              !!item.first_air_date ||
              (item.name && !item.title)
                ? "tv"
                : "movie";
            return (
              <Link
                key={item.id}
                to={`/watch/${type}/${item.id}`}
                className="group/card"
              >
                <div className="relative rounded-xl overflow-hidden aspect-[2/3]">
                  <img
                    src={img(item.poster_path, "w342")}
                    alt={item.title || item.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-md">
                    <Star size={12} className="text-primary fill-primary" />
                    {item.vote_average ? item.vote_average.toFixed(1) : "N/A"}
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium truncate">{item.title || item.name}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
