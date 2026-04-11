import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchMulti, img } from "@/lib/tmdb";
import { Search, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const { data } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchMulti(query),
    enabled: query.length > 2,
  });

  return (
    <div className="space-y-6">
      <div className="relative max-w-xl">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies, TV shows, anime..."
          className="w-full bg-secondary text-foreground rounded-xl pl-11 pr-4 py-3 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.results
            .filter((r) => r.poster_path && (r.media_type === "movie" || r.media_type === "tv"))
            .map((item) => (
              <Link
                key={item.id}
                to={`/watch/${item.media_type}/${item.id}`}
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
                    {item.vote_average.toFixed(1)}
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium truncate">{item.title || item.name}</p>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
