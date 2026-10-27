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
      className={`group/ep flex w-full items-center gap-4 rounded-xl p-2.5 text-left transition-colors ${
        active ? "bg-white/12 ring-1 ring-white/25" : "hover:bg-white/5 focus-visible:bg-white/5"
      }`}
    >
      {/* Episode number */}
      <span
        className={`w-8 shrink-0 text-center text-lg font-semibold tabular-nums ${
          active ? "text-white" : "text-white/40"
        }`}
      >
        {ep.episode_number}
      </span>

      {/* Still */}
      <span className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-card sm:block">
        {ep.still_path ? (
          <img
            src={img(ep.still_path, "w300")}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        {active && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Play size={18} className="fill-white text-white" />
          </span>
        )}
      </span>

      {/* Title + meta */}
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15px] font-semibold ${
            active ? "text-white" : "text-white/85"
          }`}
        >
          {ep.name || `Episode ${ep.episode_number}`}
        </span>
        <span className="mt-1 flex items-center gap-2 text-[13px] text-white/50">
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

  const navBtn = "btn-glass h-10 px-4 text-sm font-medium disabled:pointer-events-none disabled:opacity-35";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-white">Episodes</h2>
        <div className="ml-auto flex shrink-0 gap-2">
          <button type="button" onClick={goPrev} disabled={atStart} className={navBtn}>
            <ChevronLeft size={16} /> Prev
          </button>
          <button type="button" onClick={goNext} disabled={atEnd} className={navBtn}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Now playing line — replaces guessing from a bare number box */}
      <p className="text-sm text-white/55">
        <span className="font-semibold text-white">
          S{season} · E{episode}
        </span>
        {current?.name ? ` · ${current.name}` : ""}
        {count ? ` · ${count} episodes this season` : ""}
      </p>

      {/* Season rail */}
      {showSeasons && seasons.length > 1 && (
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {seasons.map((s) => {
            const active = s.season_number === season;
            return (
              <button
                key={s.id ?? s.season_number}
                type="button"
                onClick={() => onSelect(s.season_number, 1)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-black"
                    : "glass text-white/65 hover:text-white focus-visible:text-white"
                }`}
              >
                {s.season_number === 0 ? "Specials" : `Season ${s.season_number}`}
                <span className={active ? "text-black/50" : "text-white/40"}>
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
        <div className="rounded-xl border border-flare/40 bg-flare/10 px-4 py-3">
          <span className="text-sm font-semibold text-red-300">Couldn't load episodes</span>
          <p className="mt-1 text-[13px] text-white/60">
            Could not load this season's episodes. Use Prev/Next to move through them.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : episodes.length > 0 ? (
        <div className="scrollbar-hide -mx-1 max-h-[440px] space-y-1 overflow-y-auto p-1">
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
        <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/50">
          No episode data for this season.
        </p>
      )}
    </section>
  );
}
