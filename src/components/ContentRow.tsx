import { ChevronLeft, ChevronRight, Star, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Movie, img } from "@/lib/tmdb";
import { Link } from "react-router-dom";

interface Props {
  title: string;
  items: Movie[];
  showDelete?: boolean;
}

export default function ContentRow({ title, items, showDelete }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <div className="flex gap-2">
          <button onClick={() => scroll(-1)} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scroll(1)} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {items.map((item) => {
          const type = item.media_type === "tv" || item.first_air_date ? "tv" : "movie";
          return (
            <Link
              key={item.id}
              to={`/watch/${type}/${item.id}`}
              className="flex-shrink-0 w-[180px] group/card relative"
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
                {showDelete && (
                  <button className="absolute top-2 right-2 p-1.5 rounded-md bg-destructive/80 text-destructive-foreground opacity-0 group-hover/card:opacity-100 transition">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm font-medium truncate">{item.title || item.name}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
