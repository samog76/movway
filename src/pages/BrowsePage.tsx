import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getPopularMovies,
  getPopularTV,
  getAnime,
  getTrendingMovies,
  getTrendingTV,
  Movie,
} from "@/lib/tmdb";
import { PosterCard } from "@/components/ContentRow";
import PageHeader from "@/components/PageHeader";

interface CategoryConfig {
  label: string;
  queryKey: string;
  fetcher: () => Promise<{ results: Movie[] }>;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  movie: { label: "Movies", queryKey: "browse-movie", fetcher: getPopularMovies },
  tv: { label: "Series", queryKey: "browse-tv", fetcher: getPopularTV },
  anime: { label: "Anime", queryKey: "browse-anime", fetcher: getAnime },
  "trending-movie": {
    label: "Trending Movies",
    queryKey: "browse-trending-movie",
    fetcher: getTrendingMovies,
  },
  "trending-tv": {
    label: "Trending Series",
    queryKey: "browse-trending-tv",
    fetcher: getTrendingTV,
  },
};

const GRID =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6";

/** Shared empty/error state — a blank film frame with a mono caption. */
function Placard({ code, title, note }: { code: string; title: string; note: string }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-border py-24 text-center">
      <span className="font-display text-6xl font-extrabold leading-none text-stroke">{code}</span>
      <p className="mt-5 font-display text-xl font-extrabold uppercase tracking-tight text-bone">
        {title}
      </p>
      <p className="mt-2 max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
        {note}
      </p>
    </div>
  );
}

export default function BrowsePage() {
  const { category } = useParams<{ category: string }>();
  const config = category ? CATEGORY_CONFIG[category] : undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: [config?.queryKey ?? "browse", category],
    queryFn: config?.fetcher ?? (() => Promise.resolve({ results: [] as Movie[] })),
    enabled: !!config,
  });

  if (!config) {
    return (
      <div className="space-y-8">
        <PageHeader kicker="Catalogue" title={category ?? "Unknown"} />
        <Placard
          code="00"
          title="Coming Soon"
          note="This reel hasn't been threaded through the projector yet. Check back for the next screening."
        />
      </div>
    );
  }

  const count = data?.results?.length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Catalogue"
        title={config.label}
        aside={
          count > 0 ? (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {String(count).padStart(3, "0")} TITLES
            </span>
          ) : undefined
        }
      />

      {isError ? (
        <Placard
          code="404"
          title="Reel Jammed"
          note="Could not fetch this catalogue from TMDB. Give the projectionist a moment and try again."
        />
      ) : isLoading ? (
        <div className={GRID}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] animate-pulse border border-border bg-card"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      ) : count > 0 ? (
        <div className={GRID}>
          {data!.results.map((item, i) => (
            <div
              key={item.id}
              className="reveal"
              style={{ animationDelay: `${Math.min(i * 28, 500)}ms` }}
            >
              <PosterCard item={item} rank={i + 1} />
            </div>
          ))}
        </div>
      ) : (
        <Placard
          code="—"
          title="Empty House"
          note="No titles are screening in this category right now."
        />
      )}
    </div>
  );
}
