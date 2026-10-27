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
    <div className="rounded-2xl border border-flare/40 bg-flare/10 px-5 py-4">
      <span className="text-sm font-semibold text-red-300">{title}</span>
      <p className="mt-1.5 text-sm text-white">{fault.cause}</p>
      {!compact && (
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-white/60">
          {fault.hint}
        </p>
      )}
      <p className="mt-1.5 text-xs text-white/40">{fault.detail}</p>
    </div>
  );
}
