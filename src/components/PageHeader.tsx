import { ReactNode } from "react";

interface Props {
  /** Small mono label above the title, e.g. "Catalogue". */
  kicker: string;
  title: string;
  /** Right-hand slot — counts, filters, actions. */
  aside?: ReactNode;
}

export default function PageHeader({ kicker, title, aside }: Props) {
  return (
    <header className="reveal space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-acid animate-flicker" />
        <span className="kicker text-acid">{kicker}</span>
        <span className="h-px flex-1 bg-border" />
        {aside}
      </div>
      <h1 className="font-display font-variation-tight text-[clamp(2.25rem,6vw,4.5rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.05em] text-bone">
        {title}
      </h1>
    </header>
  );
}
