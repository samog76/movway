import { Capacitor, CapacitorHttp } from "@capacitor/core";

const TMDB_API_KEY =
  (import.meta.env.VITE_TMDB_API_KEY as string | undefined) ||
  "2dca580c2a14b55200e784d157207b4d";
const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
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

export interface SeasonSummary {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
}

export interface TVDetails extends Movie {
  genres: { id: number; name: string }[];
  number_of_seasons: number;
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

export const getMovieCredits = (id: number) => tmdb<Credits>(`/movie/${id}/credits`);
export const getTVCredits = (id: number) => tmdb<Credits>(`/tv/${id}/credits`);

