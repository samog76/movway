import { ArrowLeft, ArrowRight, Play, Star, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Movie, img } from "@/lib/tmdb";
import { Link } from "react-router-dom";

interface Props {
  title: string;
  items: Movie[];
  /** Section number shown in the header rule, e.g. 1 → "01". */
  index?: number;
  showDelete?: boolean;
  onDelete?: (item: Movie) => void;
}

export function PosterCard({
  item,
  rank,
  showDelete,
  onDelete,
}: {
  item: Movie;
  rank?: number;
  showDelete?: boolean;
  onDelete?: (item: Movie) => void;
}) {
  const type =
    item.media_type === "tv" || item.first_air_date || (item.name && !item.title) ? "tv" : "movie";
  const label = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  return (
    <Link
      to={`/watch/${type}/${item.id}`}
      /* The lift lives on the link itself so the D-pad focus ring travels with
         it — on a TV a ring that detaches from the art reads as a glitch. */
      className="group/card block transition-transform duration-300 hover:-translate-x-1 hover:-translate-y-1 focus-visible:-translate-x-1 focus-visible:-translate-y-1"
    >
      <div className="relative aspect-[2/3] overflow-hidden border border-border bg-card transition-all duration-300 group-hover/card:border-acid group-hover/card:shadow-hard group-focus-visible/card:border-acid group-focus-visible/card:shadow-hard">
        <img
          src={img(item.poster_path, "w342")}
          alt={label}
          className="h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-[1.06] group-focus-visible/card:scale-[1.06]"
          loading="lazy"
        />

        {/* Rating */}
        <div className="absolute left-0 top-0 flex items-center gap-1 bg-ink/85 px-1.5 py-1 backdrop-blur-sm">
          <Star size={9} className="fill-acid text-acid" />
          <span className="font-mono text-[10px] font-bold tabular-nums text-bone">
            {item.vote_average ? item.vote_average.toFixed(1) : "—"}
          </span>
        </div>

        {showDelete && (
          <button
            className="absolute right-0 top-0 bg-flare p-1.5 text-bone opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-focus-visible/card:opacity-100"
            aria-label={`Remove ${label}`}
            onClick={(e) => {
              e.preventDefault();
              onDelete?.(item);
            }}
          >
            <Trash2 size={12} />
          </button>
        )}

        {/* Rank numeral, bottom-left, outlined so the art reads through */}
        {rank != null && (
          <span
            aria-hidden
            className="text-stroke pointer-events-none absolute -bottom-2 left-1 font-display text-[52px] font-extrabold leading-none tabular-nums opacity-70 transition-opacity duration-300 group-hover/card:opacity-0 group-focus-visible/card:opacity-0"
          >
            {String(rank).padStart(2, "0")}
          </span>
        )}

        {/* Hover panel */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-ink via-ink/95 to-transparent px-2.5 pb-2.5 pt-6 transition-transform duration-300 group-hover/card:translate-y-0 group-focus-visible/card:translate-y-0">
          <span className="inline-flex items-center gap-1.5 bg-acid px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink">
            <Play size={9} fill="currentColor" /> Play
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <p className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-[0.08em] text-bone/85 transition-colors group-hover/card:text-acid group-focus-visible/card:text-acid">
          {label}
        </p>
        {year && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60">
            {year}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function ContentRow({ title, items, index, showDelete, onDelete }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  };

  return (
    <section className="reveal space-y-4">
      {/* ── Header: number, title, rule, controls ── */}
      <div className="flex items-center gap-3 sm:gap-4">
        {index != null && (
          <span className="font-mono text-[11px] font-bold tabular-nums text-acid">
            {String(index).padStart(2, "0")}
          </span>
        )}
        <h2 className="font-display text-lg font-extrabold uppercase tracking-[-0.02em] text-bone sm:text-xl">
          {title}
        </h2>
        <span className="h-px flex-1 bg-border" />
        <div className="flex shrink-0 gap-px">
          <button
            onClick={() => scroll(-1)}
            className="border border-border p-2 text-muted-foreground transition-colors hover:border-acid hover:bg-acid hover:text-ink focus-visible:border-acid focus-visible:bg-acid focus-visible:text-ink"
            aria-label="Scroll left"
          >
            <ArrowLeft size={14} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="border border-border p-2 text-muted-foreground transition-colors hover:border-acid hover:bg-acid hover:text-ink focus-visible:border-acid focus-visible:bg-acid focus-visible:text-ink"
            aria-label="Scroll right"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 pt-1 touch-pan-x md:gap-4"
      >
        {items.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="w-[132px] shrink-0 snap-start md:w-[176px]"
          >
            <PosterCard
              item={item}
              rank={i + 1}
              showDelete={showDelete}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
