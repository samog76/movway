import { Check, Plus } from "lucide-react";
import { Movie, mediaTypeOf } from "@/lib/tmdb";
import { isInMyList, toggleMyList } from "@/lib/myList";
import { useMyList } from "@/hooks/useMyList";

/** Round glass toggle that saves a title to My List. */
export default function MyListButton({ item, className = "" }: { item: Movie; className?: string }) {
  useMyList(); // re-render when the list changes anywhere
  const saved = isInMyList(item.id, mediaTypeOf(item));
  const label = saved ? "Remove from My List" : "Add to My List";
  return (
    <button
      type="button"
      onClick={() => toggleMyList(item)}
      aria-label={label}
      aria-pressed={saved}
      title={label}
      className={`btn-glass w-12 px-0 ${className}`}
    >
      {saved ? <Check size={22} /> : <Plus size={22} />}
    </button>
  );
}
