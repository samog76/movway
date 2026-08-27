import { describeFault } from "@/lib/faults";

/**
 * Prints the cause of a failed request on screen. There is no console on a
 * television, so this is the only place a sideloaded build can explain itself.
 */
export default function FaultReport({
  title,
  error,
  compact,
}: {
  title: string;
  error: unknown;
  compact?: boolean;
}) {
  const fault = describeFault(error);

  return (
    <div className="border border-flare/40 bg-flare/5 px-4 py-3">
      <span className="kicker text-flare">{title}</span>
      <p className="mt-1.5 font-mono text-[12px] text-bone">{fault.cause}</p>
      {!compact && (
        <p className="mt-1.5 max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground">
          {fault.hint}
        </p>
      )}
      <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/60">{fault.detail}</p>
    </div>
  );
}
