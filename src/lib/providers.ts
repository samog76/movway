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
    // vsembed.ru — VidSrc mirror. TMDB ids; default subtitle language via ds_lang.
    id: "vsembed",
    name: "VSEmbed",
    supportsSubtitles: true,
    buildMovieUrl: (id, opts = {}) => {
      const url = new URL(`https://vsembed.ru/embed/movie`);
      url.searchParams.set("tmdb", String(id));
      url.searchParams.set("autoplay", "1");
      if (opts.sub) url.searchParams.set("ds_lang", opts.sub);
      return url.toString();
    },
    buildTVUrl: (id, season, episode, opts = {}) => {
      const url = new URL(`https://vsembed.ru/embed/tv`);
      url.searchParams.set("tmdb", String(id));
      url.searchParams.set("season", String(season));
      url.searchParams.set("episode", String(episode));
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("autonext", "1");
      if (opts.sub) url.searchParams.set("ds_lang", opts.sub);
      return url.toString();
    },
  },
  {
    /**
     * Its player is themed to Movway's accent, since the embed's own controls
     * are what the remote drives once focus moves into the frame. It also takes
     * a `startTime` offset, which is what `ProviderBuildOptions.startAt` maps
     * onto here.
     */
    id: "vidlink",
    name: "VidLink",
    supportsSubtitles: false,
    buildMovieUrl: (id, opts = {}) =>
      vidlinkUrl(`https://vidlink.pro/movie/${id}`, opts),
    buildTVUrl: (id, season, episode, opts = {}) =>
      vidlinkUrl(`https://vidlink.pro/tv/${id}/${season}/${episode}`, opts),
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
