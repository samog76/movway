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
import { useMyList } from "@/hooks/useMyList";
import HeroSection, { HeroSkeleton } from "@/components/HeroSection";
import ContentRow, { ROW_INSET, RowSkeleton } from "@/components/ContentRow";
import ServiceStrip from "@/components/ServiceStrip";
import FaultReport from "@/components/FaultReport";

const FEATURED = 8;

/** "S2 · E5" over the art, so a series shows where it was left. */
const episodeBadge = (item: Movie) => {
  const e = item as WatchEntry;
  return e.media_type === "tv" && e.season && e.episode ? `S${e.season} · E${e.episode}` : undefined;
};

export default function HomePage() {
  const refresh = { refetchInterval: 5 * 60 * 1000 };
  const trending = useQuery({ queryKey: ["trending"], queryFn: getTrending, ...refresh });
  const trendingMovies = useQuery({ queryKey: ["trendingMovies"], queryFn: getTrendingMovies, ...refresh });
  const trendingTV = useQuery({ queryKey: ["trendingTV"], queryFn: getTrendingTV, ...refresh });
  const { data: popular } = useQuery({ queryKey: ["popular"], queryFn: getPopularMovies });
  const { data: tv } = useQuery({ queryKey: ["popularTV"], queryFn: getPopularTV });
  const { data: topRated } = useQuery({ queryKey: ["topRated"], queryFn: getTopRated });
  const { data: upcoming } = useQuery({ queryKey: ["upcoming"], queryFn: getUpcoming });
  const myList = useMyList();

  const [continueWatching, setContinueWatching] = useState<WatchEntry[]>([]);

  useEffect(() => {
    setContinueWatching(
      getContinueWatching()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12)
    );
  }, []);

  const handleDeleteContinueWatching = (item: WatchEntry) => {
    removeWatchEntry(item.id, item.media_type);
    setContinueWatching((prev) =>
      prev.filter((e) => !(e.id === item.id && e.media_type === item.media_type))
    );
  };

  const featured = (trending.data?.results ?? [])
    .filter((m) => m.backdrop_path && (m.media_type === "movie" || m.media_type === "tv"))
    .slice(0, FEATURED);

  const sections: { title: string; items: Movie[]; viewAll?: string }[] = [];
  const add = (title: string, list: Movie[] | undefined, viewAll?: string) => {
    if (list?.length) sections.push({ title, items: list.slice(0, 20), viewAll });
  };
  add("Trending Movies", trendingMovies.data?.results, "/browse/trending-movie");
  add("Trending Series", trendingTV.data?.results, "/browse/trending-tv");
  add("Popular Movies", popular?.results, "/browse/movie");
  add("Popular Series", tv?.results, "/browse/tv");
  add("Top Rated", topRated?.results);
  add("Coming Soon", upcoming?.results);

  return (
    <div className="pb-6">
      {trending.isError ? (
        <div className={`tv-safe pt-[var(--nav-h)] ${ROW_INSET}`}>
          <FaultReport title="Could not load featured titles" error={trending.error} />
        </div>
      ) : featured.length ? (
        <HeroSection items={featured} />
      ) : trending.isSuccess ? (
        <div className="h-[var(--nav-h)]" />
      ) : (
        <HeroSkeleton />
      )}

      {/* Rows rise into the bottom of the hero, the way the art fades out.
          They wait for the hero: on a TV the remote is seeded into the first
          control on screen, and that should be Play, not whichever row's
          request happened to finish first. */}
      {(trending.isSuccess || trending.isError) && (
        <div
          className={`home-rows relative z-10 space-y-10 md:space-y-12 ${featured.length ? "-mt-16 md:-mt-24" : ""}`}
        >
          <ServiceStrip />

          {continueWatching.length > 0 && (
            <ContentRow
              title="Continue Watching"
              items={continueWatching}
              showDelete
              onDelete={(item) => handleDeleteContinueWatching(item as WatchEntry)}
              badgeFor={episodeBadge}
            />
          )}

          {myList.length > 0 && <ContentRow title="My List" items={myList} viewAll="/list" />}

          {trendingMovies.isError && (
            <div className={`tv-safe ${ROW_INSET}`}>
              <FaultReport title="Trending movies" error={trendingMovies.error} compact />
            </div>
          )}
          {trendingTV.isError && (
            <div className={`tv-safe ${ROW_INSET}`}>
              <FaultReport title="Trending series" error={trendingTV.error} compact />
            </div>
          )}

          {!trendingMovies.data && !trendingMovies.isError && <RowSkeleton />}
          {!trendingTV.data && !trendingTV.isError && <RowSkeleton />}

          {sections.map((s) => (
            <ContentRow key={s.title} title={s.title} items={s.items} viewAll={s.viewAll} />
          ))}
        </div>
      )}
    </div>
  );
}
