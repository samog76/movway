import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { getTVSeason, img, type Episode, type SeasonSummary } from "@/lib/tmdb";

interface Props {
  tmdbId: number;
  /** Season summaries from the series details, already including specials. */
  seasons: SeasonSummary[];
  season: number;
  episode: number;
  /** Anime is addressed by absolute episode number, so it hides the season rail. */
  showSeasons?: boolean;
  onSelect: (season: number, episode: number) => void;
}

function EpisodeRow({
  ep,
  active,
  onSelect,
}: {
  ep: Episode;
  active: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const unaired = ep.air_date ? new Date(ep.air_date) > new Date() : false;

  // Keep whatever is playing visible when the list first renders.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={`group/ep flex w-full items-center gap-3 border p-2 text-left transition-colors ${
        active
          ? "border-acid bg-acid/10"
          : "border-border bg-card hover:border-acid/60 focus-visible:border-acid/60"
      }`}
    >
      {/* Episode number */}
      <span
        className={`w-9 shrink-0 text-center font-mono text-sm font-bold tabular-nums ${
          active ? "text-acid" : "text-muted-foreground"
        }`}
      >
        {String(ep.episode_number).padStart(2, "0")}
      </span>

      {/* Still */}
      <span className="relative hidden aspect-video w-24 shrink-0 overflow-hidden bg-secondary sm:block">
        {ep.still_path ? (
          <img
            src={img(ep.still_path, "w300")}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        {active && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/60">
            <Play size={13} className="fill-acid text-acid" />
          </span>
        )}
      </span>

      {/* Title + meta */}
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[13px] font-semibold ${
            active ? "text-acid" : "text-bone"
          }`}
        >
          {ep.name || `Episode ${ep.episode_number}`}
        </span>
        <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {ep.runtime ? <span>{ep.runtime} min</span> : null}
          {ep.air_date ? <span>{ep.air_date.slice(0, 4)}</span> : null}
          {unaired && <span className="text-flare">Unaired</span>}
        </span>
      </span>
    </button>
  );
}

export default function EpisodePicker({
  tmdbId,
  seasons,
  season,
  episode,
  showSeasons = true,
  onSelect,
}: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["season", tmdbId, season],
    queryFn: () => getTVSeason(tmdbId, season),
    enabled: Number.isFinite(tmdbId),
  });

  const episodes = data?.episodes ?? [];
  const current = episodes.find((e) => e.episode_number === episode);

  // Prev/next roll across season boundaries using the season summaries.
  const idx = seasons.findIndex((s) => s.season_number === season);
  const prevSeason = idx > 0 ? seasons[idx - 1] : undefined;
  const nextSeason = idx >= 0 && idx < seasons.length - 1 ? seasons[idx + 1] : undefined;
  const count = episodes.length || seasons[idx]?.episode_count || 0;

  const goPrev = () => {
    if (episode > 1) return onSelect(season, episode - 1);
    if (prevSeason) onSelect(prevSeason.season_number, prevSeason.episode_count || 1);
  };
  const goNext = () => {
    if (count && episode < count) return onSelect(season, episode + 1);
    if (nextSeason) onSelect(nextSeason.season_number, 1);
  };

  const atStart = episode <= 1 && !prevSeason;
  const atEnd = !!count && episode >= count && !nextSeason;

  const navBtn =
    "flex items-center gap-1.5 border border-border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-acid hover:bg-acid hover:text-ink focus-visible:border-acid focus-visible:bg-acid focus-visible:text-ink disabled:opacity-35 disabled:pointer-events-none";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] font-bold text-acid">EP</span>
        <h2 className="font-display text-lg font-extrabold uppercase tracking-[-0.02em] text-bone">
          Episodes
        </h2>
        <span className="h-px flex-1 bg-border" />
        <div className="flex shrink-0 gap-px">
          <button type="button" onClick={goPrev} disabled={atStart} className={navBtn}>
            <ChevronLeft size={13} /> Prev
          </button>
          <button type="button" onClick={goNext} disabled={atEnd} className={navBtn}>
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Now playing line — replaces guessing from a bare number box */}
      <p className="font-mono text-[11px] text-muted-foreground">
        <span className="text-acid">
          S{String(season).padStart(2, "0")}E{String(episode).padStart(2, "0")}
        </span>
        {current?.name ? ` · ${current.name}` : ""}
        {count ? ` · ${count} episodes this season` : ""}
      </p>

      {/* Season rail */}
      {showSeasons && seasons.length > 1 && (
        <div className="scrollbar-hide flex gap-px overflow-x-auto pb-1">
          {seasons.map((s) => {
            const active = s.season_number === season;
            return (
              <button
                key={s.id ?? s.season_number}
                type="button"
                onClick={() => onSelect(s.season_number, 1)}
                className={`shrink-0 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                  active
                    ? "border-acid bg-acid text-ink"
                    : "border-border text-muted-foreground hover:border-acid hover:text-acid focus-visible:border-acid focus-visible:text-acid"
                }`}
              >
                {s.season_number === 0 ? "Specials" : `S${s.season_number}`}
                <span className={active ? "text-ink/60" : "text-muted-foreground/50"}>
                  {" "}
                  {s.episode_count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Episode list */}
      {isError ? (
        <div className="border border-flare/40 bg-flare/5 px-4 py-3">
          <span className="kicker text-flare">Reel Jammed</span>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            Could not load this season's episodes. Use Prev/Next to move through them.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-px">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse border border-border bg-card" />
          ))}
        </div>
      ) : episodes.length > 0 ? (
        <div className="scrollbar-hide max-h-[380px] space-y-px overflow-y-auto">
          {episodes.map((ep) => (
            <EpisodeRow
              key={ep.id}
              ep={ep}
              active={ep.episode_number === episode}
              onSelect={() => onSelect(season, ep.episode_number)}
            />
          ))}
        </div>
      ) : (
        <p className="border border-dashed border-border px-4 py-6 text-center font-mono text-[11px] text-muted-foreground">
          No episode data for this season.
        </p>
      )}
    </section>
  );
}
