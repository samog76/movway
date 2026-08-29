import {
  Capacitor,
  CapacitorHttp,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

/**
 * Taking a new build without leaving the app.
 *
 * Movway is sideloaded, so nothing updates it on its own. The manifest lives
 * beside the APK in the repo, which is public and is already where shipping
 * puts the build — so it is current without a deploy of its own, and there is
 * no second address to keep in step.
 */

export interface UpdateManifest {
  version: string;
  versionCode: number;
  apk: string;
  /** Checked before anything is installed; a bad download is discarded. */
  sha256?: string;
  size?: number;
}

export interface DownloadProgress {
  /** -1 while the server has not said how large the file is. */
  percent: number;
  received: number;
  total: number;
}

export interface InstalledVersion {
  version: string;
  versionCode: number;
}

interface UpdaterPlugin {
  currentVersion(): Promise<InstalledVersion>;
  canInstall(): Promise<{ granted: boolean }>;
  requestInstallPermission(): Promise<void>;
  downloadAndInstall(options: { url: string; sha256?: string }): Promise<void>;
  addListener(
    event: "progress",
    handler: (progress: DownloadProgress) => void
  ): Promise<PluginListenerHandle>;
}

export const Updater = registerPlugin<UpdaterPlugin>("Updater");

export const DEFAULT_MANIFEST_URL =
  "https://raw.githubusercontent.com/samog76/movway/main/download-site/version.json";

const MANIFEST_KEY = "movway:update-manifest";

export const loadManifestUrl = (): string => {
  if (typeof localStorage === "undefined") return DEFAULT_MANIFEST_URL;
  const stored = localStorage.getItem(MANIFEST_KEY)?.trim();
  return stored ? stored : DEFAULT_MANIFEST_URL;
};

export const saveManifestUrl = (url: string) => {
  if (typeof localStorage === "undefined") return;
  const trimmed = url.trim();
  if (!trimmed || trimmed === DEFAULT_MANIFEST_URL) localStorage.removeItem(MANIFEST_KEY);
  else localStorage.setItem(MANIFEST_KEY, trimmed);
};

/**
 * Compare two dotted versions numerically.
 *
 * String order is wrong in exactly the case that matters: "1.10.0" sorts before
 * "1.9.0", so a device on 1.9.0 would be told it is up to date forever.
 * Returns <0 when a is older, 0 when equal, >0 when a is newer.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .trim()
      .replace(/^v/i, "")
      .split(/[.\-+]/)
      .map((n) => Number.parseInt(n, 10))
      .map((n) => (Number.isFinite(n) ? n : 0));

  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * A manifest is only usable if it names a version and somewhere to get it.
 * Anything less is treated as no manifest at all rather than half-trusted —
 * an update offer that cannot be completed is worse than none.
 */
export function parseManifest(raw: unknown): UpdateManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;

  const version = typeof m.version === "string" ? m.version.trim() : "";
  const apk = typeof m.apk === "string" ? m.apk.trim() : "";
  if (!version || !apk) return null;
  // Only over TLS: this ends in an installed application.
  if (!/^https:\/\//i.test(apk)) return null;

  const versionCode =
    typeof m.versionCode === "number" && Number.isFinite(m.versionCode) ? m.versionCode : 0;

  return {
    version,
    versionCode,
    apk,
    sha256: typeof m.sha256 === "string" && /^[0-9a-f]{64}$/i.test(m.sha256) ? m.sha256 : undefined,
    size: typeof m.size === "number" && m.size > 0 ? m.size : undefined,
  };
}

/**
 * Prefer the version code when both sides have one: it is the number Android
 * itself orders installs by, and it is read from the installed package rather
 * than from a string the bundle was built with.
 */
export function isNewer(manifest: UpdateManifest, installed: InstalledVersion): boolean {
  if (manifest.versionCode > 0 && installed.versionCode > 0) {
    return manifest.versionCode > installed.versionCode;
  }
  return compareVersions(manifest.version, installed.version) > 0;
}

/**
 * Fetched natively on device for the same reason every other call is: the app
 * is served from `https://localhost`, and a cross-origin request made by the
 * WebView is the one thing that reliably fails in a packaged build.
 */
export async function fetchManifest(url = loadManifestUrl()): Promise<UpdateManifest> {
  // The manifest is served with a five-minute cache; without this a device can
  // keep being told it is current for minutes after a release.
  const address = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;

  let payload: unknown;
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url: address,
      headers: { Accept: "application/json" },
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`Update check failed (${res.status})`);
    payload = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  } else {
    const res = await fetch(address, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Update check failed (${res.status})`);
    payload = await res.json();
  }

  const manifest = parseManifest(payload);
  if (!manifest) throw new Error("The update manifest is not readable");
  return manifest;
}

/** What the running build believes it is, when there is no package to ask. */
export const bundledVersion = (): InstalledVersion => ({
  version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0",
  versionCode: 0,
});

export const isNative = () => Capacitor.isNativePlatform();
