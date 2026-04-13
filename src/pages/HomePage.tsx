import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  getTrending,
  getTrendingMovies,
  getTrendingTV,
  getPopularMovies,
  getTopRated,
  getPopularTV,
  getUpcoming,
} from "@/lib/tmdb";
import { getContinueWatching, removeWatchEntry, WatchEntry } from "@/lib/continueWatching";
import HeroSection from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";

export default function HomePage() {
  const { data: trending, isError: trendingError } = useQuery({
    queryKey: ["trending"],
    queryFn: getTrending,
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: trendingMovies, isError: trendingMoviesError } = useQuery({
    queryKey: ["trendingMovies"],
    queryFn: getTrendingMovies,
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: trendingTV, isError: trendingTVError } = useQuery({
    queryKey: ["trendingTV"],
    queryFn: getTrendingTV,
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: popular } = useQuery({ queryKey: ["popular"], queryFn: getPopularMovies });
  const { data: topRated } = useQuery({ queryKey: ["topRated"], queryFn: getTopRated });
  const { data: tv } = useQuery({ queryKey: ["popularTV"], queryFn: getPopularTV });
  const { data: upcoming } = useQuery({ queryKey: ["upcoming"], queryFn: getUpcoming });

  const [continueWatching, setContinueWatching] = useState<WatchEntry[]>([]);

  useEffect(() => {
    const sorted = getContinueWatching().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    setContinueWatching(sorted);
  }, []);

  const handleDeleteContinueWatching = (item: WatchEntry) => {
    removeWatchEntry(item.id, item.media_type);
    setContinueWatching((prev) =>
      prev.filter((e) => !(e.id === item.id && e.media_type === item.media_type))
    );
  };

  const hero = trending?.results?.[0] ?? null;

  return (
    <div className="space-y-10">
      {trendingError ? (
        <div className="h-[220px] sm:h-[340px] md:h-[450px] rounded-2xl bg-secondary/30 flex items-center justify-center text-muted-foreground text-sm">
          Failed to load featured content.
        </div>
      ) : (
        <HeroSection movie={hero} />
      )}

      {continueWatching.length > 0 && (
        <ContentRow
          title="Continue Watching"
          items={continueWatching}
          showDelete
          onDelete={(item) => handleDeleteContinueWatching(item as WatchEntry)}
        />
      )}

      {trendingMoviesError ? (
        <p className="text-sm text-destructive px-1">Failed to load trending movies.</p>
      ) : trendingMovies && trendingMovies.results.length > 0 ? (
        <ContentRow title="Trending Movies" items={trendingMovies.results.slice(0, 10)} />
      ) : !trendingMovies ? (
        <div className="h-[260px] rounded-2xl bg-secondary/30 animate-pulse" />
      ) : null}

      {trendingTVError ? (
        <p className="text-sm text-destructive px-1">Failed to load trending TV shows.</p>
      ) : trendingTV && trendingTV.results.length > 0 ? (
        <ContentRow title="Trending TV Shows" items={trendingTV.results.slice(0, 10)} />
      ) : !trendingTV ? (
        <div className="h-[260px] rounded-2xl bg-secondary/30 animate-pulse" />
      ) : null}

      {popular && <ContentRow title="Popular Movies" items={popular.results.slice(0, 10)} />}
      {tv && <ContentRow title="Popular TV Shows" items={tv.results.slice(0, 10)} />}
      {topRated && <ContentRow title="Top Rated" items={topRated.results.slice(0, 10)} />}
      {upcoming && <ContentRow title="Coming Soon" items={upcoming.results.slice(0, 10)} />}
    </div>
  );
}
