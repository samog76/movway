import { ArrowRight, ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Movie, img, mediaTypeOf } from "@/lib/tmdb";

interface Props {
  title: string;
  items: Movie[];
  /** Where "View All" leads; omitted when the row is the whole list. */
  viewAll?: string;
  showDelete?: boolean;
  onDelete?: (item: Movie) => void;
  /** Small label over the art, e.g. the episode a series was left on. */
  badgeFor?: (item: Movie) => string | undefined;
}

export function PosterCard({
  item,
  showDelete,
  onDelete,
  badge,
}: {
  item: Movie;
  showDelete?: boolean;
  onDelete?: (item: Movie) => void;
  badge?: string;
}) {
  const type = mediaTypeOf(item);
  const label = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  return (
    <Link
      to={`/watch/${type}/${item.id}`}
      aria-label={label}
      /* The lift lives on the link itself so the D-pad focus ring travels with
         it — on a TV a ring that detaches from the art reads as a glitch. */
      className="group/card relative block aspect-[2/3] overflow-hidden rounded-lg bg-card shadow-lg shadow-black/30 transition-transform duration-300 hover:scale-[1.04] focus-visible:scale-[1.04]"
    >
      {item.poster_path ? (
        <img
          src={img(item.poster_path, "w342")}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full items-end p-3">
          <p className="line-clamp-3 text-sm font-bold text-white/90">{label}</p>
        </div>
      )}

      {badge && (
        <span className="glass absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}

      {/* Title on approach. The art usually carries it already. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-12 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 group-focus-visible/card:opacity-100">
        <h3 className="line-clamp-2 text-sm font-bold leading-tight text-white drop-shadow-md">{label}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white/75">
          {item.vote_average ? (
            <>
              <Star size={11} className="fill-acid text-acid" />
              {item.vote_average.toFixed(1)}
            </>
          ) : null}
          {year && <span>{item.vote_average ? "· " : ""}{year}</span>}
        </p>
      </div>

      {showDelete && (
        <button
          className="glass absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-white opacity-0 transition-opacity duration-200 hover:bg-flare focus-visible:bg-flare group-hover/card:opacity-100 group-focus-visible/card:opacity-100"
          aria-label={`Remove ${label}`}
          onClick={(e) => {
            e.preventDefault();
            onDelete?.(item);
          }}
        >
          <X size={15} />
        </button>
      )}
    </Link>
  );
}

/** Edge padding shared by every full-bleed row on the home screen. */
export const ROW_INSET = "px-4 md:px-12 lg:px-16";

export function RowSkeleton() {
  return (
    <div className={`tv-safe space-y-4 ${ROW_INSET}`}>
      <div className="h-6 w-48 animate-pulse rounded-md bg-card" />
      <div className="flex gap-3 overflow-hidden md:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] w-[8.5rem] shrink-0 animate-pulse rounded-lg bg-card md:w-[12.5rem]" />
        ))}
      </div>
    </div>
  );
}

export default function ContentRow({ title, items, viewAll, showDelete, onDelete, badgeFor }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="group/row relative space-y-4">
      <div className={`tv-safe flex items-center gap-4 ${ROW_INSET}`}>
        <h2 className="text-xl font-semibold text-white/90 drop-shadow-md">{title}</h2>
        {viewAll && (
          <Link
            to={viewAll}
            className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-white/60 transition-colors hover:text-white focus-visible:text-white"
          >
            View All <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className={`tv-safe scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 pt-1 touch-pan-x md:gap-4 md:scroll-px-12 lg:scroll-px-16 ${ROW_INSET}`}
        >
          {items.map((item, i) => (
            <div key={`${item.id}-${i}`} className="w-[8.5rem] shrink-0 snap-start md:w-[12.5rem]">
              <PosterCard
                item={item}
                showDelete={showDelete}
                onDelete={onDelete}
                badge={badgeFor?.(item)}
              />
            </div>
          ))}
        </div>

        {/* Pointer affordance only. On a TV these would steal the D-pad
            presses aimed at the posters, so tv styles hide them and moving
            focus scrolls the row instead. */}
        <div className="row-nav pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-2 opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 md:flex">
          <button
            onClick={() => scroll(-1)}
            tabIndex={-1}
            className="btn-glass pointer-events-auto mb-4 h-11 w-11 min-w-0 px-0"
            aria-label={`Scroll ${title} left`}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => scroll(1)}
            tabIndex={-1}
            className="btn-glass pointer-events-auto mb-4 h-11 w-11 min-w-0 px-0"
            aria-label={`Scroll ${title} right`}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      </div>
    </section>
  );
}
