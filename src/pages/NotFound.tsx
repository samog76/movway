import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="glass w-full max-w-lg rounded-3xl p-10 text-center">
        <p className="text-7xl font-black tracking-[-0.05em] text-white/90">404</p>
        <p className="mt-4 text-2xl font-bold text-white">Page not found</p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/60">
          Nothing lives at <span className="font-medium text-white">{location.pathname}</span>.
        </p>
        <Link to="/" data-tv-autofocus className="btn-play mt-8">
          <ArrowLeft size={18} />
          Back to home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
