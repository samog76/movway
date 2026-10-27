import { ReactNode } from "react";

/** Poster grid shared by Browse, Search and My List. */
export const POSTER_GRID =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6";

interface Props {
  title: string;
  /** Right-hand slot — counts, filters, actions. */
  aside?: ReactNode;
}

export default function PageHeader({ title, aside }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-4xl font-bold tracking-[-0.03em] text-white md:text-5xl">{title}</h1>
      {aside}
    </header>
  );
}
