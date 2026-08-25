/**
 * The cinema marquee strip. Renders its phrase list twice so the -50%
 * translate loops seamlessly.
 */
const PHRASES = [
  "Now Showing",
  "4K · HDR10+",
  "Dolby Atmos",
  "Open All Night",
  "No Ads, Ever",
  "Double Features",
  "Reel to Reel",
  "Midnight Screening",
];

export default function Marquee() {
  const run = [...PHRASES, ...PHRASES];

  return (
    <div className="relative overflow-hidden border-b border-border bg-acid text-ink">
      <div className="marquee-track flex w-max items-center gap-0 py-1.5">
        {run.map((phrase, i) => (
          <span key={i} className="flex items-center gap-6 pr-6">
            <span className="kicker whitespace-nowrap font-bold">{phrase}</span>
            <span aria-hidden className="text-[10px] leading-none opacity-60">
              ✳
            </span>
          </span>
        ))}
      </div>
      {/* soft edges so text enters and exits rather than popping */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-acid to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-acid to-transparent" />
    </div>
  );
}
