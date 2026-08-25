import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="grain-overlay relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      {/* projector beam */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet/20 blur-[140px]"
      />

      <div className="scanlines relative w-full max-w-xl border border-border bg-card/60 p-8 text-center backdrop-blur-sm sm:p-12">
        <div className="flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-flare animate-flicker" />
          <span className="kicker text-flare">Reel Missing</span>
        </div>

        <p className="font-display font-variation-tight mt-6 text-[clamp(4.5rem,18vw,9rem)] font-extrabold leading-[0.8] tracking-[-0.06em] text-stroke-acid">
          404
        </p>

        <p className="mt-6 font-display text-2xl font-extrabold uppercase tracking-tight text-bone">
          Nothing on this screen
        </p>
        <p className="mx-auto mt-3 max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
          The print for{" "}
          <span className="text-acid">{location.pathname}</span> never arrived. It may have been
          pulled from the schedule.
        </p>

        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2.5 border-2 border-acid bg-acid px-6 py-3 text-ink transition-all duration-200 hover:-translate-x-0.5 focus-visible:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 hover:shadow-hard-flare focus-visible:shadow-hard-flare"
        >
          <ArrowLeft size={15} />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
            Back to Lobby
          </span>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
