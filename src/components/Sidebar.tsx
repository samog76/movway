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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

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

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/** One nav row. Active state is a hard acid block — no soft highlights. */
function NavRow({
  item,
  index,
  active,
  collapsed,
  onClick,
}: {
  item: { icon: typeof Home; label: string; path: string };
  index: number;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={item.path}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-3 px-3 py-2.5 transition-all duration-200 ${
        active
          ? "bg-acid text-ink"
          : "text-muted-foreground hover:text-bone hover:bg-secondary/70 focus-visible:text-bone focus-visible:bg-secondary/70"
      }`}
    >
      {/* left edge tick on hover for inactive rows */}
      {!active && (
        <span className="absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 bg-acid transition-all duration-200 group-hover:h-6 group-focus-visible:h-6" />
      )}
      <item.icon size={17} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
      {!collapsed && (
        <>
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
        </>
      )}
    </Link>
  );
}

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className={`tv-rail fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-[hsl(var(--sidebar-background))] transition-all duration-300 ${
        collapsed ? "w-[var(--rail-w-collapsed)]" : "w-[var(--rail-w)]"
      } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      {/* ── Masthead ── */}
      <div className="relative border-b border-border px-4 py-5">
        <div className="flex items-start justify-between gap-2">
          {!collapsed ? (
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
                <span
                  id="tv-key-readout"
                  className="kicker truncate text-acid/70"
                  aria-hidden
                />
              </span>
            </Link>
          ) : (
            <Link
              to="/"
              onClick={onMobileClose}
              className="font-display text-2xl font-extrabold leading-none text-acid"
            >
              M<span className="text-bone">/</span>
            </Link>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden shrink-0 border border-border p-1 text-muted-foreground transition-colors hover:border-acid focus-visible:border-acid hover:text-acid focus-visible:text-acid md:block"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
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
              collapsed={collapsed}
              onClick={onMobileClose}
            />
          ))}
        </div>

        <div className="my-4 flex items-center gap-2 px-5">
          <span className="h-px flex-1 bg-border" />
          {!collapsed && <span className="kicker text-muted-foreground/60">Reels</span>}
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-px px-2">
          {mediaItems.map((item, i) => (
            <NavRow
              key={item.path}
              item={item}
              index={i + 3}
              active={pathname === item.path}
              collapsed={collapsed}
              onClick={onMobileClose}
            />
          ))}
        </div>
      </nav>

      {/* ── Footer: projector status ── */}
      <div className="rail-footer border-t border-border p-3">
        {!collapsed ? (
          <div className="border border-border bg-ink/60 p-3">
            <span className="kicker text-acid">Projector</span>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
              REEL 35MM · ONLINE
              <br />
              <span className="text-bone/70">24 FPS · NITRATE</span>
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-acid animate-flicker" />
          </div>
        )}
      </div>

      {/* Perforated film edge along the rail */}
      <div className="film-perf pointer-events-none absolute right-0 top-0 h-full w-[6px]" />
    </aside>
  );
}
