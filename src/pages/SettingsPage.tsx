import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { checkBackend, loadBackendUrl, normaliseBackendUrl, saveBackendUrl } from "@/lib/omss";
import { describeFault } from "@/lib/faults";

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; name: string; version: string }
  | { state: "failed"; reason: string };

export default function SettingsPage() {
  const [value, setValue] = useState(() => loadBackendUrl());
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState<Check>({ state: "idle" });

  const save = () => {
    saveBackendUrl(value);
    setValue(loadBackendUrl());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const test = async () => {
    setCheck({ state: "checking" });
    try {
      const health = await checkBackend(value);
      setCheck({
        state: "ok",
        name: health.name ?? "OMSS backend",
        version: health.version ?? "unknown version",
      });
    } catch (error) {
      setCheck({ state: "failed", reason: describeFault(error).cause });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader kicker="Setup" title="Settings" />

      <section className="reveal max-w-3xl space-y-4 border border-border bg-card p-5">
        <div>
          <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-bone">
            Streaming backend
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Point Movway at an OMSS backend — a CinePro Core instance, for example — and it will
            play the stream itself instead of embedding someone else's player. That is what makes
            the on-screen controls work with a remote: play, pause, seek and subtitles all act on
            Movway's own video. Leave this empty and the embedded players are used as before.
          </p>
        </div>

        <label className="flex max-w-xl items-stretch border-2 border-border transition-colors focus-within:border-acid">
          <span className="flex items-center bg-secondary px-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Address
          </span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="http://192.168.1.10:3000"
            spellCheck={false}
            autoCapitalize="none"
            className="min-w-0 flex-1 bg-card px-3 py-2.5 font-mono text-xs text-bone placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            className="border-2 border-acid bg-acid px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void test()}
            className="border-2 border-border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-bone transition-colors hover:border-acid focus-visible:border-acid"
          >
            Test connection
          </button>
          {saved && <span className="kicker text-acid">Saved</span>}
        </div>

        {check.state === "checking" && (
          <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Contacting {normaliseBackendUrl(value)}…
          </p>
        )}
        {check.state === "ok" && (
          <p className="flex items-center gap-2 font-mono text-[11px] text-acid">
            <CheckCircle2 className="h-3.5 w-3.5" /> {check.name} · {check.version}
          </p>
        )}
        {check.state === "failed" && (
          <p className="flex items-center gap-2 font-mono text-[11px] text-flare">
            <XCircle className="h-3.5 w-3.5" /> {check.reason}
          </p>
        )}

        <p className="border-t border-border pt-3 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
          The backend runs on your own machine or home server — see docs.cinepro.cc. It must be
          reachable from this device, and CinePro Core is licensed for personal use only.
        </p>
      </section>
    </div>
  );
}
