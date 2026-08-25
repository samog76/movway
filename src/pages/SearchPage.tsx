import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchMulti, Movie } from "@/lib/tmdb";
import { Search, X } from "lucide-react";
import { PosterCard } from "@/components/ContentRow";
import PageHeader from "@/components/PageHeader";

const SUGGESTIONS = ["Dune", "Severance", "Akira", "Blade Runner", "Chainsaw Man"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
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
        kicker="Index"
        title="Search"
        aside={
          active && !isFetching ? (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {String(results.length).padStart(3, "0")} HITS
            </span>
          ) : undefined
        }
      />

      {/* ── Search field: a slab, not a pill ── */}
      <div className="reveal flex max-w-2xl items-stretch border-2 border-border transition-colors focus-within:border-acid">
        <span className="flex items-center bg-acid px-3.5 text-ink">
          <Search size={17} strokeWidth={2.5} />
        </span>
        <input
          type="text"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder="TITLE, SERIES, ANIME…"
          className="min-w-0 flex-1 bg-card px-4 py-3.5 font-mono text-xs uppercase tracking-[0.12em] text-bone placeholder:text-muted-foreground/60 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="flex items-center bg-card px-3 text-muted-foreground transition-colors hover:text-flare focus-visible:text-flare"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── States ── */}
      {!active ? (
        <div className="reveal space-y-4" style={{ animationDelay: "90ms" }}>
          <p className="font-mono text-[11px] text-muted-foreground">
            Type at least three characters. Or start here:
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-acid focus-visible:border-acid hover:bg-acid focus-visible:bg-acid hover:text-ink focus-visible:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : isFetching ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse border border-border bg-card" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {results.map((item, i) => (
            <div
              key={`${item.media_type}-${item.id}`}
              className="reveal"
              style={{ animationDelay: `${Math.min(i * 28, 400)}ms` }}
            >
              <PosterCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border border-dashed border-border py-20 text-center">
          <span className="font-display text-6xl font-extrabold leading-none text-stroke">—</span>
          <p className="mt-5 font-display text-xl font-extrabold uppercase tracking-tight text-bone">
            No Prints Found
          </p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Nothing in the vault matches “{query}”.
          </p>
        </div>
      )}
    </div>
  );
}
