import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  DEFAULT_MANIFEST_URL,
  Updater,
  bundledVersion,
  fetchManifest,
  isNative,
  isNewer,
  loadManifestUrl,
  saveManifestUrl,
  type InstalledVersion,
  type UpdateManifest,
} from "@/lib/updater";

type State =
  | { at: "idle" }
  | { at: "checking" }
  | { at: "current" }
  | { at: "available"; manifest: UpdateManifest }
  | { at: "blocked"; manifest: UpdateManifest }
  | { at: "downloading"; manifest: UpdateManifest; percent: number }
  | { at: "handing-over"; manifest: UpdateManifest }
  | { at: "failed"; reason: string };

const megabytes = (bytes?: number) =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : null;

/**
 * Updating from inside the app.
 *
 * A sideloaded build has no store behind it, so the alternative is finding the
 * download page on another device and installing by hand — which on a TV means
 * an on-screen keyboard and a browser nobody wants to use.
 *
 * Android still shows its own installer before anything is replaced, and the
 * permission that allows it is granted per-app in system settings. Neither is
 * bypassed here; this only removes the fetching and the typing.
 */
export default function UpdatePanel() {
  const [installed, setInstalled] = useState<InstalledVersion>(() => bundledVersion());
  const [state, setState] = useState<State>({ at: "idle" });
  const [source, setSource] = useState(() => loadManifestUrl());
  const [sourceSaved, setSourceSaved] = useState(false);

  const listener = useRef<PluginListenerHandle | null>(null);
  useEffect(
    () => () => {
      void listener.current?.remove();
    },
    []
  );

  /** The package is the authority on what is installed; the bundle only guesses. */
  useEffect(() => {
    if (!isNative()) return;
    Updater.currentVersion()
      .then(setInstalled)
      .catch(() => {
        /* Keep the bundled version; it is close enough to show. */
      });
  }, []);

  const check = useCallback(async (): Promise<void> => {
    setState({ at: "checking" });
    try {
      const manifest = await fetchManifest();
      const current = isNative()
        ? await Updater.currentVersion().catch(() => installed)
        : installed;
      setInstalled(current);

      if (!isNewer(manifest, current)) {
        setState({ at: "current" });
        return;
      }
      // Asked before downloading, so a refusal costs nothing but a moment.
      const allowed = isNative() ? (await Updater.canInstall()).granted : true;
      setState({ at: allowed ? "available" : "blocked", manifest });
    } catch (error) {
      setState({ at: "failed", reason: error instanceof Error ? error.message : String(error) });
    }
  }, [installed]);

  // Opening this screen is as clear a request to look as pressing the button.
  useEffect(() => {
    void check();
    // Once, on arrival — re-running whenever `check` changes would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const install = useCallback(
    async (manifest: UpdateManifest) => {
      setState({ at: "downloading", manifest, percent: -1 });
      try {
        void listener.current?.remove();
        listener.current = await Updater.addListener("progress", (p) =>
          setState((prev) =>
            prev.at === "downloading" ? { ...prev, percent: p.percent } : prev
          )
        );
        await Updater.downloadAndInstall({ url: manifest.apk, sha256: manifest.sha256 });
        // Android's installer is in front now; this screen is behind it.
        setState({ at: "handing-over", manifest });
      } catch (error) {
        setState({ at: "failed", reason: error instanceof Error ? error.message : String(error) });
      }
    },
    []
  );

  const allowInstalls = useCallback(async (manifest: UpdateManifest) => {
    try {
      await Updater.requestInstallPermission();
      // The viewer grants it in another screen, so nothing is known until they
      // come back and ask again.
      setState({ at: "available", manifest });
    } catch (error) {
      setState({ at: "failed", reason: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  const saveSource = () => {
    saveManifestUrl(source);
    setSource(loadManifestUrl());
    setSourceSaved(true);
    window.setTimeout(() => setSourceSaved(false), 2500);
    void check();
  };

  const busy = state.at === "checking" || state.at === "downloading";

  return (
    <section className="reveal max-w-3xl space-y-4 border border-border bg-card p-5">
      <div>
        <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-bone">
          Updates
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Movway is installed by hand, so nothing updates it on its own. This checks the build
          published alongside the app and installs it here — no other device, no typing.
        </p>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-border bg-ink/50 px-3 py-2.5">
        <span className="kicker text-muted-foreground">Installed</span>
        <span className="font-mono text-sm font-bold tabular-nums text-acid">
          {installed.version}
        </span>
        {installed.versionCode > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
            build {installed.versionCode}
          </span>
        )}
      </div>

      {/* ── What the check found ── */}
      {state.at === "checking" && (
        <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking for a newer build…
        </p>
      )}

      {state.at === "current" && (
        <p className="flex items-center gap-2 font-mono text-[11px] text-acid">
          <CheckCircle2 className="h-3.5 w-3.5" /> This is the newest build.
        </p>
      )}

      {(state.at === "available" || state.at === "blocked") && (
        <div className="border border-acid/50 bg-acid/5 px-3 py-2.5">
          <p className="font-mono text-[11px] text-bone">
            <span className="font-bold text-acid">{state.manifest.version}</span> is available
            {megabytes(state.manifest.size) && ` · ${megabytes(state.manifest.size)}`}
          </p>
          {state.at === "blocked" && (
            <p className="mt-1.5 flex items-start gap-2 font-mono text-[10px] leading-relaxed text-flare">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Android needs your permission before Movway can install anything. Allow it once and
              come back — the switch is under this app in system settings.
            </p>
          )}
        </div>
      )}

      {state.at === "downloading" && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 font-mono text-[11px] text-bone">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-acid" />
            {state.percent >= 0 ? `Downloading ${state.percent}%` : "Downloading…"}
          </p>
          <div className="h-1 w-full max-w-md overflow-hidden bg-secondary">
            <div
              className="h-full bg-acid [transition-duration:200ms] transition-[width]"
              style={{ width: `${state.percent >= 0 ? state.percent : 8}%` }}
            />
          </div>
        </div>
      )}

      {state.at === "handing-over" && (
        <p className="flex items-center gap-2 font-mono text-[11px] text-acid">
          <CheckCircle2 className="h-3.5 w-3.5" /> Downloaded. Android is asking you to confirm
          the install.
        </p>
      )}

      {state.at === "failed" && (
        <p className="flex items-start gap-2 font-mono text-[11px] leading-relaxed text-flare">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {state.reason}
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        {state.at === "available" && isNative() && (
          <button
            type="button"
            onClick={() => void install(state.manifest)}
            data-tv-autofocus
            className="inline-flex items-center gap-2 border-2 border-acid bg-acid px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
          >
            <ArrowDownToLine size={14} /> Update to {state.manifest.version}
          </button>
        )}

        {state.at === "blocked" && (
          <button
            type="button"
            onClick={() => void allowInstalls(state.manifest)}
            data-tv-autofocus
            className="border-2 border-flare px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-flare transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
          >
            Allow Movway to install
          </button>
        )}

        {/* In a browser there is nothing to install into, so point at the file. */}
        {state.at === "available" && !isNative() && (
          <a
            href={state.manifest.apk}
            className="inline-flex items-center gap-2 border-2 border-acid bg-acid px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
          >
            <ArrowDownToLine size={14} /> Download {state.manifest.version}
          </a>
        )}

        <button
          type="button"
          onClick={() => void check()}
          disabled={busy}
          className="border-2 border-border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-bone transition-colors hover:border-acid focus-visible:border-acid disabled:opacity-40"
        >
          Check again
        </button>
      </div>

      {/* ── Where it looks ── */}
      <details className="border-t border-border pt-3">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
          Update source
        </summary>
        <div className="mt-3 space-y-2">
          <label className="flex max-w-xl items-stretch border-2 border-border transition-colors focus-within:border-acid">
            <span className="flex items-center bg-secondary px-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Manifest
            </span>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={DEFAULT_MANIFEST_URL}
              spellCheck={false}
              autoCapitalize="none"
              className="min-w-0 flex-1 bg-card px-3 py-2.5 font-mono text-[11px] text-bone placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveSource}
              className="border-2 border-border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-bone transition-colors hover:border-acid focus-visible:border-acid"
            >
              Save source
            </button>
            {sourceSaved && <span className="kicker text-acid">Saved</span>}
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/70">
            Empty means the published build. Point this somewhere else to take updates from your
            own deploy instead.
          </p>
        </div>
      </details>
    </section>
  );
}
