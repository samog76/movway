import { Play, Plus } from "lucide-react";
import { Movie, backdrop } from "@/lib/tmdb";
import { Link } from "react-router-dom";

interface Props {
  movie: Movie | null;
}

export default function HeroSection({ movie }: Props) {
  if (!movie) return <div className="h-[450px] bg-card rounded-2xl animate-pulse" />;

  const title = movie.title || movie.name || "";
  const type = movie.media_type === "tv" ? "tv" : "movie";

  return (
    <div className="relative h-[450px] rounded-2xl overflow-hidden group">
      <img
        src={backdrop(movie.backdrop_path)}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute bottom-0 left-0 p-8 max-w-2xl">
        <h1 className="font-display text-4xl font-bold mb-3 leading-tight">{title}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-6">
          {movie.overview}
        </p>
        <div className="flex items-center gap-3">
          <Link
            to={`/watch/${type}/${movie.id}`}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-display font-semibold text-sm hover:brightness-110 transition"
          >
            <Play size={18} fill="currentColor" /> Play
          </Link>
          <button className="p-3 rounded-xl border border-border bg-secondary/50 text-foreground hover:bg-secondary transition">
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
