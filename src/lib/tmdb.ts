import { Capacitor, CapacitorHttp } from "@capacitor/core";

const TMDB_API_KEY =
  (import.meta.env.VITE_TMDB_API_KEY as string | undefined) ||
  "2dca580c2a14b55200e784d157207b4d";
const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const VIDCORE_BASE = "https://vidcore.io";
const DEFAULT_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export const img = (path: string | null, size = "w500") =>
  path
    ? `${IMG}/${size}${path}`
    : DEFAULT_IMAGE;

export const backdrop = (path: string | null) => img(path, "original");

/**
 * On Android the app is served from `https://localhost`, so every TMDB call is
 * a cross-origin request made by the WebView. That path is the one that breaks
 * in a packaged build — the page and its assets load from the bundle, then each
 * API request fails, which reads as "the app is broken" when the app is fine.
 *
 * Native HTTP sidesteps it: the request is made by the platform rather than the
 * WebView, so WebView-level origin and network policy never enter into it. Web
 * builds keep using plain fetch.
 */
async function tmdb<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url: url.toString(),
      headers: { Accept: "application/json" },
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`TMDB ${res.status}`);
    // The native bridge hands back parsed JSON for a JSON content type, but a
    // string when it cannot tell; accept either rather than assume.
    return (typeof res.data === "string" ? JSON.parse(res.data) : res.data) as T;
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export interface Movie {
  id: number;
  title: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
}

interface TmdbList { results: Movie[]; }

/** Movie or series, read the way TMDB's mixed lists leave it. */
export const mediaTypeOf = (m: Movie): "movie" | "tv" =>
  m.media_type === "tv" || m.first_air_date || (m.name && !m.title) ? "tv" : "movie";

/**
 * TMDB's genre ids, which are stable. List endpoints carry ids only, and a
 * request per genre list is not worth it for names that never change.
 */
const GENRE_NAMES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

export const genreName = (id: number): string | undefined => GENRE_NAMES[id];

export interface TmdbImage {
  file_path: string;
  iso_639_1: string | null;
  vote_average: number;
}

/**
 * The title's logo — the typeset title art studios publish — preferring
 * English, then language-neutral, so a hero can show the film's own lettering
 * rather than a font's approximation of it.
 */
export function pickLogo(logos: TmdbImage[] | undefined): string | null {
  if (!logos?.length) return null;
  const ranked = [...logos].sort((a, b) => b.vote_average - a.vote_average);
  return (
    ranked.find((l) => l.iso_639_1 === "en") ??
    ranked.find((l) => !l.iso_639_1) ??
    null
  )?.file_path ?? null;
}

export const getLogo = async (type: "movie" | "tv", id: number): Promise<string | null> => {
  const res = await tmdb<{ logos: TmdbImage[] }>(`/${type}/${id}/images`, {
    include_image_language: "en,null",
  });
  return pickLogo(res.logos);
};

export interface StreamingService {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

/** The services shown in the "Browse by service" strip, in display order. */
export const FEATURED_SERVICES = [8, 9, 337, 350, 15, 1899, 2303, 386, 283, 43, 526];

/** Logos come from TMDB rather than the bundle, the same as every poster. */
export const getStreamingServices = async (): Promise<StreamingService[]> => {
  const res = await tmdb<{ results: StreamingService[] }>("/watch/providers/movie", {
    watch_region: "US",
  });
  const byId = new Map(res.results.map((p) => [p.provider_id, p]));
  return FEATURED_SERVICES.map((id) => byId.get(id)).filter(
    (p): p is StreamingService => !!p
  );
};

export const getServiceTitles = (serviceId: number, type: "movie" | "tv") =>
  tmdb<TmdbList>(`/discover/${type}`, {
    with_watch_providers: String(serviceId),
    watch_region: "US",
    sort_by: "popularity.desc",
  });

export const getTrending = () => tmdb<TmdbList>("/trending/all/week");
export const getTrendingMovies = () => tmdb<TmdbList>("/trending/movie/week");
export const getTrendingTV = () => tmdb<TmdbList>("/trending/tv/week");
export const getPopularMovies = () => tmdb<TmdbList>("/movie/popular");
export const getTopRated = () => tmdb<TmdbList>("/movie/top_rated");
export const getPopularTV = () => tmdb<TmdbList>("/tv/popular");
export const getUpcoming = () => tmdb<TmdbList>("/movie/upcoming");
export const searchMulti = (query: string) => tmdb<TmdbList>("/search/multi", { query });
export const getAnime = () => tmdb<TmdbList>("/discover/tv", { with_genres: "16" });

interface DetailsExtras {
  genres: { id: number; name: string }[];
  original_language?: string;
  status?: string;
  tagline?: string;
  images?: { logos?: TmdbImage[] };
  production_companies?: { id: number; name: string; logo_path: string | null }[];
}

export interface MovieDetails extends Movie, DetailsExtras {
  runtime: number;
  imdb_id: string | null;
  budget?: number;
  revenue?: number;
}

export interface SeasonSummary {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
}

export interface TVDetails extends Movie, DetailsExtras {
  number_of_seasons: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  last_air_date?: string;
  created_by?: { id: number; name: string }[];
  seasons?: SeasonSummary[];
  external_ids?: { imdb_id: string | null };
}

export interface Episode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

export interface SeasonDetails {
  id: number;
  season_number: number;
  name: string;
  episodes: Episode[];
}

export const getTVSeason = (id: number, season: number) =>
  tmdb<SeasonDetails>(`/tv/${id}/season/${season}`);

/** Logos ride along with the details request rather than costing a second one. */
const DETAILS_PARAMS = { append_to_response: "external_ids,images", include_image_language: "en,null" };

export const getMovieDetails = (id: number) => tmdb<MovieDetails>(`/movie/${id}`, DETAILS_PARAMS);
export const getTVDetails = (id: number) => tmdb<TVDetails>(`/tv/${id}`, DETAILS_PARAMS);

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface Credits {
  cast: CastMember[];
  crew?: { id: number; name: string; job: string }[];
}

export const getMovieCredits = (id: number) => tmdb<Credits>(`/movie/${id}/credits`);
export const getTVCredits = (id: number) => tmdb<Credits>(`/tv/${id}/credits`);

interface VidCoreCommonEmbedOptions {
  title?: boolean;
  poster?: boolean;
  autoPlay?: boolean;
  startAt?: number;
  theme?: string;
  server?: string;
  hideServer?: boolean;
  fullscreenButton?: boolean;
  chromecast?: boolean;
  sub?: string;
}

interface VidCoreTVEmbedOptions extends VidCoreCommonEmbedOptions {
  nextButton?: boolean;
  autoNext?: boolean;
}

const appendEmbedParams = (url: URL, params: Record<string, string | number | boolean | null | undefined>) => {
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    url.searchParams.set(key, String(value));
  });
};

export const buildMovieEmbedUrl = (
  tmdbId: number,
  options: VidCoreCommonEmbedOptions = {}
): string => {
  const url = new URL(`${VIDCORE_BASE}/movie/${encodeURIComponent(String(tmdbId))}`);
  appendEmbedParams(url, { autoPlay: true, ...options });
  return url.toString();
};

export const buildTVEpisodeEmbedUrl = (
  tmdbId: number,
  season: number,
  episode: number,
  options: VidCoreTVEmbedOptions = {}
): string => {
  const url = new URL(
    `${VIDCORE_BASE}/tv/${encodeURIComponent(String(tmdbId))}/${encodeURIComponent(String(season))}/${encodeURIComponent(String(episode))}`
  );
  appendEmbedParams(url, { autoPlay: true, ...options });
  return url.toString();
};
