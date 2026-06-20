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

export const VIDEO_PROVIDERS: VideoProvider[] = [
  {
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
  {
    id: "vidsrc",
    name: "VidSrc",
    supportsSubtitles: false,
    buildMovieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true`,
    buildTVUrl: (id, season, episode) =>
      `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}?autoPlay=true`,
  },
  {
    id: "vidlink",
    name: "VidLink",
    supportsSubtitles: false,
    buildMovieUrl: (id) => `https://vidlink.pro/movie/${id}`,
    buildTVUrl: (id, season, episode) =>
      `https://vidlink.pro/tv/${id}/${season}/${episode}`,
  },
  {
    id: "embedsu",
    name: "Embed.su",
    supportsSubtitles: false,
    buildMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
    buildTVUrl: (id, season, episode) =>
      `https://embed.su/embed/tv/${id}/${season}/${episode}`,
  },
  {
    id: "autoembed",
    name: "AutoEmbed",
    supportsSubtitles: false,
    buildMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    buildTVUrl: (id, season, episode) =>
      `https://player.autoembed.cc/embed/tv/${id}/${season}/${episode}`,
  },
];

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
  return localStorage.getItem(PROVIDER_STORAGE_KEY) ?? DEFAULT_PROVIDER_ID;
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
