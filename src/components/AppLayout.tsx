import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { seedFocusSoon } from "@/lib/tv";
import TopNav from "./TopNav";

/**
 * `bleed` hands the page the full width and the space under the navigation,
 * for screens that open on artwork running edge to edge. Other pages get the
 * standard inset and start below the navigation.
 */
export default function AppLayout({ children, bleed = false }: { children: ReactNode; bleed?: boolean }) {
  const { pathname } = useLocation();

  // Never leave a TV screen with nothing focused.
  useEffect(() => {
    seedFocusSoon();
  }, [pathname]);

  return (
    <div className="relative min-h-screen bg-background">
      <TopNav />

      <main
        data-focus-zone="main"
        className="tv-main relative flex min-h-screen min-w-0 flex-col overflow-x-hidden"
      >
        <div className="flex-1">
          {bleed ? (
            children
          ) : (
            <div className="tv-safe px-4 pb-10 pt-[var(--nav-h)] md:px-12 lg:px-16">{children}</div>
          )}
        </div>

        <footer className="tv-safe px-4 pb-28 pt-12 md:px-12 md:pb-10 lg:px-16">
          <div className="flex flex-col gap-2 border-t border-white/5 pt-6 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="font-bold text-white/70">movway</span> · v{__APP_VERSION__}
            </p>
            <p>Metadata and artwork from TMDB.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
