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
  Movie,
} from "@/lib/tmdb";
import { getContinueWatching, removeWatchEntry, WatchEntry } from "@/lib/continueWatching";
import HeroSection from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";

function RowSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-48 animate-pulse bg-card" />
      <div className="flex gap-3 md:gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[2/3] w-[132px] shrink-0 animate-pulse border border-border bg-card md:w-[176px]"
          />
        ))}
      </div>
    </div>
  );
}

function RowError({ label }: { label: string }) {
  return (
    <div className="border border-flare/40 bg-flare/5 px-4 py-3">
      <span className="kicker text-flare">Reel Jammed</span>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        Could not load {label}.
      </p>
    </div>
  );
}

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
    const sorted = getContinueWatching()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8);
    setContinueWatching(sorted);
  }, []);

  const handleDeleteContinueWatching = (item: WatchEntry) => {
    removeWatchEntry(item.id, item.media_type);
    setContinueWatching((prev) =>
      prev.filter((e) => !(e.id === item.id && e.media_type === item.media_type))
    );
  };

  const hero = trending?.results?.[0] ?? null;

  // Sections are numbered in the order they actually render.
  const sections: { title: string; items: Movie[] }[] = [];
  if (trendingMovies?.results?.length)
    sections.push({ title: "Trending Films", items: trendingMovies.results.slice(0, 12) });
  if (trendingTV?.results?.length)
    sections.push({ title: "Trending Series", items: trendingTV.results.slice(0, 12) });
  if (popular?.results?.length)
    sections.push({ title: "Popular Films", items: popular.results.slice(0, 12) });
  if (tv?.results?.length)
    sections.push({ title: "Popular Series", items: tv.results.slice(0, 12) });
  if (topRated?.results?.length)
    sections.push({ title: "Top Rated", items: topRated.results.slice(0, 12) });
  if (upcoming?.results?.length)
    sections.push({ title: "Coming Soon", items: upcoming.results.slice(0, 12) });

  const continueOffset = continueWatching.length > 0 ? 1 : 0;

  return (
    <div className="space-y-12 md:space-y-16">
      {trendingError ? (
        <div className="flex aspect-[16/9] items-center justify-center border border-flare/40 bg-flare/5 sm:aspect-[21/9]">
          <div className="text-center">
            <span className="kicker text-flare">Projector Fault</span>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Featured reel unavailable.
            </p>
          </div>
        </div>
      ) : (
        <HeroSection movie={hero} />
      )}

      {continueWatching.length > 0 && (
        <div style={{ animationDelay: "80ms" }}>
          <ContentRow
            index={1}
            title="Continue Watching"
            items={continueWatching}
            showDelete
            onDelete={(item) => handleDeleteContinueWatching(item as WatchEntry)}
          />
        </div>
      )}

      {trendingMoviesError && <RowError label="trending films" />}
      {trendingTVError && <RowError label="trending series" />}

      {!trendingMovies && !trendingMoviesError && <RowSkeleton />}
      {!trendingTV && !trendingTVError && <RowSkeleton />}

      {sections.map((section, i) => (
        <div
          key={section.title}
          style={{ animationDelay: `${Math.min((i + continueOffset) * 70, 350)}ms` }}
        >
          <ContentRow
            index={i + 1 + continueOffset}
            title={section.title}
            items={section.items}
          />
        </div>
      ))}
    </div>
  );
}
