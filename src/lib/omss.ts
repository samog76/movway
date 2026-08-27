/**
 * Client for an OMSS streaming backend (https://docs.cinepro.cc).
 *
 * This is what finally lets Movway's own controls work. The embeds it used
 * before are opaque cross-origin frames: they ignore commands, expose no
 * keyboard handling, and cannot be reached into — so no remote could ever
 * drive them. An OMSS backend instead *returns* the stream, which Movway plays
 * in its own <video>, where play, pause and seek are simply real.
 *
 * The backend is self-hosted and its address is configured by the viewer; there
 * is no default, and with none set Movway keeps using the embeds. Every URL in
 * a response is a relative path onto the backend's own proxy, which is what
 * handles upstream headers — so nothing here needs to know about them.
 */

export interface OmssAudioTrack {
  label?: string;
  language?: string;
}

export interface OmssProvider {
  id?: string;
  name?: string;
}

export interface OmssSource {
  id?: string;
  /** Absolute once resolved; a proxy path onto the backend as delivered. */
  url: string;
  type: "hls" | "dash" | "http" | "mp4" | "mkv" | "webm";
  quality: string;
  audioTracks?: OmssAudioTrack[];
  provider?: OmssProvider;
}

export interface OmssSubtitle {
  url: string;
  label: string;
  format: "vtt" | "srt" | "ass" | "ssa";
}

export interface OmssSources {
  responseId?: string;
  expiresAt?: string;
  sources: OmssSource[];
  subtitles: OmssSubtitle[];
}

const BACKEND_KEY = "movway:omss-backend";

/** Trailing slashes and stray whitespace make every later join fragile. */
export function normaliseBackendUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function loadBackendUrl(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(BACKEND_KEY) ?? "";
}

export function saveBackendUrl(url: string): void {
  if (typeof localStorage === "undefined") return;
  const value = normaliseBackendUrl(url);
  if (value) localStorage.setItem(BACKEND_KEY, value);
  else localStorage.removeItem(BACKEND_KEY);
}

/** A source URL is a path onto the backend's proxy, so it needs the base back. */
export function resolveUrl(backendUrl: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${normaliseBackendUrl(backendUrl)}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Best first: highest resolution, and a stream type the browser can play. */
const PLAYABLE: OmssSource["type"][] = ["hls", "mp4", "webm", "http", "dash", "mkv"];

export function rankSources(sources: OmssSource[]): OmssSource[] {
  const height = (quality: string) => {
    const match = /(\d{3,4})\s*p/i.exec(quality ?? "");
    return match ? Number(match[1]) : 0;
  };
  return [...sources].sort((a, b) => {
    const typeDelta = PLAYABLE.indexOf(a.type) - PLAYABLE.indexOf(b.type);
    if (typeDelta !== 0) return typeDelta;
    return height(b.quality) - height(a.quality);
  });
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`OMSS ${res.status}`);
  return (await res.json()) as T;
}

function shape(raw: Partial<OmssSources> | null, backendUrl: string): OmssSources {
  const sources = (raw?.sources ?? []).filter((s) => s && typeof s.url === "string");
  const subtitles = (raw?.subtitles ?? []).filter((s) => s && typeof s.url === "string");
  return {
    responseId: raw?.responseId,
    expiresAt: raw?.expiresAt,
    sources: rankSources(sources).map((s) => ({ ...s, url: resolveUrl(backendUrl, s.url) })),
    subtitles: subtitles.map((s) => ({ ...s, url: resolveUrl(backendUrl, s.url) })),
  };
}

export function movieSourcesUrl(backendUrl: string, tmdbId: number): string {
  return `${normaliseBackendUrl(backendUrl)}/v1/movies/${tmdbId}`;
}

export function episodeSourcesUrl(
  backendUrl: string,
  tmdbId: number,
  season: number,
  episode: number
): string {
  return `${normaliseBackendUrl(
    backendUrl
  )}/v1/tv/${tmdbId}/seasons/${season}/episodes/${episode}`;
}

export async function fetchMovieSources(
  backendUrl: string,
  tmdbId: number,
  signal?: AbortSignal
): Promise<OmssSources> {
  return shape(await get(movieSourcesUrl(backendUrl, tmdbId), signal), backendUrl);
}

export async function fetchEpisodeSources(
  backendUrl: string,
  tmdbId: number,
  season: number,
  episode: number,
  signal?: AbortSignal
): Promise<OmssSources> {
  return shape(
    await get(episodeSourcesUrl(backendUrl, tmdbId, season, episode), signal),
    backendUrl
  );
}

export interface OmssHealth {
  name?: string;
  version?: string;
  status?: "operational" | "degraded" | "maintenance" | "offline";
  spec?: string;
  note?: string;
}

/**
 * Ask a backend whether it is there and willing. Used by settings so the
 * address can be confirmed before a title is opened, rather than discovering
 * a typo as a black screen.
 */
export async function checkBackend(backendUrl: string, signal?: AbortSignal): Promise<OmssHealth> {
  const base = normaliseBackendUrl(backendUrl);
  if (!base) throw new Error("No address given");
  return get<OmssHealth>(`${base}/v1/health`, signal);
}
