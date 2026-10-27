import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { useMyList } from "@/hooks/useMyList";
import { PosterCard } from "@/components/ContentRow";
import PageHeader, { POSTER_GRID } from "@/components/PageHeader";

export default function MyListPage() {
  const list = useMyList();

  return (
    <div className="space-y-8">
      <PageHeader
        title="My List"
        aside={list.length ? <span className="text-sm text-white/50">{list.length} saved</span> : undefined}
      />

      {list.length ? (
        <div className={POSTER_GRID}>
          {list.map((item) => (
            <PosterCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="glass flex flex-col items-center rounded-2xl px-6 py-20 text-center">
          <Bookmark size={36} className="text-white/40" />
          <p className="mt-5 text-xl font-semibold text-white">Nothing saved yet</p>
          <p className="mt-2 max-w-sm text-sm text-white/60">
            Press + on any title to keep it here for later.
          </p>
          <Link to="/" className="btn-play mt-8">
            Find something to watch
          </Link>
        </div>
      )}
    </div>
  );
}
