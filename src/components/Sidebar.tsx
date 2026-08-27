import { useEffect, useRef, useState } from "react";
import {
  Home,
  Search,
  Film,
  Tv,
  Sparkles,
  BookOpen,
  Music,
  Radio,
  Heart,
  Clock,
  Pin,
  PinOff,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { registerBackInterceptor } from "@/lib/backHandler";
import { focusFirstInMain } from "@/lib/tv";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Search", path: "/search" },
];

const mediaItems = [
  { icon: Film, label: "Movies", path: "/browse/movie" },
  { icon: Tv, label: "Series", path: "/browse/tv" },
  { icon: Sparkles, label: "Anime", path: "/browse/anime" },
  { icon: BookOpen, label: "Manga", path: "/browse/manga" },
  { icon: Music, label: "Music", path: "/browse/music" },
  { icon: Radio, label: "Live", path: "/browse/sports" },
  { icon: Heart, label: "Watchlist", path: "/watchlist" },
  { icon: Clock, label: "History", path: "/history" },
];

const PIN_KEY = "movway:rail-pinned";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/** One nav row. Active state is a hard acid block — no soft highlights. */
function NavRow({
  item,
  index,
  active,
  onClick,
}: {
  item: { icon: typeof Home; label: string; path: string };
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 transition-all duration-200 ${
        active
          ? "bg-acid text-ink"
          : "text-muted-foreground hover:text-bone hover:bg-secondary/70 focus-visible:text-bone focus-visible:bg-secondary/70"
      }`}
    >
      {!active && (
        <span className="absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 bg-acid transition-all duration-200 group-hover:h-6 group-focus-visible:h-6" />
      )}
      <item.icon size={17} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
      <span
        className={`font-mono text-[11px] font-medium uppercase tracking-[0.16em] ${
          active ? "font-bold" : ""
        }`}
      >
        {item.label}
      </span>
      <span
        className={`ml-auto font-mono text-[9px] tabular-nums ${
          active ? "text-ink/50" : "text-muted-foreground/40"
        }`}
      >
        {String(index).padStart(2, "0")}
      </span>
    </Link>
  );
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { pathname } = useLocation();

  const asideRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pinned, setPinned] = useState(false);

  /**
   * Tracked on the document rather than with React's onFocus: the D-pad walker
   * in lib/tv.ts moves focus programmatically, and a listener here catches
   * every route in and out of the rail with one subscription.
   */
  /** Where the remote was in the page before it stepped into the rail. */
  const lastPageFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => {
      const el = asideRef.current;
      const active = document.activeElement as HTMLElement | null;
      const inside = !!el && !!active && el.contains(active);
      if (!inside && active && active !== document.body) lastPageFocus.current = active;
      setFocusWithin(inside);
    };
    document.addEventListener("focusin", sync);
    return () => document.removeEventListener("focusin", sync);
  }, []);

  /**
   * Back closes the menu before it means anything else, the way a TV app's menu
   * behaves — you step in with left, and step out with back or right, without
   * leaving the screen you were on. A pinned rail is part of the furniture
   * rather than something you opened, so it does not claim the press.
   */
  useEffect(() => {
    if (!focusWithin || pinned) return;
    return registerBackInterceptor(() => {
      const back = lastPageFocus.current;
      if (back && document.contains(back)) {
        back.focus();
      } else {
        // Must land on something focusable, or the rail hides with the remote
        // still nominally inside it and nothing highlighted anywhere.
        focusFirstInMain();
      }
      setFocusWithin(false);
      return true;
    });
  }, [focusWithin, pinned]);

  useEffect(() => {
    setPinned(localStorage.getItem(PIN_KEY) === "1");
  }, []);

  const togglePin = () => {
    setPinned((prev) => {
      localStorage.setItem(PIN_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  /**
   * The rail parks off-screen and slides back in on approach. Focus counts as
   * approach as much as the pointer does — that is what lets a remote reach it,
   * since the D-pad moves focus into the rail while it is still out of sight.
   */
  const revealed = pinned || hovered || focusWithin;

  return (
    <>
      {/* Pointer target: a forgiving strip along the screen edge. */}
      <div
        aria-hidden
        onMouseEnter={() => setHovered(true)}
        className="fixed left-0 top-0 z-30 hidden h-screen w-5 md:block"
      />

      <aside
        ref={asideRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-focus-zone="rail"
        className={`tv-rail fixed left-0 top-0 z-40 flex h-screen w-[var(--rail-w)] flex-col border-r border-border bg-[hsl(var(--sidebar-background))] transition-transform duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          revealed
            ? "md:translate-x-0 md:shadow-[8px_0_40px_hsl(var(--ink)/0.6)]"
            : "md:-translate-x-[calc(100%-var(--rail-peek))]"
        }`}
      >
        {/* ── Masthead ── */}
        <div className="relative border-b border-border px-4 py-5">
          <div className="flex items-start justify-between gap-2">
            <Link to="/" onClick={onMobileClose} className="block leading-none">
              <span className="font-display text-[26px] font-extrabold tracking-[-0.05em] text-bone font-variation-tight">
                MOV
                <span className="text-acid">/</span>
                WAY
              </span>
              <span className="mt-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-acid animate-flicker" />
                <span className="kicker rail-kicker truncate text-muted-foreground">
                  v{__APP_VERSION__}
                </span>
                {/* Populated by lib/tv.ts with the last key the remote sent.
                    Blank means the WebView never delivered one. */}
                <span id="tv-key-readout" className="kicker truncate text-acid/70" aria-hidden />
              </span>
            </Link>

            <button
              onClick={togglePin}
              className="hidden shrink-0 border border-border p-1 text-muted-foreground transition-colors hover:border-acid focus-visible:border-acid hover:text-acid focus-visible:text-acid md:block"
              aria-label={pinned ? "Unpin sidebar" : "Keep sidebar open"}
              title={pinned ? "Unpin sidebar" : "Keep sidebar open"}
            >
              {pinned ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide py-4">
          <div className="space-y-px px-2">
            {navItems.map((item, i) => (
              <NavRow
                key={item.path}
                item={item}
                index={i + 1}
                active={pathname === item.path}
                onClick={onMobileClose}
              />
            ))}
          </div>

          <div className="my-4 flex items-center gap-2 px-5">
            <span className="h-px flex-1 bg-border" />
            <span className="kicker text-muted-foreground/60">Reels</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-px px-2">
            {mediaItems.map((item, i) => (
              <NavRow
                key={item.path}
                item={item}
                index={i + 3}
                active={pathname === item.path}
                onClick={onMobileClose}
              />
            ))}
          </div>
        </nav>

        {/* ── Footer: projector status ── */}
        <div className="rail-footer border-t border-border p-3">
          <div className="border border-border bg-ink/60 p-3">
            <span className="kicker text-acid">Projector</span>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
              REEL 35MM · ONLINE
              <br />
              <span className="text-bone/70">24 FPS · NITRATE</span>
            </p>
          </div>
        </div>

        {/* The sliver left on screen when the rail is parked: a film edge that
            doubles as the "there is a menu here" cue. */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[var(--rail-peek)] bg-gradient-to-b from-acid/70 via-acid/25 to-transparent" />
        <div className="film-perf pointer-events-none absolute right-0 top-0 h-full w-[6px]" />
      </aside>
    </>
  );
}
