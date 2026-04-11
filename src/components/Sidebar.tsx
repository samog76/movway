import { Home, Search, Film, Tv, Sparkles, BookOpen, Music, Radio, Heart, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Search", path: "/search" },
];

const mediaItems = [
  { icon: Film, label: "Movies", path: "/browse/movie" },
  { icon: Tv, label: "TV Shows", path: "/browse/tv" },
  { icon: Sparkles, label: "Anime", path: "/browse/anime" },
  { icon: BookOpen, label: "Manga", path: "/browse/manga" },
  { icon: Music, label: "Music", path: "/browse/music" },
  { icon: Radio, label: "Live Sports", path: "/browse/sports" },
  { icon: Heart, label: "Watchlist", path: "/watchlist" },
  { icon: Clock, label: "History", path: "/history" },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen z-40 flex flex-col border-r border-border transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-[240px]"
      } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      style={{ background: "hsl(var(--sidebar-bg))" }}
    >
      <div className="flex items-center justify-between px-5 py-6">
        {!collapsed && (
          <Link
            to="/"
            onClick={onMobileClose}
            className="font-display text-2xl font-bold tracking-tight text-foreground"
          >
            Mov<span className="text-primary">way</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onMobileClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {!collapsed && (
          <p className="px-3 pt-5 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Media
          </p>
        )}
        {collapsed && <div className="my-3 border-t border-border" />}

        {mediaItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onMobileClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
