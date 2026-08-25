import { Play, Plus, Star } from "lucide-react";
import { Movie, backdrop } from "@/lib/tmdb";
import { Link } from "react-router-dom";

interface Props {
  movie: Movie | null;
}

/** Film alignment crosses in each corner of the frame. */
function RegistrationMark({ className }: { className: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 0v18M0 9h18" stroke="hsl(var(--bone))" strokeOpacity="0.45" strokeWidth="1" />
      </svg>
    </span>
  );
}

export default function HeroSection({ movie }: Props) {
  if (!movie) {
    return (
      <div className="space-y-4">
        <div className="aspect-[21/9] w-full animate-pulse border border-border bg-card" />
        <div className="h-14 w-2/3 animate-pulse bg-card" />
      </div>
    );
  }

  const title = movie.title || movie.name || "";
  const type =
    movie.media_type === "tv" || movie.first_air_date || (movie.name && !movie.title)
      ? "tv"
      : "movie";
  const year = (movie.release_date || movie.first_air_date || "").slice(0, 4);

  return (
    <section className="reveal relative">
      {/* ── The frame ── */}
      <div className="scanlines group relative aspect-[16/9] overflow-hidden border border-border sm:aspect-[21/9]">
        <img
          src={backdrop(movie.backdrop_path)}
          alt={title}
          className="absolute inset-0 h-full w-full scale-105 object-cover transition-transform ease-out [transition-duration:1600ms] group-hover:scale-100 group-focus-visible:scale-100"
        />

        {/* Grade the plate toward ink so type always reads */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-transparent to-transparent" />

        {/* Letterbox bars */}
        <div className="absolute inset-x-0 top-0 h-[7%] bg-ink" />
        <div className="absolute inset-x-0 bottom-0 h-[7%] bg-ink" />

        <RegistrationMark className="left-3 top-[9%]" />
        <RegistrationMark className="right-3 top-[9%]" />
        <RegistrationMark className="bottom-[9%] left-3" />
        <RegistrationMark className="bottom-[9%] right-3" />

        {/* Slate: top-left */}
        <div className="absolute left-5 top-[11%] flex items-center gap-2 sm:left-8">
          <span className="h-1.5 w-1.5 rounded-full bg-flare animate-flicker" />
          <span className="kicker text-bone/80">Feature Presentation</span>
        </div>

        {/* Rating chip: top-right */}
        <div className="absolute right-5 top-[11%] flex items-center gap-1.5 border border-bone/25 bg-ink/70 px-2 py-1 backdrop-blur-sm sm:right-8">
          <Star size={11} className="fill-acid text-acid" />
          <span className="font-mono text-[11px] font-bold tabular-nums text-bone">
            {movie.vote_average ? movie.vote_average.toFixed(1) : "—"}
          </span>
        </div>
      </div>

      {/* ── Title block: deliberately breaks out of the frame above ── */}
      <div className="relative z-10 -mt-10 px-1 sm:-mt-16 md:-mt-20 md:pl-6">
        <h1 className="font-display font-variation-tight max-w-5xl text-[clamp(2rem,7vw,5.5rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.05em] text-bone [text-shadow:0_4px_28px_hsl(var(--ink))]">
          {title}
        </h1>

        {/* Slate data rail */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="bg-acid px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink">
            {type === "tv" ? "Series" : "Film"}
          </span>
          {year && (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{year}</span>
          )}
          <span className="h-3 w-px bg-border" />
          <span className="kicker text-muted-foreground">Reel 01</span>
        </div>

        <div className="mt-4 hidden max-w-xl sm:block">
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {movie.overview}
          </p>
        </div>

        {/* ── Actions ── */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to={`/watch/${type}/${movie.id}`}
            className="group/play inline-flex items-center gap-2.5 border-2 border-acid bg-acid px-6 py-3 text-ink transition-all duration-200 hover:-translate-x-0.5 focus-visible:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 hover:shadow-hard-flare focus-visible:shadow-hard-flare"
          >
            <Play size={15} fill="currentColor" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
              Play Now
            </span>
          </Link>

          <button className="inline-flex items-center gap-2.5 border-2 border-border bg-transparent px-5 py-3 text-bone transition-all duration-200 hover:border-acid focus-visible:border-acid hover:text-acid focus-visible:text-acid">
            <Plus size={15} />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
              Watchlist
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
