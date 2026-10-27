import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  checkBackend,
  isReachableFromPackagedApp,
  loadBackendUrl,
  normaliseBackendUrl,
  saveBackendUrl,
} from "@/lib/omss";
import { describeFault } from "@/lib/faults";
import UpdatePanel from "@/components/UpdatePanel";

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
      <PageHeader title="Settings" />

      <UpdatePanel />

      <section className="glass max-w-3xl space-y-4 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Streaming backend
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Point Movway at an OMSS backend — a CinePro Core instance, for example — and it will
            play the stream itself instead of embedding someone else's player. That is what makes
            the on-screen controls work with a remote: play, pause, seek and subtitles all act on
            Movway's own video. Leave this empty and the embedded players are used as before.
          </p>
        </div>

        <label className="flex max-w-xl items-center gap-3 rounded-full border border-white/10 bg-black/30 px-5 transition-shadow focus-within:ring-2 focus-within:ring-white/70">
          <span className="text-sm font-medium text-white/50">Address</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://cinepro-core.onrender.com"
            spellCheck={false}
            autoCapitalize="none"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            className="btn-play h-11 px-6 text-[15px]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void test()}
            className="btn-glass h-11 px-5 text-[15px] font-medium"
          >
            Test connection
          </button>
          {saved && <span className="text-sm font-medium text-emerald-400">Saved</span>}
        </div>

        {value.trim().length > 0 && !isReachableFromPackagedApp(value) && (
          <p className="rounded-xl border border-flare/40 bg-flare/10 px-4 py-3 text-sm leading-relaxed text-red-200">
            This works in a browser but not in the TV app: it serves itself over https, and an
            http address is blocked before the request is made. Host the backend behind https —
            a Render deploy gives you one.
          </p>
        )}

        {check.state === "checking" && (
          <p className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Contacting {normaliseBackendUrl(value)}…
          </p>
        )}
        {check.state === "ok" && (
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> {check.name} · {check.version}
          </p>
        )}
        {check.state === "failed" && (
          <p className="flex items-center gap-2 text-sm text-red-300">
            <XCircle className="h-3.5 w-3.5" /> {check.reason}
          </p>
        )}

        <p className="border-t border-white/10 pt-4 text-xs leading-relaxed text-white/45">
          Runs on your own machine, home server or a host like Render — see docs.cinepro.cc. It
          must be reachable from this device over https, and CinePro Core is licensed for
          personal use only.
        </p>
      </section>
    </div>
  );
}
