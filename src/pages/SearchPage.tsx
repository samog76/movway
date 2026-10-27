import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchMulti, Movie } from "@/lib/tmdb";
import { Search, X } from "lucide-react";
import { PosterCard } from "@/components/ContentRow";
import PageHeader, { POSTER_GRID } from "@/components/PageHeader";

const SUGGESTIONS = ["Dune", "Severance", "Akira", "Blade Runner", "Chainsaw Man"];

export default function SearchPage() {
  /**
   * The query lives in the URL rather than component state so that coming back
   * from a title lands on the results the viewer left, instead of an empty box
   * they have to type into again. Updates replace rather than push, so Back
   * steps off the search screen instead of replaying the typing.
   */
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = useCallback(
    (value: string) => setParams(value ? { q: value } : {}, { replace: true }),
    [setParams]
  );

  const active = query.trim().length > 2;

  const { data, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchMulti(query),
    enabled: active,
  });

  const results: Movie[] =
    data?.results?.filter(
      (r) => r.poster_path && (r.media_type === "movie" || r.media_type === "tv")
    ) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Search"
        aside={
          active && !isFetching ? (
            <span className="text-sm text-white/50">{results.length} results</span>
          ) : undefined
        }
      />

      <div className="glass flex max-w-2xl items-center gap-3 rounded-full px-5 transition-shadow focus-within:ring-2 focus-within:ring-white/70">
        <Search size={20} className="shrink-0 text-white/60" />
        <input
          type="text"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Movies, series, anime…"
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent py-4 text-base text-white placeholder:text-white/40 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {!active ? (
        <div className="space-y-4">
          <p className="text-sm text-white/50">Type at least three characters, or try one of these:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="glass rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : isFetching ? (
        <div className={POSTER_GRID}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className={POSTER_GRID}>
          {results.map((item) => (
            <PosterCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="glass flex flex-col items-center rounded-2xl px-6 py-20 text-center">
          <Search size={36} className="text-white/40" />
          <p className="mt-5 text-xl font-semibold text-white">No results</p>
          <p className="mt-2 text-sm text-white/60">Nothing matches “{query}”.</p>
        </div>
      )}
    </div>
  );
}
