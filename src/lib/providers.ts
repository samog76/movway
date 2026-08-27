import { buildMovieEmbedUrl, buildTVEpisodeEmbedUrl } from "@/lib/tmdb";

/**
 * Playback sources.
 *
 * VixSrc is the only one for now. What it supports was measured against the
 * live player rather than taken from the docs, and those measurements are what
 * the on-screen controls are built on:
 *
 *   • `startAt` genuinely seeks — a load with `startAt=120` landed at 125.9s.
 *     That is what makes Movway's seek controls real rather than decorative.
 *   • It posts `PLAYER_EVENT` telemetry outward (play / pause / seeked / ended /
 *     timeupdate, with currentTime and duration), so the position and duration
 *     shown are the player's own numbers, not an estimate.
 *   • Its player answers the space bar, but arrow keys do nothing: two presses
 *     while paused moved the position 0 seconds. And the handler lives in a
 *     frame nested inside the page Movway embeds, so keys delivered to the
 *     frame Movway owns do not reach it.
 *
 * That last point is why Movway draws its own controls instead of handing the
 * remote over: the embed cannot be driven from outside, but it can be *told
 * where to start*, and it reports where it is. Between those two facts a D-pad
 * gets working play, pause and seek.
 */

export interface ProviderBuildOptions {
  /** Preferred audio language (e.g. "en", "it"). */
  sub?: string;
  /** Start position in seconds — how seeking is performed. */
  startAt?: number;
}

export interface VideoProvider {
  id: string;
  name: string;
  /** Whether a language can be requested through the URL. */
  supportsSubtitles: boolean;
  /** Whether the embed URL takes a start offset, which is how seeking works. */
  supportsStartAt: boolean;
  /**
   * Whether the source can be asked to draw no chrome of its own, leaving
   * Movway's controls the only ones on screen. Everywhere else we dim our
   * controls over theirs and live with two sets.
   */
  hidesOwnControls?: boolean;
  /**
   * Whether Movway may switch to this source on its own when another refuses to
   * play. A source the app has never seen play is fine to *offer* — the viewer
   * may be on a network where it works — but falling back to it automatically
   * would spend the viewer's next twenty seconds on a frame that stays black.
   */
  autoFallback: boolean;
  /** Origin its telemetry arrives from, for filtering `message` events. */
  origin: string;
  buildMovieUrl: (tmdbId: number, opts?: ProviderBuildOptions) => string;
  buildTVUrl: (
    tmdbId: number,
    season: number,
    episode: number,
    opts?: ProviderBuildOptions
  ) => string;
}

/** Movway's marquee lime, so the embed's own chrome matches the app. */
const ACCENT = "CCFF00";
const ACCENT_SECONDARY = "1B1B20";

const vixsrcUrl = (base: string, opts: ProviderBuildOptions): string => {
  const url = new URL(base);
  url.searchParams.set("autoplay", "true");
  url.searchParams.set("primaryColor", ACCENT);
  url.searchParams.set("secondaryColor", ACCENT_SECONDARY);
  if (opts.sub) url.searchParams.set("lang", opts.sub);
  if (opts.startAt && opts.startAt > 0) {
    url.searchParams.set("startAt", String(Math.round(opts.startAt)));
  }
  return url.toString();
};

const vidlinkUrl = (base: string, opts: ProviderBuildOptions): string => {
  const url = new URL(base);
  url.searchParams.set("autoplay", "true");
  url.searchParams.set("primaryColor", ACCENT);
  url.searchParams.set("iconColor", ACCENT);
  if (opts.startAt && opts.startAt > 0) {
    url.searchParams.set("startTime", String(Math.round(opts.startAt)));
  }
  return url.toString();
};

/**
 * VidAPI takes `controls=false`, which no other source here offers: it draws no
 * chrome at all, so Movway's controls are the only ones on screen instead of
 * floating over a second set. `overlay=false` removes the hover darkening that
 * would otherwise sit under them.
 *
 * Its telemetry is also the richest of the four — it reports `player_status`
 * outright, so paused is a fact rather than something inferred from whether the
 * position stopped moving.
 *
 * Note it takes TMDB ids bare (`/embed/movie/1147301`), which is what Movway
 * already carries, so no id translation is needed.
 */
const vidapiUrl = (base: string, opts: ProviderBuildOptions): string => {
  const url = new URL(base);
  url.searchParams.set("autoplay", "1");
  // The whole point of this source: its own controls off, ours alone on top.
  url.searchParams.set("controls", "false");
  url.searchParams.set("overlay", "false");
  url.searchParams.set("primaryColor", `#${ACCENT}`);
  if (opts.sub) url.searchParams.set("lang", opts.sub);
  if (opts.startAt && opts.startAt > 0) {
    url.searchParams.set("resumeAt", String(Math.round(opts.startAt)));
  }
  return url.toString();
};

/**
 * VixSrc first, then somewhere else to go.
 *
 * A source can simply refuse a viewer — a rate limit, a bot check, an outage —
 * and it says so by rendering its own page inside the frame, which cannot be
 * read from here and cannot be argued with from inside a frame either. With one
 * source that is the end of the evening. So the alternates are back: not
 * because VixSrc is second choice, but because "the source said no" should cost
 * a few seconds rather than the whole app.
 */
export const VIDEO_PROVIDERS: VideoProvider[] = [
  {
    id: "vixsrc",
    autoFallback: true,
    name: "VixSrc",
    supportsSubtitles: true,
    supportsStartAt: true,
    origin: "https://vixsrc.to",
    buildMovieUrl: (id, opts = {}) => vixsrcUrl(`https://vixsrc.to/movie/${id}`, opts),
    buildTVUrl: (id, season, episode, opts = {}) =>
      vixsrcUrl(`https://vixsrc.to/tv/${id}/${season}/${episode}`, opts),
  },
  {
    id: "vidlink",
    autoFallback: true,
    name: "VidLink",
    supportsSubtitles: false,
    supportsStartAt: true,
    origin: "https://vidlink.pro",
    buildMovieUrl: (id, opts = {}) => vidlinkUrl(`https://vidlink.pro/movie/${id}`, opts),
    buildTVUrl: (id, season, episode, opts = {}) =>
      vidlinkUrl(`https://vidlink.pro/tv/${id}/${season}/${episode}`, opts),
  },
  {
    id: "vidcore",
    autoFallback: true,
    name: "VidCore",
    supportsSubtitles: true,
    supportsStartAt: true,
    origin: "https://vidcore.net",
    buildMovieUrl: (id, opts = {}) =>
      buildMovieEmbedUrl(id, { autoPlay: true, sub: opts.sub, startAt: opts.startAt }),
    buildTVUrl: (id, season, episode, opts = {}) =>
      buildTVEpisodeEmbedUrl(id, season, episode, {
        autoPlay: true,
        nextButton: true,
        autoNext: true,
        sub: opts.sub,
        startAt: opts.startAt,
      }),
  },
  {
    id: "vidapi",
    // Offered, not auto-selected. Measured on 2026-08-27: vaplayer.ru serves its
    // player shell (HTTP 200) but never resolves a stream — five loads, three
    // titles, two of them listed in VidAPI's own published catalogue, framed and
    // top-level, controls on and off, and not once did a <video> element appear.
    // It is here because it is the only source that can be told to hide its own
    // controls, and it may well work from a network other than the one it was
    // tested from.
    autoFallback: false,
    name: "VidAPI",
    supportsSubtitles: true,
    supportsStartAt: true,
    hidesOwnControls: true,
    origin: "https://vaplayer.ru",
    buildMovieUrl: (id, opts = {}) => vidapiUrl(`https://vaplayer.ru/embed/movie/${id}`, opts),
    buildTVUrl: (id, season, episode, opts = {}) =>
      vidapiUrl(`https://vaplayer.ru/embed/tv/${id}/${season}/${episode}`, opts),
  },
];

/**
 * Next source to try when the current one will not play.
 *
 * Only sources the app is willing to choose by itself are candidates, so a
 * viewer whose source just failed is never handed one that is not known to
 * play. Picking such a source by hand stays possible.
 */
export function nextProviderId(currentId: string): string | null {
  const at = VIDEO_PROVIDERS.findIndex((p) => p.id === currentId);
  const next = VIDEO_PROVIDERS.slice(at + 1).find((p) => p.autoFallback);
  return next ? next.id : null;
}

export const DEFAULT_PROVIDER_ID = VIDEO_PROVIDERS[0].id;

export const getProvider = (id: string | null | undefined): VideoProvider =>
  VIDEO_PROVIDERS.find((p) => p.id === id) ?? VIDEO_PROVIDERS[0];

export interface SubtitleLanguage {
  code: string;
  label: string;
}

/** "" = the player's own default. VixSrc calls this the audio `lang`. */
export const SUBTITLE_LANGUAGES: SubtitleLanguage[] = [
  { code: "", label: "Default" },
  { code: "en", label: "English" },
  { code: "it", label: "Italian" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
];

const PROVIDER_STORAGE_KEY = "movway:provider";
const SUBTITLE_STORAGE_KEY = "movway:subtitle";

export const loadProviderId = (): string => {
  if (typeof localStorage === "undefined") return DEFAULT_PROVIDER_ID;
  const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
  // A saved id can name a source that no longer exists.
  return VIDEO_PROVIDERS.some((p) => p.id === stored) ? (stored as string) : DEFAULT_PROVIDER_ID;
};

export const saveProviderId = (id: string) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PROVIDER_STORAGE_KEY, id);
};

export const loadSubtitle = (): string => {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(SUBTITLE_STORAGE_KEY) ?? "";
};

export const saveSubtitle = (code: string) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SUBTITLE_STORAGE_KEY, code);
};
