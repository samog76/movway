import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Bookmark, Clapperboard, Home, Search, Settings, Sparkles, Tv } from "lucide-react";
import { registerBackInterceptor } from "@/lib/backHandler";
import { focusFirstInMain } from "@/lib/tv";

const SECTIONS = [
  { label: "Home", path: "/", icon: Home },
  { label: "Movies", path: "/browse/movie", icon: Clapperboard },
  { label: "Series", path: "/browse/tv", icon: Tv },
  { label: "Anime", path: "/browse/anime", icon: Sparkles },
  { label: "My List", path: "/list", icon: Bookmark },
];

const TOOLS = [
  { label: "Search", path: "/search", icon: Search },
  { label: "Settings", path: "/settings", icon: Settings },
];

/** A title being watched lights up the section it belongs to. */
const sectionOf = (pathname: string) => pathname.replace(/^\/watch\/(movie|tv|anime)\/.*/, "/browse/$1");

const isActive = (pathname: string, path: string) =>
  path === "/" ? pathname === "/" : sectionOf(pathname).startsWith(path);

/** Wordmark. Plain type, so it scales with the UI on any panel. */
function Wordmark() {
  return (
    <span className="text-[1.6rem] font-black leading-none tracking-[-0.06em] text-white drop-shadow-md">
      movway<span className="text-acid">.</span>
    </span>
  );
}

/**
 * Floating navigation: wordmark on the left, a frosted pill of destinations on
 * the right. On phones the destinations move to a tab bar along the bottom,
 * within reach of a thumb.
 *
 * On a TV the header is its own focus zone pinned to the top edge — the remote
 * steps into it with Up from the first row of a page, and out with Down or
 * Back, never by drifting sideways from the content.
 */
export default function TopNav() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  const lastPageFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sync = () => {
      const el = headerRef.current;
      const active = document.activeElement as HTMLElement | null;
      const inside = !!el && !!active && el.contains(active);
      if (!inside && active && active !== document.body) lastPageFocus.current = active;
      // The bar is only ever entered from the top of a page, so show the
      // page's top with it rather than leaving the bar over the hero's text.
      if (inside && window.scrollY > 0) window.scrollTo({ top: 0, behavior: "smooth" });
      setFocusWithin(inside);
    };
    document.addEventListener("focusin", sync);
    return () => document.removeEventListener("focusin", sync);
  }, []);

  /** Back steps out of the bar to where the remote was, before it means anything else. */
  useEffect(() => {
    if (!focusWithin) return;
    return registerBackInterceptor(() => {
      const back = lastPageFocus.current;
      if (back && document.contains(back)) {
        back.focus();
        if (document.activeElement === back) return true;
      }
      return focusFirstInMain();
    });
  }, [focusWithin]);

  const showBack = pathname !== "/";

  return (
    <>
      <header
        ref={headerRef}
        data-focus-zone="nav"
        data-focus-edge="top"
        className={`tv-safe pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 px-4 pb-12 pt-4 transition-colors duration-300 md:px-12 md:pb-0 md:pt-6 ${
          // On a phone the wordmark has no pill behind it; once content
          // scrolls under it, fade the ground in so it stays legible.
          scrolled ? "bg-gradient-to-b from-background from-40% via-background/75 to-transparent md:bg-none" : ""
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-3">
          {showBack && (
            <Link
              to="/"
              aria-label="Back to home"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 focus-visible:bg-white/10"
            >
              <ArrowLeft size={24} />
            </Link>
          )}
          <Link to="/" aria-label="Movway home" className="rounded-md px-1">
            <Wordmark />
          </Link>
          {/* Populated by lib/tv.ts with the last key the remote sent.
              Blank means the WebView never delivered one. */}
          <span id="tv-key-readout" className="text-[10px] text-white/40" aria-hidden />
        </div>

        <nav
          aria-label="Main"
          className={`glass pointer-events-auto hidden items-center gap-1 rounded-full p-1.5 transition-colors duration-300 md:flex ${
            scrolled ? "!bg-[rgb(14_14_16/0.72)]" : ""
          }`}
        >
          {SECTIONS.map(({ label, path, icon: Icon }) => {
            const active = isActive(pathname, path);
            return (
              <Link
                key={path}
                to={path}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium transition-colors duration-200 ${
                  active
                    ? "bg-white text-black shadow-md"
                    : "text-white/60 hover:text-white focus-visible:text-white"
                }`}
              >
                {active && <Icon size={16} strokeWidth={2.2} />}
                {label}
              </Link>
            );
          })}
          <span aria-hidden className="mx-2 h-5 w-px bg-white/15" />
          {TOOLS.map(({ label, path, icon: Icon }) => {
            const active = isActive(pathname, path);
            return (
              <Link
                key={path}
                to={path}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
                  active ? "bg-white text-black" : "text-white/60 hover:text-white focus-visible:text-white"
                }`}
              >
                <Icon size={19} />
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ── Phone tab bar ── */}
      <nav
        aria-label="Main"
        className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-full px-2 py-1.5 md:hidden"
      >
        {[SECTIONS[0], SECTIONS[1], SECTIONS[2], SECTIONS[4], ...TOOLS].map(({ label, path, icon: Icon }) => {
          const active = isActive(pathname, path);
          return (
            <Link
              key={path}
              to={path}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                active ? "bg-white/15 text-white" : "text-white/60"
              }`}
            >
              <Icon size={21} />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
