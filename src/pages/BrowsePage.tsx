import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import {
  getPopularMovies,
  getPopularTV,
  getAnime,
  getTrendingMovies,
  getTrendingTV,
  getServiceTitles,
  getStreamingServices,
  Movie,
} from "@/lib/tmdb";
import { PosterCard } from "@/components/ContentRow";
import PageHeader, { POSTER_GRID } from "@/components/PageHeader";

interface CategoryConfig {
  label: string;
  queryKey: string;
  fetcher: () => Promise<{ results: Movie[] }>;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  movie: { label: "Movies", queryKey: "browse-movie", fetcher: getPopularMovies },
  tv: { label: "Series", queryKey: "browse-tv", fetcher: getPopularTV },
  anime: { label: "Anime", queryKey: "browse-anime", fetcher: getAnime },
  "trending-movie": { label: "Trending Movies", queryKey: "browse-trending-movie", fetcher: getTrendingMovies },
  "trending-tv": { label: "Trending Series", queryKey: "browse-trending-tv", fetcher: getTrendingTV },
};

/** Empty and error states. */
function Placard({ title, note }: { title: string; note: string }) {
  return (
    <div className="glass flex flex-col items-center rounded-2xl px-6 py-20 text-center">
      <Film size={36} className="text-white/40" />
      <p className="mt-5 text-xl font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-white/60">{note}</p>
    </div>
  );
}

function Grid({ items, isLoading, isError }: { items?: Movie[]; isLoading: boolean; isError: boolean }) {
  if (isError)
    return <Placard title="Couldn't load this catalogue" note="TMDB did not answer. Try again in a moment." />;
  if (isLoading)
    return (
      <div className={POSTER_GRID}>
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-card" />
        ))}
      </div>
    );
  if (!items?.length) return <Placard title="Nothing here yet" note="No titles in this category right now." />;
  return (
    <div className={POSTER_GRID}>
      {items.map((item) => (
        <PosterCard key={`${item.id}`} item={item} />
      ))}
    </div>
  );
}

/** Pill toggle, the filter idiom used across the app. */
function Pills<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="glass flex rounded-full p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            value === o.value ? "bg-white text-black" : "text-white/60 hover:text-white focus-visible:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** One streaming service's catalogue, movies or series. */
function ServiceCatalogue({ serviceId }: { serviceId: number }) {
  const [type, setType] = useState<"movie" | "tv">("movie");
  const { data: services } = useQuery({
    queryKey: ["streaming-services"],
    queryFn: getStreamingServices,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const name = services?.find((s) => s.provider_id === serviceId)?.provider_name ?? "Service";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["service-titles", serviceId, type],
    queryFn: () => getServiceTitles(serviceId, type),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={name}
        aside={
          <Pills<"movie" | "tv">
            value={type}
            onChange={setType}
            options={[
              { value: "movie", label: "Movies" },
              { value: "tv", label: "Series" },
            ]}
          />
        }
      />
      <Grid items={data?.results} isLoading={isLoading} isError={isError} />
    </div>
  );
}

export default function BrowsePage() {
  const { category = "" } = useParams<{ category: string }>();
  const serviceId = /^service-(\d+)$/.exec(category)?.[1];
  const config = CATEGORY_CONFIG[category];

  const { data, isLoading, isError } = useQuery({
    queryKey: [config?.queryKey ?? "browse", category],
    queryFn: config?.fetcher ?? (() => Promise.resolve({ results: [] as Movie[] })),
    enabled: !!config,
  });

  if (serviceId) return <ServiceCatalogue key={serviceId} serviceId={Number(serviceId)} />;

  if (!config) {
    return (
      <div className="space-y-8">
        <PageHeader title="Coming soon" />
        <Placard title="Not available yet" note="This section isn't ready. Check back soon." />
      </div>
    );
  }

  const count = data?.results?.length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={config.label}
        aside={count > 0 ? <span className="text-sm text-white/50">{count} titles</span> : undefined}
      />
      <Grid items={data?.results} isLoading={isLoading} isError={isError} />
    </div>
  );
}
