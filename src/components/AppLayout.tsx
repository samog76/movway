import { ReactNode, useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";
import Marquee from "./Marquee";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="grain-overlay relative flex min-h-screen bg-background">
      {/* ── Ambient projector beams: the only soft thing in the whole UI ── */}
      <div aria-hidden className="ambient-beams pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet/20 blur-[140px] animate-beam-drift" />
        <div
          className="absolute -right-32 top-1/3 h-[440px] w-[440px] rounded-full bg-acid/10 blur-[150px] animate-beam-drift"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-[380px] w-[380px] rounded-full bg-flare/10 blur-[130px] animate-beam-drift"
          style={{ animationDelay: "-3.5s" }}
        />
      </div>

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main
        className={`tv-main relative z-10 flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden transition-all duration-300 ${
          collapsed ? "md:ml-[var(--rail-w-collapsed)]" : "md:ml-[var(--rail-w)]"
        }`}
      >
        <Marquee />

        {/* ── Mobile header ── */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md md:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="border border-border p-2 text-muted-foreground transition-colors hover:border-acid focus-visible:border-acid hover:text-acid focus-visible:text-acid"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <span className="font-display text-lg font-extrabold tracking-[-0.05em] text-bone">
            MOV<span className="text-acid">/</span>WAY
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-acid animate-flicker" />
            <span className="kicker text-muted-foreground">Live</span>
          </span>
        </div>

        <div className="tv-safe flex-1 px-4 py-6 md:px-10 md:py-10">{children}</div>

        {/* ── Colophon ── */}
        <footer className="tv-safe mt-10 border-t border-border px-4 py-8 md:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-display text-2xl font-extrabold tracking-[-0.05em] text-bone/90">
                MOV<span className="text-acid">/</span>WAY
              </p>
              <p className="kicker mt-1 text-muted-foreground/70">
                Reel data by TMDB · Always midnight
              </p>
            </div>
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/50">
              NO. 001 — NITRATE EDITION
              <br />
              PROJECTED AT 24 FPS
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
