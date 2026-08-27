import { buildMovieEmbedUrl, buildTVEpisodeEmbedUrl } from "@/lib/tmdb";

export interface ProviderBuildOptions {
  /** Default subtitle language code (e.g. "en", "es"). */
  sub?: string;
  /** Resume position in seconds. */
  startAt?: number;
}

export interface VideoProvider {
  id: string;
  name: string;
  /** Whether the provider supports a default subtitle language via URL. */
  supportsSubtitles: boolean;
  buildMovieUrl: (tmdbId: number, opts?: ProviderBuildOptions) => string;
  buildTVUrl: (
    tmdbId: number,
    season: number,
    episode: number,
    opts?: ProviderBuildOptions
  ) => string;
}

/** Movway's marquee lime, so the embed's own controls match the app. */
const VIDLINK_ACCENT = "CCFF00";

const vidlinkUrl = (base: string, opts: ProviderBuildOptions): string => {
  const url = new URL(base);
  url.searchParams.set("autoplay", "true");
  url.searchParams.set("primaryColor", VIDLINK_ACCENT);
  url.searchParams.set("iconColor", VIDLINK_ACCENT);
  if (opts.startAt && opts.startAt > 0) {
    url.searchParams.set("startTime", String(Math.round(opts.startAt)));
  }
  return url.toString();
};

export const VIDEO_PROVIDERS: VideoProvider[] = [
  {
    /**
     * The default. It is the only source that reports playback back to the
     * page (PLAYER_EVENT with currentTime/duration), which is what lets Movway
     * tell whether it is actually working — and therefore what makes the
     * automatic fall back to VidCore possible. Its player is themed to the app
     * accent, since the embed's own controls are what the remote drives once
     * focus moves into the frame. `startTime` is where
     * `ProviderBuildOptions.startAt` lands.
     */
    id: "vidlink",
    name: "VidLink",
    supportsSubtitles: false,
    buildMovieUrl: (id, opts = {}) => vidlinkUrl(`https://vidlink.pro/movie/${id}`, opts),
    buildTVUrl: (id, season, episode, opts = {}) =>
      vidlinkUrl(`https://vidlink.pro/tv/${id}/${season}/${episode}`, opts),
  },
  {
    /** The alternate, used when VidLink does not come up. */
    id: "vidcore",
    name: "VidCore",
    supportsSubtitles: true,
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
];

/** Where playback falls back to when the default never comes up. */
export const FALLBACK_PROVIDER_ID = "vidcore";

export const DEFAULT_PROVIDER_ID = VIDEO_PROVIDERS[0].id;

export const getProvider = (id: string | null | undefined): VideoProvider =>
  VIDEO_PROVIDERS.find((p) => p.id === id) ?? VIDEO_PROVIDERS[0];

export interface SubtitleLanguage {
  code: string;
  label: string;
}

/** "" = Off / player default. */
export const SUBTITLE_LANGUAGES: SubtitleLanguage[] = [
  { code: "", label: "Off" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ru", label: "Russian" },
];

const PROVIDER_STORAGE_KEY = "movway:provider";
const SUBTITLE_STORAGE_KEY = "movway:subtitle";

export const loadProviderId = (): string => {
  if (typeof localStorage === "undefined") return DEFAULT_PROVIDER_ID;
  const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
  // A saved id can name a source that no longer exists — anyone who picked one
  // of the sources since removed still has it in storage.
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
