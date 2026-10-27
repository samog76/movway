import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getStreamingServices, img } from "@/lib/tmdb";
import { ROW_INSET } from "./ContentRow";

/** "Browse by service": a row of streaming-service tiles, each opening its catalogue. */
export default function ServiceStrip() {
  const { data: services } = useQuery({
    queryKey: ["streaming-services"],
    queryFn: getStreamingServices,
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (!services?.length) return null;

  return (
    <section className="space-y-4">
      <h2 className={`tv-safe text-xl font-semibold text-white/90 drop-shadow-md ${ROW_INSET}`}>
        Browse by Service
      </h2>
      <div className={`tv-safe scrollbar-hide flex gap-4 overflow-x-auto pb-2 pt-1 md:gap-6 ${ROW_INSET}`}>
        {services.map((s) => (
          <Link
            key={s.provider_id}
            to={`/browse/service-${s.provider_id}`}
            className="group/svc flex w-[4.5rem] shrink-0 flex-col items-center gap-2 rounded-2xl md:w-[5.25rem]"
          >
            <span className="block aspect-square w-full overflow-hidden rounded-2xl shadow-lg shadow-black/40 ring-1 ring-white/10 transition-transform duration-300 group-hover/svc:scale-105 group-focus-visible/svc:scale-105">
              <img src={img(s.logo_path, "w154")} alt="" className="h-full w-full object-cover" loading="lazy" />
            </span>
            <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-white/60 group-hover/svc:text-white group-focus-visible/svc:text-white">
              {s.provider_name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
