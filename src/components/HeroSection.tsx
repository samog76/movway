import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Play, Star, Tag } from "lucide-react";
import { Movie, backdrop, genreName, getLogo, img, mediaTypeOf } from "@/lib/tmdb";
import MyListButton from "./MyListButton";

const ROTATE_MS = 9000;

/** The film's own title art when TMDB has it; set type when it does not. */
export function TitleArt({
  logoPath,
  title,
  className = "",
}: {
  logoPath: string | null | undefined;
  title: string;
  className?: string;
}) {
  if (logoPath) {
    return (
      <img
        src={img(logoPath, "w500")}
        alt={title}
        className={`hero-logo max-h-[9.5rem] w-auto max-w-[min(34rem,82vw)] object-contain drop-shadow-[0_4px_24px_rgb(0_0_0/0.55)] ${className}`}
      />
    );
  }
  return (
    <h1
      className={`max-w-[44rem] text-[clamp(2.5rem,6.5vw,5.5rem)] font-black uppercase leading-[0.9] tracking-[-0.04em] text-white drop-shadow-[0_4px_24px_rgb(0_0_0/0.55)] ${className}`}
    >
      {title}
    </h1>
  );
}

export function HeroSkeleton() {
  return <div className="h-[92svh] max-h-[1000px] min-h-[560px] w-full animate-pulse bg-card md:h-[100svh]" />;
}

/**
 * Full-bleed rotating feature. Rotation stops while the pointer or the remote
 * is inside it: the Play button must not quietly start pointing at a
 * different title while someone is about to press it.
 */
export default function HeroSection({ items }: { items: Movie[] }) {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const count = items.length;
  const movie = items[Math.min(index, count - 1)];

  useEffect(() => {
    if (held || count < 2) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearTimeout(t);
  }, [index, held, count]);

  const type = movie ? mediaTypeOf(movie) : "movie";
  const { data: logoPath } = useQuery({
    queryKey: ["logo", type, movie?.id],
    queryFn: () => getLogo(type, movie!.id),
    enabled: !!movie,
    staleTime: Infinity,
  });

  if (!movie) return <HeroSkeleton />;

  const title = movie.title || movie.name || "";
  const year = (movie.release_date || movie.first_air_date || "").slice(0, 4);
  const genre = movie.genre_ids?.map(genreName).find(Boolean);

  return (
    <section
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!sectionRef.current?.contains(e.relatedTarget as Node)) setHeld(false);
      }}
      className="relative h-[92svh] max-h-[1000px] min-h-[560px] w-full overflow-hidden md:h-[100svh]"
    >
      <img
        key={movie.id}
        src={backdrop(movie.backdrop_path)}
        alt=""
        className="absolute inset-0 h-full w-full animate-hero-fade object-cover object-[center_25%]"
      />
      {/* Grade toward the ground so type always reads, and the rows below
          rise out of the picture rather than butting against it. */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/0" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-background/80 via-background/25 to-transparent md:block" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />

      <div className="hero-body tv-safe absolute inset-x-0 bottom-[13%] flex md:bottom-[21%] flex-col items-center px-6 text-center md:items-start md:px-16 md:text-left">
        <div key={movie.id} className="flex animate-hero-fade flex-col items-center md:items-start">
          <TitleArt logoPath={logoPath} title={title} className="object-center md:object-left" />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[15px] font-medium text-white md:text-[17px]">
            {movie.vote_average ? (
              <span className="flex items-center gap-1.5">
                <Star size={17} className="fill-white" />
                {movie.vote_average.toFixed(1)}/10
              </span>
            ) : null}
            {year && (
              <>
                <span aria-hidden className="text-white/50">·</span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={17} />
                  {year}
                </span>
              </>
            )}
            {genre && (
              <>
                <span aria-hidden className="text-white/50">·</span>
                <span className="flex items-center gap-1.5">
                  <Tag size={16} />
                  {genre}
                </span>
              </>
            )}
          </div>

          <p className="hero-overview mt-5 line-clamp-2 max-w-[36rem] text-[15px] leading-relaxed text-white/95 drop-shadow md:line-clamp-4 md:text-[17px] md:leading-7">
            {movie.overview}
          </p>
        </div>

        <div className="mt-7 flex w-full items-center justify-center gap-3 md:justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/watch/${type}/${movie.id}`} data-tv-autofocus className="btn-play">
              <Play size={20} fill="currentColor" />
              Play
            </Link>
            <MyListButton item={{ ...movie, media_type: type }} />
          </div>

          {count > 1 && (
            <div className="hidden items-center gap-2 md:flex" role="tablist" aria-label="Featured titles">
              {items.map((m, i) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show ${m.title || m.name}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === index ? "w-8 bg-white" : "w-2 bg-white/45 hover:bg-white/80 focus-visible:bg-white/80"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
