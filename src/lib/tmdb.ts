const TMDB_API_KEY =
  (import.meta.env.VITE_TMDB_API_KEY as string | undefined) ||
  "2dca580c2a14b55200e784d157207b4d";
const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const VIDSRC_EMBED_BASE = "https://vidsrc-embed.ru";
const DEFAULT_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const EMBED_API_PROVIDERS = ["vidplus", "vidsrc-embed"] as const;

export type EmbedApiProvider = (typeof EMBED_API_PROVIDERS)[number];

export const resolveEmbedApiProvider = (provider: string | null | undefined): EmbedApiProvider =>
  EMBED_API_PROVIDERS.includes(provider as EmbedApiProvider) ? (provider as EmbedApiProvider) : "vidplus";

export const getDefaultEmbedApiProvider = (): EmbedApiProvider =>
  resolveEmbedApiProvider(import.meta.env.VITE_EMBED_API_PROVIDER as string | undefined);

export const img = (path: string | null, size = "w500") =>
  path
    ? `${IMG}/${size}${path}`
    : DEFAULT_IMAGE;

export const backdrop = (path: string | null) => img(path, "original");

async function tmdb<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function vidsrcEmbed<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${VIDSRC_EMBED_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`VIDSRC ${res.status}`);
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
}

interface TmdbList { results: Movie[]; }

export const getTrending = () => tmdb<TmdbList>("/trending/all/week");
export const getTrendingMovies = () => tmdb<TmdbList>("/trending/movie/week");
export const getTrendingTV = () => tmdb<TmdbList>("/trending/tv/week");
export const getPopularMovies = () => tmdb<TmdbList>("/movie/popular");
export const getTopRated = () => tmdb<TmdbList>("/movie/top_rated");
export const getPopularTV = () => tmdb<TmdbList>("/tv/popular");
export const getUpcoming = () => tmdb<TmdbList>("/movie/upcoming");
export const searchMulti = (query: string) => tmdb<TmdbList>("/search/multi", { query });
export const getAnime = () => tmdb<TmdbList>("/discover/tv", { with_genres: "16" });

export interface MovieDetails extends Movie {
  genres: { id: number; name: string }[];
  runtime: number;
  imdb_id: string | null;
}

export interface TVDetails extends Movie {
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  external_ids?: { imdb_id: string | null };
}

export const getMovieDetails = (id: number) =>
  tmdb<MovieDetails>(`/movie/${id}`, { append_to_response: "external_ids" });
export const getTVDetails = (id: number) =>
  tmdb<TVDetails>(`/tv/${id}`, { append_to_response: "external_ids" });

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface Credits { cast: CastMember[] }
export interface VidsrcEmbedListItem {
  [key: string]: unknown;
}

export interface VidsrcEmbedListResponse {
  results: VidsrcEmbedListItem[];
}

export const getMovieCredits = (id: number) => tmdb<Credits>(`/movie/${id}/credits`);
export const getTVCredits = (id: number) => tmdb<Credits>(`/tv/${id}/credits`);

export const buildMovieEmbedUrl = (provider: EmbedApiProvider, tmdbId: number): string =>
  provider === "vidsrc-embed"
    ? `${VIDSRC_EMBED_BASE}/embed/movie/${encodeURIComponent(String(tmdbId))}`
    : `https://player.vidplus.to/embed/movie/${encodeURIComponent(String(tmdbId))}`;

export const buildTVEpisodeEmbedUrl = (
  provider: EmbedApiProvider,
  tmdbId: number,
  season: number,
  episode: number
): string =>
  provider === "vidsrc-embed"
    ? `${VIDSRC_EMBED_BASE}/embed/tv/${encodeURIComponent(String(tmdbId))}/${encodeURIComponent(String(season))}/${encodeURIComponent(String(episode))}`
    : `https://player.vidplus.to/embed/tv/${encodeURIComponent(String(tmdbId))}/${encodeURIComponent(String(season))}/${encodeURIComponent(String(episode))}`;

const assertValidPageNumber = (page: number): void => {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("Page number must be an integer greater than or equal to 1.");
  }
};

export const getVidsrcEmbedLatestMovies = (page: number) => {
  assertValidPageNumber(page);
  return vidsrcEmbed<VidsrcEmbedListResponse>(`/movies/latest/page-${encodeURIComponent(String(page))}.json`);
};

export const getVidsrcEmbedLatestEpisodes = (page: number) => {
  assertValidPageNumber(page);
  return vidsrcEmbed<VidsrcEmbedListResponse>(`/episodes/latest/page-${encodeURIComponent(String(page))}.json`);
};

export const buildVidPlusMovieEmbedUrl = (tmdbId: number): string =>
  buildMovieEmbedUrl("vidplus", tmdbId);

export const buildVidPlusTVEmbedUrl = (
  tmdbId: number,
  season: number,
  episode: number
): string =>
  buildTVEpisodeEmbedUrl("vidplus", tmdbId, season, episode);

export const buildVidPlusAnimeEmbedUrl = (
  anilistId: number,
  episode: number,
  dub: boolean
): string =>
  `https://player.vidplus.to/embed/anime/${encodeURIComponent(String(anilistId))}/${encodeURIComponent(String(episode))}?dub=${dub ? "true" : "false"}`;
